#!/usr/bin/env bash
# Idempotent server bootstrap: Docker + shared network + self-signed origin
# cert + edge proxy. Safe to re-run. Run as root on the deploy host.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/tanfeeth}"
CERT_DIR="$DEPLOY_DIR/nginx/certs"

echo "==> Installing Docker (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> Ensuring shared docker network 'tanfeeth-net'"
docker network inspect tanfeeth-net >/dev/null 2>&1 || docker network create tanfeeth-net

echo "==> Generating self-signed origin certificate (if missing)"
mkdir -p "$CERT_DIR"
if [ ! -f "$CERT_DIR/tanfeeth.crt" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$CERT_DIR/tanfeeth.key" -out "$CERT_DIR/tanfeeth.crt" \
    -subj "/CN=tanfeeth.io" \
    -addext "subjectAltName=DNS:tanfeeth.io,DNS:www.tanfeeth.io,DNS:api.tanfeeth.io,DNS:staging.tanfeeth.io,DNS:staging-api.tanfeeth.io"
fi

echo "==> Starting edge proxy"
cd "$DEPLOY_DIR"
docker compose -f docker-compose.proxy.yml up -d

echo "==> Done. Proxy is up on :80 and :443."
