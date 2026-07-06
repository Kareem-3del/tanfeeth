#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Fan a new image tag out across EVERY per-customer stack. The CI deploy step
# calls this on the self-hosted runner after pushing the image to GHCR.
#
#   scripts/rollout.sh <api|web> <tag>
#     scripts/rollout.sh api  prod
#     scripts/rollout.sh web  prod
#
# For each customers/<slug>/ it:
#   1. rewrites the tag on API_IMAGE (or WEB_IMAGE) in that customer's .env
#   2. pulls the new image
#   3. recreates ONLY that one service (--no-deps) — pg and the sibling service
#      are left untouched.
#
# Best-effort per customer: a failure on one customer is reported and the rollout
# continues to the rest; the script exits non-zero if any customer failed.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$DEPLOY_DIR"

usage() { echo "usage: $0 <api|web> <tag>" >&2; exit 2; }
SERVICE="${1:-}"; TAG="${2:-}"
[ -n "$SERVICE" ] && [ -n "$TAG" ] || usage
case "$SERVICE" in
  api) IMAGE_VAR="API_IMAGE" ;;
  web) IMAGE_VAR="WEB_IMAGE" ;;
  *)   usage ;;
esac

COMPOSE_FILE="templates/docker-compose.customer.yml"
shopt -s nullglob
customers=(customers/*/.env)
if [ "${#customers[@]}" -eq 0 ]; then
  echo "==> No customers/*/.env found; nothing to roll out."
  exit 0
fi

failed=()
for env_file in "${customers[@]}"; do
  slug="$(basename "$(dirname "$env_file")")"

  # current image ref for this service -> keep the repo, swap the tag.
  cur="$(sed -n "s/^$IMAGE_VAR=//p" "$env_file" | head -n1)"
  if [ -z "$cur" ]; then
    echo "  skip $slug: no $IMAGE_VAR in $env_file" >&2
    failed+=("$slug"); continue
  fi
  repo="${cur%:*}"
  new="$repo:$TAG"

  echo "==> [$slug] $IMAGE_VAR: $cur -> $new"
  # portable in-place sed (GNU and BSD)
  tmp="$(mktemp)"
  sed "s|^$IMAGE_VAR=.*|$IMAGE_VAR=$new|" "$env_file" > "$tmp" && cat "$tmp" > "$env_file"
  rm -f "$tmp"

  if docker compose \
      --project-directory "$DEPLOY_DIR" \
      --env-file "$env_file" \
      -f "$COMPOSE_FILE" \
      -p "tanfeeth-$slug" \
      up -d --no-deps --pull always "$SERVICE"; then
    echo "  [$slug] $SERVICE recreated."
  else
    echo "  [$slug] FAILED to recreate $SERVICE" >&2
    failed+=("$slug")
  fi
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "==> Rollout finished with failures: ${failed[*]}" >&2
  exit 1
fi
echo "==> Rollout of $SERVICE:$TAG complete across ${#customers[@]} customer(s)."
