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
  docker-compose.prod.yml       # postgres + api + web (prod — shared multi-tenant, legacy)
  docker-compose.staging.yml    # postgres + api + web (staging)
  docker-compose.rfp.yml        # shared RFP Intelligence stack (per environment)
  .env.prod  .env.staging       # secrets (generated on host, NOT committed)
  .env.rfp.prod  .env.rfp.staging
  templates/                    # per-customer stack + nginx templates (env-substituted)
  customers/<slug>/{.env,meta.yml}  # one isolated stack per customer (.env gitignored)
  nginx/conf.d/tanfeeth.conf    # shared/legacy blocks
  nginx/conf.d/customer-<slug>.conf # rendered per customer
  nginx/certs/                  # self-signed origin cert
/opt/actions-runner/            # 4 self-hosted runner services
```

## Per-customer isolation (deploy-layer multi-tenancy)

Tenant isolation lives at the **deploy layer**: each customer gets its own
`postgres + api + web` stack (own volume, own internal network) instead of
row-level `organization_id` scoping. The single nginx proxy fronts every
customer by hostname, and **one shared RFP Intelligence stack per environment**
(prod vs staging = separate DBs) serves them all over an internal-only net.

- **Network model.** `postgres` is on the per-customer internal net only (never
  reachable by another customer or the edge). `api`/`web` join that internal net
  **and** the shared edge net (`tanfeeth-net`) so the proxy can route them; `api`
  also joins the shared per-environment RFP net (`tanfeeth-rfp-net-<env>`).
- **One web image, same-host `/api` (prod).** The prod web image bakes
  `NEXT_PUBLIC_API_URL=/api` (relative), so one image serves all customers; the
  proxy's per-customer `location /api` routes to that customer's own api. SSR
  reaches the api by container name over the internal net. **Staging stays on an
  absolute API URL** — do not render a staging customer with the same-host `/api`
  block without adding a staging `/api` path first.
- **TLS per customer, AFTER DNS.** Each customer gets its own Let's Encrypt cert
  (`issue-letsencrypt.sh <web_host>`), issued only once the domain resolves here.
  There is deliberately **no shared multi-SAN cert** — one un-pointed domain must
  not fail the whole fleet's issuance.
- **Migrations, not synchronize.** New customer DBs are built by the API's on-boot
  migrations (`DB_SYNCHRONIZE=false`). Never bootstrap a customer DB with
  `synchronize=true`.

```bash
# scaffold + up (fill the __CHANGE_ME__ secrets in customers/<slug>/.env after)
scripts/new-customer.sh <slug> <web_host> [prod|staging]
# after DNS points at the host: issue this customer's cert
ACME_EMAIL=admin@tanfeeth.io bash scripts/issue-letsencrypt.sh <web_host>
# render/reload nginx for all (or one) customer
scripts/render-nginx.sh [<slug>]
# bring up the shared RFP stack (once per environment)
docker compose --env-file .env.rfp.prod -f docker-compose.rfp.yml -p tanfeeth-rfp-prod up -d
```

CI deploy fans a new image tag across every customer stack via
`scripts/rollout.sh <api|web> <tag>` (called by each app's `ci-cd.yml` on the
self-hosted runner).

### Migrating an existing org — ordering constraint (M6)

`scripts/migrate-org-to-customer.sh` (guarded runbook) splits one organization
out of the shared DB into a fresh per-customer DB. The order is load-bearing:

1. **Export while `organization_id` still exists** on the shared DB — i.e. before
   the M6 de-tenant cleanup drops the org columns/tables (and before M0 neutralize
   touches the key). Once `DropTenancy` runs, the filter key is gone and the
   export is impossible.
2. **Import into a migrated-but-UN-SEEDED** customer DB (`SEED_ON_BOOTSTRAP=false`)
   so seed rows (admin, Default Org, base perms) don't collide with imported rows.
3. Keep the shared stack authoritative until the customer's DNS/TLS cutover is
   verified.

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
