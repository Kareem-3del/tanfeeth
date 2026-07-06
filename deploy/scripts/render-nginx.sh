#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Render per-customer nginx server blocks from customers/*/meta.yml into
# nginx/conf.d/customer-<slug>.conf (auto-included by the proxy's conf.d/*.conf),
# then reload the proxy.
#
#   scripts/render-nginx.sh            # render ALL customers, then reload
#   scripts/render-nginx.sh <slug>     # render one customer, then reload
#
# The proxy is reloaded only if it is running AND `nginx -t` passes, so a
# half-written conf never takes the edge down.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$DEPLOY_DIR"

TEMPLATE="templates/nginx-customer.conf.template"
OUT_DIR="nginx/conf.d"
ONLY="${1:-}"

[ -f "$TEMPLATE" ] || { echo "error: $TEMPLATE not found" >&2; exit 1; }
mkdir -p "$OUT_DIR"

# meta.yml is flat `key: value`; pull one key.
meta() { sed -n "s/^$2:[[:space:]]*//p" "$1" | head -n1; }

render_one() {
  local meta_file="$1" slug web_host env
  slug="$(meta "$meta_file" slug)"
  web_host="$(meta "$meta_file" web_host)"
  env="$(meta "$meta_file" environment)"
  if [ -z "$slug" ] || [ -z "$web_host" ]; then
    echo "  skip: $meta_file missing slug/web_host" >&2; return 0
  fi
  if [ "$env" = "staging" ]; then
    # CORRECTION: this template bakes same-host /api (prod web image). Staging web
    # stays on an absolute API URL and must not silently inherit the /api block.
    echo "  skip: $slug is staging — render staging deliberately (see template note)" >&2
    return 0
  fi
  local out="$OUT_DIR/customer-$slug.conf"
  sed \
    -e "s|__CUSTOMER_SLUG__|$slug|g" \
    -e "s|__WEB_HOST__|$web_host|g" \
    "$TEMPLATE" > "$out"
  echo "  rendered $out  ($web_host)"
}

echo "==> Rendering customer nginx confs"
if [ -n "$ONLY" ]; then
  meta_file="customers/$ONLY/meta.yml"
  [ -f "$meta_file" ] || { echo "error: $meta_file not found" >&2; exit 1; }
  render_one "$meta_file"
else
  shopt -s nullglob
  found=0
  for meta_file in customers/*/meta.yml; do
    found=1
    render_one "$meta_file"
  done
  [ "$found" = 1 ] || echo "  (no customers/*/meta.yml yet — nothing to render)"
fi

# --- reload the proxy if it is up and the config is valid ------------------
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx tanfeeth-proxy; then
  echo "==> Validating proxy config"
  if docker exec tanfeeth-proxy nginx -t; then
    docker exec tanfeeth-proxy nginx -s reload
    echo "==> Proxy reloaded."
  else
    echo "error: nginx -t failed — NOT reloading. Fix the rendered conf and re-run." >&2
    exit 1
  fi
else
  echo "==> Proxy container not running; skipped reload (confs written)."
fi
