#!/usr/bin/env bash
# Issue/replace the origin TLS cert with a real Let's Encrypt cert (webroot via
# the running nginx proxy), then point nginx at it. Requires the domains to
# resolve to this host and ports 80/443 open. Idempotent-ish; safe to re-run.
# Run from /opt/tanfeeth on the deploy host.
set -euo pipefail

EMAIL="${ACME_EMAIL:-admin@tanfeeth.io}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/tanfeeth}"
cd "$DEPLOY_DIR"
mkdir -p nginx/certbot-www nginx/letsencrypt

# nginx must already serve the ACME challenge location (see tanfeeth.conf) and
# mount ./nginx/certbot-www + ./nginx/letsencrypt (see docker-compose.proxy.yml).
docker compose -f docker-compose.proxy.yml up -d

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
