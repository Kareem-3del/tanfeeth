# Tanfeeth

Meta repository for the Tanfeeth platform. The application code lives in two
independent repositories, linked here as git submodules:

| Path | Repo | Description |
|------|------|-------------|
| [`frontend/`](https://github.com/Kareem-3del/tanfeeth-frontend) | `tanfeeth-frontend` | Next.js app + admin portal (auth, users, roles, permissions) |
| [`backend/`](https://github.com/Kareem-3del/tanfeeth-api) | `tanfeeth-api` | NestJS API — hexagonal + modular, auth + dynamic RBAC |
| [`deploy/`](./deploy) | _(this repo)_ | Docker Compose stacks, nginx, CI/CD & server bootstrap |

## Clone with submodules

```bash
git clone --recurse-submodules https://github.com/Kareem-3del/tanfeeth.git
# or, if already cloned:
git submodule update --init --recursive
```

## Environments

| | Frontend | API |
|--|----------|-----|
| **Production** | https://www.tanfeeth.io · https://tanfeeth.io | https://api.tanfeeth.io |
| **Staging** | https://staging.tanfeeth.io | https://staging-api.tanfeeth.io |

Deployed via GitHub Actions to a single Docker host behind Cloudflare.
See [`deploy/README.md`](./deploy/README.md).
