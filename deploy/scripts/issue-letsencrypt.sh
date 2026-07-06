#!/usr/bin/env bash
# Issue/replace TLS certs with real Let's Encrypt certs (webroot via the running
# nginx proxy). Requires the domain(s) to resolve to this host and ports 80/443
# open. Idempotent-ish; safe to re-run. Run from /opt/tanfeeth on the deploy host.
#
#   issue-letsencrypt.sh                 # base fleet cert (shared/legacy hosts)
#   issue-letsencrypt.sh <web_host>      # PER-CUSTOMER cert (CORRECTION R10)
#
# CORRECTION R10 — per-customer certs, issued AFTER that customer's DNS points
# here. Each customer gets its own single-host cert in live/<web_host>/ (the
# rendered customer-<slug>.conf already references those paths), so ONE un-pointed
# customer domain can't fail the whole fleet's issuance under `set -euo pipefail`.
set -euo pipefail

EMAIL="${ACME_EMAIL:-admin@tanfeeth.io}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/tanfeeth}"
CUSTOMER_HOST="${1:-}"
cd "$DEPLOY_DIR"
mkdir -p nginx/certbot-www nginx/letsencrypt

# nginx must already serve the ACME challenge location and mount
# ./nginx/certbot-www + ./nginx/letsencrypt (see docker-compose.proxy.yml).
docker compose -f docker-compose.proxy.yml up -d

if [ -n "$CUSTOMER_HOST" ]; then
  # --- per-customer single-host cert -> live/<web_host>/ --------------------
  docker run --rm \
    -v "$DEPLOY_DIR/nginx/certbot-www:/var/www/certbot" \
    -v "$DEPLOY_DIR/nginx/letsencrypt:/etc/letsencrypt" \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    --non-interactive --agree-tos -m "$EMAIL" --no-eff-email \
    -d "$CUSTOMER_HOST"
  docker exec tanfeeth-proxy nginx -t
  docker exec tanfeeth-proxy nginx -s reload
  echo "==> Per-customer cert active for $CUSTOMER_HOST (live/$CUSTOMER_HOST/)."
  exit 0
fi

# --- base fleet cert (shared/legacy hosts) ---------------------------------
docker run --rm \
  -v "$DEPLOY_DIR/nginx/certbot-www:/var/www/certbot" \
  -v "$DEPLOY_DIR/nginx/letsencrypt:/etc/letsencrypt" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  --non-interactive --agree-tos -m "$EMAIL" --no-eff-email \
  -d tanfeeth.io -d www.tanfeeth.io -d api.tanfeeth.io \
  -d staging.tanfeeth.io -d staging-api.tanfeeth.io

# Point nginx at the LE cert and reload.
sed -i \
  -e 's#/etc/nginx/certs/tanfeeth.crt#/etc/letsencrypt/live/tanfeeth.io/fullchain.pem#g' \
  -e 's#/etc/nginx/certs/tanfeeth.key#/etc/letsencrypt/live/tanfeeth.io/privkey.pem#g' \
  nginx/conf.d/tanfeeth.conf
docker exec tanfeeth-proxy nginx -t
docker exec tanfeeth-proxy nginx -s reload
echo "==> Let's Encrypt cert active. Auto-renewal: /etc/cron.d/tanfeeth-certbot"
