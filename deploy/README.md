# Tanfeeth Deploy

Infrastructure for the Tanfeeth platform. Lives in the `tanfeeth` meta repo;
the apps are git submodules (`tanfeeth-frontend`, `tanfeeth-api`).

## Topology

Single host (`76.13.251.17`, Ubuntu 24.04) running Docker. The domains resolve
to the origin and TLS is terminated there with a **Let's Encrypt** cert
(`scripts/issue-letsencrypt.sh`, auto-renewed via `/etc/cron.d/tanfeeth-certbot`).
If you later move the domains behind the Cloudflare proxy, set the Cloudflare SSL
mode to **Full (strict)** — the LE origin cert is trusted there too.
One `nginx` edge proxy fronts two isolated stacks:

| Domain | Container | Stack |
|--------|-----------|-------|
| `tanfeeth.io`, `www.tanfeeth.io` | `tanfeeth-web-prod` | prod |
| `api.tanfeeth.io` | `tanfeeth-api-prod` | prod |
| `staging.tanfeeth.io` | `tanfeeth-web-staging` | staging |
| `staging-api.tanfeeth.io` | `tanfeeth-api-staging` | staging |

All containers share the external `tanfeeth-net` network and are addressed by
container name.

## CI/CD

Each app repo has `.github/workflows/ci-cd.yml`:

- push to `staging` → build image `:staging` → push GHCR → deploy staging stack
- push to `main` → build image `:prod` → push GHCR → deploy prod stack

Jobs run on the **self-hosted runners** on the deploy host (labels
`self-hosted,tanfeeth`), so the deploy step runs locally against the compose
files in `/opt/tanfeeth`.

## Server layout

```
/opt/tanfeeth/
  docker-compose.proxy.yml      # nginx edge (:80/:443)
  docker-compose.prod.yml       # postgres + api + web (prod)
  docker-compose.staging.yml    # postgres + api + web (staging)
  .env.prod  .env.staging       # secrets (generated on host, NOT committed)
  nginx/conf.d/tanfeeth.conf
  nginx/certs/                  # self-signed origin cert
/opt/actions-runner/            # 4 self-hosted runner services
```

## First-time setup

```bash
# on the host, with this directory synced to /opt/tanfeeth
DEPLOY_DIR=/opt/tanfeeth bash scripts/bootstrap-server.sh
cp .env.prod.example .env.prod && $EDITOR .env.prod      # fill secrets
cp .env.staging.example .env.staging && $EDITOR .env.staging
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.staging.yml up -d

# runners (run per app repo; get a token via gh)
bash scripts/setup-runners.sh https://github.com/Kareem-3del/tanfeeth-api    "$TOKEN" 2 api
bash scripts/setup-runners.sh https://github.com/Kareem-3del/tanfeeth-frontend "$TOKEN" 2 web
```
