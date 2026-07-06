# customers/

One directory per customer — each is a fully isolated stack (its own postgres +
api + web + volume + internal network). The single shared nginx proxy fronts them
all, and one shared **per-environment** RFP Intelligence stack serves them all.

## Layout

```
customers/
  <slug>/
    .env        # SECRETS + compose vars for this customer  (GITIGNORED — never commit)
    meta.yml    # non-secret metadata (slug, web_host, environment)  (committed)
```

- `<slug>` is `[a-z0-9-]`. It names the containers (`tanfeeth-{pg,api,web}-<slug>`),
  the volume (`tanfeeth-pgdata-<slug>`), the internal net (`tanfeeth-<slug>-internal`),
  and the nginx conf (`nginx/conf.d/customer-<slug>.conf`).
- **`customers/*/.env` is gitignored** (see `deploy/.gitignore`). It holds DB
  passwords, JWT secrets, the admin password and the RFP service token. Only
  `meta.yml` is committed so `render-nginx.sh` / `rollout.sh` can enumerate
  customers from a clean checkout.

## Lifecycle

```bash
# 1. scaffold + bring up (does NOT issue TLS — that waits for DNS)
scripts/new-customer.sh <slug> <web_host> [prod|staging]
#    then edit customers/<slug>/.env to fill the __CHANGE_ME__ secrets.

# 2. point DNS for <web_host> at the host, THEN issue the per-customer cert
ACME_EMAIL=admin@tanfeeth.io bash scripts/issue-letsencrypt.sh <web_host>

# 3. re-render nginx (e.g. after editing meta.yml) and reload the proxy
scripts/render-nginx.sh            # all customers
scripts/render-nginx.sh <slug>     # one customer
```

Image rollouts are fleet-wide and CI-driven:

```bash
scripts/rollout.sh api  prod       # recreate the api service across ALL customers
scripts/rollout.sh web  prod       # recreate the web service across ALL customers
```

## Migrating an existing org into its own stack

Use `scripts/migrate-org-to-customer.sh` (a guarded runbook, not CI). The hard
ordering constraint: **export the org's rows WHILE `organization_id` still exists
on the shared DB (before the M6 de-tenant column drop), and import into a
migrated-but-UN-SEEDED customer DB** (`SEED_ON_BOOTSTRAP=false`) so seed rows
don't collide with the imported ones.
