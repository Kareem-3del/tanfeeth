#!/usr/bin/env bash
# ===========================================================================
# RUNBOOK — migrate ONE organization out of the shared multi-tenant DB into a
# fresh per-customer database. Guarded and destructive-adjacent; read this whole
# header before running. This is NOT part of CI — a human drives it, per customer.
#
#   scripts/migrate-org-to-customer.sh export   # phase 1: dump one org's rows
#   scripts/migrate-org-to-customer.sh import    # phase 2: load into the new DB
#
# Required env:
#   ORG_ID          uuid of the organization to migrate (the row key that STILL
#                   EXISTS pre-M6)
#   SLUG            target customer slug (must already be scaffolded via
#                   new-customer.sh; its DB is the import target)
#   CONFIRM=migrate required literal to actually run (otherwise dry-run only)
#
#   export phase, shared source DB (the live multi-tenant prod DB):
#     SRC_DB_HOST SRC_DB_PORT SRC_DB_USER SRC_DB_PASSWORD SRC_DB_NAME
#   import phase target DB is read from customers/<SLUG>/.env (DB_* + container).
#
#   DUMP_DIR        where CSVs live (default: ./migrations-out/<SLUG>)
#
# ─────────────────────────  CRITICAL ORDERING (R5 / R9)  ───────────────────
#  1. Run `export` WHILE `organization_id` STILL EXISTS and is populated on the
#     shared DB — i.e. BEFORE M0 neutralize touches the data key, and long BEFORE
#     M6 drops the org columns/tables. Once M6's DropTenancy migration runs there
#     is no organization_id left to filter on and this export is impossible.
#  2. Run `import` into a target DB that has been MIGRATED (schema created by the
#     API's on-boot migrations) but is UN-SEEDED. Set SEED_ON_BOOTSTRAP=false in
#     customers/<SLUG>/.env before first API boot, or seed rows (admin, Default
#     Org, base perms) will COLLIDE with the imported rows (R9).
#  3. The shared prod stack stays authoritative until this customer's DNS/TLS
#     cutover succeeds. Do not decommission the org on the shared DB until the
#     per-customer stack is verified.
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$DEPLOY_DIR"

PHASE="${1:-}"
case "$PHASE" in export|import) ;; *) echo "usage: $0 <export|import>  (see header)" >&2; exit 2 ;; esac

: "${ORG_ID:?set ORG_ID to the organization uuid to migrate}"
: "${SLUG:?set SLUG to the target customer slug}"
DUMP_DIR="${DUMP_DIR:-$DEPLOY_DIR/migrations-out/$SLUG}"
DRY_RUN=1; [ "${CONFIRM:-}" = "migrate" ] && DRY_RUN=0

# Org-scoped tables: rows are selected WHERE organization_id = $ORG_ID.
# (Matches the 5 tenant-scoped domain tables in the design; keep in sync if the
#  tenant column set changes before M6.)
ORG_SCOPED_TABLES=(
  competitions
  contracts
  annual_plans
  out_of_plan_requests
  audit_logs
)
# The organization's own identity/membership rows (filtered by id / organization_id).
ORG_OWN_TABLES=(
  organizations            # WHERE id = $ORG_ID
  organization_memberships # WHERE organization_id = $ORG_ID
  organization_invitations # WHERE organization_id = $ORG_ID
)

banner() { echo "── $* ─────────────────────────────────────────" ; }

if [ "$DRY_RUN" = 1 ]; then
  banner "DRY RUN (set CONFIRM=migrate to execute)"
fi

# --------------------------------------------------------------------------
if [ "$PHASE" = "export" ]; then
  : "${SRC_DB_HOST:?}" "${SRC_DB_USER:?}" "${SRC_DB_NAME:?}"
  SRC_DB_PORT="${SRC_DB_PORT:-5432}"
  export PGPASSWORD="${SRC_DB_PASSWORD:-}"

  banner "EXPORT org $ORG_ID from $SRC_DB_HOST/$SRC_DB_NAME -> $DUMP_DIR"
  echo "REMINDER: organization_id MUST still exist on the source (pre-M6). If M6's"
  echo "          DropTenancy already ran, abort — the filter key is gone (R5)."

  if [ "$DRY_RUN" = 1 ]; then
    echo "would create: $DUMP_DIR"
    echo "would dump users referenced by memberships of org $ORG_ID"
    for t in "${ORG_OWN_TABLES[@]}" "${ORG_SCOPED_TABLES[@]}"; do
      echo "would \\copy (filtered) $t -> $DUMP_DIR/$t.csv"
    done
    exit 0
  fi

  mkdir -p "$DUMP_DIR"
  psql_src() { psql -h "$SRC_DB_HOST" -p "$SRC_DB_PORT" -U "$SRC_DB_USER" -d "$SRC_DB_NAME" -v ON_ERROR_STOP=1 "$@"; }

  # Users belonging to the org (via membership). Exported first so FK targets
  # exist before dependent rows on import.
  psql_src -c "\copy (SELECT u.* FROM users u JOIN organization_memberships m ON m.user_id = u.id WHERE m.organization_id = '$ORG_ID') TO '$DUMP_DIR/users.csv' WITH CSV HEADER"

  for t in "${ORG_OWN_TABLES[@]}"; do
    if [ "$t" = "organizations" ]; then
      psql_src -c "\copy (SELECT * FROM $t WHERE id = '$ORG_ID') TO '$DUMP_DIR/$t.csv' WITH CSV HEADER"
    else
      psql_src -c "\copy (SELECT * FROM $t WHERE organization_id = '$ORG_ID') TO '$DUMP_DIR/$t.csv' WITH CSV HEADER"
    fi
  done
  for t in "${ORG_SCOPED_TABLES[@]}"; do
    psql_src -c "\copy (SELECT * FROM $t WHERE organization_id = '$ORG_ID') TO '$DUMP_DIR/$t.csv' WITH CSV HEADER"
  done

  echo "==> Export complete: $DUMP_DIR"
  echo "    Review the CSVs, then run the import phase against the new customer DB."
  exit 0
fi

# --------------------------------------------------------------------------
if [ "$PHASE" = "import" ]; then
  ENV_FILE="customers/$SLUG/.env"
  [ -f "$ENV_FILE" ] || { echo "error: $ENV_FILE not found — scaffold with new-customer.sh first" >&2; exit 1; }
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
  PG_CONTAINER="tanfeeth-pg-$SLUG"

  banner "IMPORT org $ORG_ID -> $PG_CONTAINER ($DB_NAME)"
  echo "PRECONDITION: target DB is MIGRATED (API booted once so migrations ran) but"
  echo "              UN-SEEDED (SEED_ON_BOOTSTRAP=false). Otherwise seed rows collide (R9)."
  [ -d "$DUMP_DIR" ] || { echo "error: $DUMP_DIR not found — run the export phase first" >&2; exit 1; }

  # Import order: users -> organization identity -> org-scoped domain rows.
  IMPORT_ORDER=(users "${ORG_OWN_TABLES[@]}" "${ORG_SCOPED_TABLES[@]}")

  if [ "$DRY_RUN" = 1 ]; then
    echo "would verify $PG_CONTAINER is running and $DB_NAME is un-seeded"
    for t in "${IMPORT_ORDER[@]}"; do
      echo "would \\copy $DUMP_DIR/$t.csv -> $t"
    done
    exit 0
  fi

  docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER" \
    || { echo "error: $PG_CONTAINER not running — bring the customer stack up first" >&2; exit 1; }

  psql_dst() { docker exec -e PGPASSWORD="$DB_PASSWORD" -i "$PG_CONTAINER" \
      psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"; }

  # Guard: refuse to import into a seeded DB (would collide).
  seeded="$(psql_dst -tAc "SELECT count(*) FROM organizations" 2>/dev/null || echo 0)"
  if [ "${seeded:-0}" != "0" ]; then
    echo "error: target already has $seeded organization row(s) — refusing (would collide, R9)." >&2
    echo "       Recreate the customer DB migrated-but-unseeded, then retry." >&2
    exit 1
  fi

  for t in "${IMPORT_ORDER[@]}"; do
    f="$DUMP_DIR/$t.csv"
    [ -f "$f" ] || { echo "  skip $t (no $f)"; continue; }
    echo "  importing $t"
    psql_dst -c "\copy $t FROM STDIN WITH CSV HEADER" < "$f"
  done

  echo "==> Import complete into $PG_CONTAINER/$DB_NAME."
  echo "    Verify row counts, then proceed to DNS cutover + TLS issuance."
  exit 0
fi
