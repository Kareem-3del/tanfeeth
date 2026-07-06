#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Scaffold and bring up ONE per-customer stack (postgres + api + web).
#
#   scripts/new-customer.sh <slug> <web_host> [env]
#     <slug>      [a-z0-9-]  — names containers/volume/net/nginx conf
#     <web_host>  public hostname, e.g. moh.tanfeeth.io
#     [env]       prod | staging   (default: prod)
#
# What it does:
#   1. creates customers/<slug>/{.env,meta.yml} from the template (idempotent-safe:
#      refuses to clobber an existing .env)
#   2. renders the nginx conf and reloads the proxy
#   3. brings the stack up
#
# It does NOT issue the TLS cert — that happens AFTER DNS for <web_host> points
# at this host (CORRECTION R10). See the printed next-steps.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$DEPLOY_DIR"

usage() { echo "usage: $0 <slug> <web_host> [prod|staging]" >&2; exit 2; }

SLUG="${1:-}"; WEB_HOST="${2:-}"; CUSTOMER_ENV="${3:-prod}"
[ -n "$SLUG" ] && [ -n "$WEB_HOST" ] || usage

if ! [[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  echo "error: slug must match ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$" >&2; exit 2
fi
case "$CUSTOMER_ENV" in prod|staging) ;; *) echo "error: env must be prod|staging" >&2; exit 2;; esac

CUST_DIR="customers/$SLUG"
ENV_FILE="$CUST_DIR/.env"
META_FILE="$CUST_DIR/meta.yml"
RFP_NETWORK="tanfeeth-rfp-net-$CUSTOMER_ENV"
RFP_HOST="tanfeeth-rfp-$CUSTOMER_ENV"

if [ -e "$ENV_FILE" ]; then
  echo "error: $ENV_FILE already exists — refusing to overwrite. Delete it first to re-scaffold." >&2
  exit 1
fi

echo "==> Scaffolding $CUST_DIR"
mkdir -p "$CUST_DIR"

# --- render .env from the template -----------------------------------------
sed \
  -e "s|__SLUG__|$SLUG|g" \
  -e "s|__WEB_HOST__|$WEB_HOST|g" \
  templates/customer.env.example > "$ENV_FILE"

# apply env-specific + host-derived values on top of the template defaults
{
  echo ""
  echo "# --- filled by new-customer.sh ($(date -u +%FT%TZ)) ---"
  echo "CUSTOMER_SLUG=$SLUG"
  echo "CUSTOMER_ENV=$CUSTOMER_ENV"
  echo "WEB_HOST=$WEB_HOST"
  echo "DB_HOST=tanfeeth-pg-$SLUG"
  echo "RFP_NETWORK=$RFP_NETWORK"
  echo "RFP_API_URL=http://$RFP_HOST:3000"
} >> "$ENV_FILE"
chmod 600 "$ENV_FILE"

# --- meta.yml (checked in; drives render-nginx.sh + rollout.sh) ------------
cat > "$META_FILE" <<EOF
# Per-customer metadata (safe to commit; the SECRETS live in .env, gitignored).
slug: $SLUG
web_host: $WEB_HOST
environment: $CUSTOMER_ENV
created_at: $(date -u +%FT%TZ)
EOF

echo "==> Filling remaining secrets"
echo "    Edit $ENV_FILE and set: DB_PASSWORD, JWT_ACCESS_SECRET, ADMIN_PASSWORD, RFP_API_KEY."
echo "    (openssl rand -hex 32  for the JWT secret; RFP_API_KEY must equal the"
echo "     RFP_SERVICE_TOKEN of the $CUSTOMER_ENV RFP stack.)"

# --- render nginx + reload --------------------------------------------------
echo "==> Rendering nginx conf"
bash scripts/render-nginx.sh "$SLUG"

# --- bring the stack up -----------------------------------------------------
echo "==> Bringing up stack tanfeeth-$SLUG"
docker compose \
  --project-directory "$DEPLOY_DIR" \
  --env-file "$ENV_FILE" \
  -f templates/docker-compose.customer.yml \
  -p "tanfeeth-$SLUG" up -d

cat <<EOF

==> Stack tanfeeth-$SLUG is up.

Next steps (in order):
  1. Point DNS for $WEB_HOST at this host (A record).
  2. AFTER DNS resolves, issue this customer's TLS cert:
       ACME_EMAIL=admin@tanfeeth.io bash scripts/issue-letsencrypt.sh $WEB_HOST
     (per-customer cert — one un-pointed domain can't fail the fleet, R10)
  3. Reload the proxy if the cert step didn't:  docker exec tanfeeth-proxy nginx -s reload

Migrating an existing org into this stack instead of starting fresh?
  - Set SEED_ON_BOOTSTRAP=false in $ENV_FILE (avoid seed/import collision, R9).
  - Run scripts/migrate-org-to-customer.sh BEFORE the shared org DB is de-tenanted.
EOF
