# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product & domain (read this first)

**Tanfeeth (تنفيذ)** is an Arabic‑first SaaS platform that runs a Saudi government
entity's **full competition & procurement lifecycle — order → contract → closeout** —
on a configurable **workflow + business‑rules engine**, with **RBAC** across ~13 roles,
an **AI layer under mandatory human‑in‑the‑loop (HITL)**, persona dashboards (end user,
contracts/procurement dept, higher management, external contractor), and deep
integration with **Etimad, Nafath, the Ministry of Finance, and GOSI**. Arabic/RTL‑first,
Vision‑2030 aligned, KSA data‑residency.

The authoritative product & domain documentation lives in **`docs/product/`**:
- [`docs/product/PRODUCT.en.md`](docs/product/PRODUCT.en.md) / [`PRODUCT.ar.md`](docs/product/PRODUCT.ar.md)
  — vision, personas, the 10‑stage lifecycle with **scenarios + user stories + options**,
  exceptional paths, modules, AI layer, integrations, NFRs, glossary.
- [`docs/product/RULES.md`](docs/product/RULES.md) — **binding product/domain/engineering
  rules (R‑01 … R‑16)**. Read before building any feature touching the lifecycle, roles,
  workflow, AI, or integrations.

Key binding rules (see `RULES.md` for the full set): every state change is a **gated,
audited workflow transition** (R‑01/02); **HITL is mandatory** for any impactful AI
output, with explainability (R‑03); **RBAC** with the CDM default‑access rule (R‑04);
**BR‑01** (configurable 5M‑SAR technical/financial doc split) and **BR‑02** (supply vs
maintenance commencement branch); Etimad/Nafath/MoF are the **source of truth** (R‑08);
official correspondence needs a **reference number** (R‑09); **KSA data residency** +
**multi‑tenant isolation** (R‑10/11); **bilingual AR(RTL)/EN** everywhere (R‑12). New
work ties to a requirement ID `FR-WF/EX/FT/CM/CT/HM/AI/V30` and the single domain model
(R‑14/15).

## Repository shape

This is the **`tanfeeth` meta-repo**. It contains almost no code of its own — the two
applications are git submodules, and this repo's job is to pin their commits and hold
the deploy stack:

- `frontend/` → submodule `tanfeeth-frontend` — Next.js 16 app + admin portal
- `backend/`  → submodule `tanfeeth-api` — NestJS 11 API (hexagonal, dynamic RBAC)
- `deploy/`   → lives in this repo — Docker Compose stacks, nginx, CI/CD, server bootstrap

When you change app code you are editing **inside a submodule**. Committing there updates
that submodule's own repo; the pointer in this meta-repo only moves when you `git add backend`/
`git add frontend` here and commit (the recent meta-repo history is all "bump submodule" commits).
Each submodule has its own `AGENTS.md` / `CLAUDE.md` with binding rules — **read them before
editing that submodule.**

## Commands

Backend (`cd backend`):
```bash
docker compose up -d        # Postgres on :5432 (required for the API)
npm run start:dev           # watch mode; seeds base perms + admin on first boot
npm run build               # nest build → dist/
npm run lint                # eslint --fix
npm test                    # jest (unit; *.spec.ts under src/)
npm test -- auth/login      # run a single test by path/name match
npm run test:e2e            # jest with test/jest-e2e.json
```
API runs under the global `/api` prefix; Swagger UI at `/docs`, JSON at `/docs-json`.

Frontend (`cd frontend`):
```bash
npm run dev                 # next dev
npm run build               # next build (output: "standalone")
npm run lint                # eslint
```

## Backend architecture (authoritative rules in `backend/AGENTS.md`)

Modular monolith with **hexagonal (ports & adapters)** layering. The one rule that drives
everything: **dependencies point inward** — `infrastructure → application → domain`, and the
domain depends on nothing.

Each module is `src/modules/<name>/{domain,application,infrastructure}` plus `<name>.module.ts`:
- `domain/` — pure: entities, `*.errors.ts` (extend `DomainError`), and **outbound ports**
  (`*.repository.ts` / `*.port.ts` = interface + a `Symbol` token). Zero framework imports.
- `application/` — one `*.use-case.ts` per use case, depends only on domain + ports. Only `@Injectable`/`@Inject` allowed.
- `infrastructure/` — the *only* layer touching Nest/TypeORM/HTTP: `http/` (controllers, class-validator DTOs, guards), `persistence/` (`*.orm-entity.ts` + `*.mapper.ts` + `typeorm-*.repository.ts`), `adapters/`.

Cross-module rules: a module talks to another **only through an exported port token** — never
import another module's ORM entities/repos/controllers. Contracts that would cause an import
cycle live in `src/shared/` (e.g. `PermissionChecker` port: `rbac` implements it, `auth`'s guard
consumes it). Repositories return **domain entities**, never ORM rows (mapped via `*.mapper.ts`).
Domain code never throws HTTP exceptions — throw a `DomainError` with a stable `code`, which
`shared/infrastructure/http/domain-exception.filter.ts` maps to an HTTP status (register new codes there).
Current modules: `users`, `rbac`, `auth`, `contracts`, `access-control`, `seed`.

When adding a feature, follow the checklist in `backend/AGENTS.md` §7 (model domain → use cases
→ adapters → wire tokens in the module → DTOs + `@Auth(...)` + new permission keys → new error codes).

## Auth & RBAC (spans both apps)

- Access = stateless **JWT** (`Authorization: Bearer`). Refresh = **opaque random token stored
  only as a SHA-256 hash**, rotated on every use. Passwords hashed with **Argon2id**.
- Authorization is **permission-based with runtime-created roles**: effective permissions = union
  of a user's roles' permission keys. Keys are dotted lowercase `resource.action` (`users.read`).
- Backend: protect routes with `@Auth(...permissionKeys)` (`@Auth()` = authenticated only);
  read the principal with `@CurrentUser()`. New permission keys go in the seed catalog **and** are
  created via the permissions API/migration.
- Frontend mirrors this: gate UI with `features/auth` `Can`/`AuthGate`/`AdminGate` components.

## Frontend architecture

Next.js **16** (App Router, React 19) — note `frontend/AGENTS.md`: this Next version has breaking
changes vs. older docs; consult `node_modules/next/dist/docs/` before writing framework code.

- **Routing is i18n'd**: every route lives under `src/app/[locale]/...` with `localePrefix: "always"`
  (locales `en`/`ar`, see `lib/i18n/routing.ts`). Use the `next-intl` navigation helpers (`Link`,
  `useRouter`, `redirect`) from `lib/i18n/routing.ts`, **not** `next/link` / `next/navigation`.
  The UI is **Arabic / RTL-first** — use logical (RTL-aware) spacing.
- Route groups: `[locale]/(website)` (marketing), `/auth/*`, `/portal/*` (user portal),
  `/admin-portal/*` (roles/permissions/users admin). Centralized URL builders in `config/paths.ts`.
- **Feature modules** in `src/features/<name>/` (`auth`, `contracts`, `admin`) hold that feature's
  hooks, stores, components, schemas. Shared UI is `components/ui` (shadcn) + `shared/form`.
- **Data layer**: all HTTP goes through `lib/api/` — typed helpers in `endpoints.ts` call `apiFetch`
  in `client.ts` (a shared axios instance). The client auto-attaches the bearer token and does
  **single-flight refresh-and-retry on 401**, normalizing errors to `ApiError`. Pass `auth: false`
  for public endpoints. Server state is React Query (`useQuery`/`useMutation` in `features/*/hooks.ts`,
  with `queryClient.invalidateQueries` on mutation success).
- **Auth session** is a persisted Zustand store (`features/auth/store/useAuthStore.ts`, key
  `tanfeeth-auth`), read outside React via `useAuthStore.getState()` inside the API client.
- **Design system**: Tailwind v4 with `@theme` tokens defined in `src/app/globals.css` (shadcn/ui
  components in `components/ui`). Use the CSS-var tokens / Tailwind classes, not raw hex. Portal
  dashboards must follow `frontend/design.md`: flagship operating-system feel, Stripe-inspired
  interaction density, Apple-like restraint, Spotify-like dark command panels, RTL polish, and no
  generic flat admin-card layouts.

## Deploy (`deploy/`, details in `deploy/README.md`)

Single Docker host (`76.13.251.17`) with one nginx edge proxy fronting isolated **prod** and
**staging** stacks (`docker-compose.{proxy,prod,staging}.yml`), TLS via Let's Encrypt. CI/CD lives
in each app repo (`.github/workflows/ci-cd.yml`): push to `staging`/`main` builds a `:staging`/`:prod`
image, pushes to GHCR, and deploys via **self-hosted runners** on the host against `/opt/tanfeeth`.
Secrets (`.env.prod`/`.env.staging`) are generated on the host and never committed.

## Conventions

- Files `kebab-case`; classes `PascalCase`; backend port tokens `SCREAMING_SNAKE` `Symbol`; one
  use case per file named `<Verb><Noun>UseCase`.
- Backend config is validated at boot (`config/env.validation.ts`) — add new env vars there or the
  app refuses to start. TypeORM `synchronize` is on **only** outside production; prod uses migrations.
- No Claude/AI co-author trailers in commits or PRs. No emoji in frontend UI — use Lucide icons.
- **Frontend i18n is mandatory** — never hardcode user-facing text. Every string goes in both
  `frontend/src/messages/{ar,en}/<namespace>.json` and is read via `useAppTranslation` /
  `getAppTranslation` + `t("key")` (ICU interpolation for dynamic values). Applies to portal/admin
  code too. See `frontend/AGENTS.md`.
- **Frontend feature architecture** — keep `src/features/<name>/` split by concern: `api.ts`,
  `hooks/` (one React Query hook per file), `components/`, `forms/` (self-contained forms), `schemas/`,
  `mappers.ts`, `types`. One unit per file; never inline a form/hook/component into a page or a
  monolithic barrel. `contracts/` is the reference. Pages stay thin. See `frontend/AGENTS.md`.
- **Product/domain rules are binding** — any feature touching the procurement lifecycle,
  roles, workflow, AI, or government integrations must follow `docs/product/RULES.md`
  (R‑01 … R‑16) and map to the single domain model in `docs/product/PRODUCT.{en,ar}.md`.
  Don't invent parallel roles/statuses/flows; tie work to an `FR-*` requirement ID.
