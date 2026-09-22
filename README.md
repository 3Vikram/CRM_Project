# 3Vikram Technologies CRM

A pnpm monorepo for the 3Vikram CRM: a React front end for sales, inventory and accounts, and an Express API. The Accounts module — sale invoices, purchase invoices, journal register, bank payments, ledger, P&L and balance sheet — is backed end-to-end by PostgreSQL and requires login. The Sales/CRM pages (dashboard, customers, leads, inventory, purchase orders, DC tracking, bill sale) are a separate, unauthenticated part of the app that still keeps its data in memory or hardcoded — see [docs/plans/postgres-migration.md](docs/plans/postgres-migration.md) for the migration that built the Accounts module and why it stopped there.

## Repository layout

```
crm/
├── frontend/          # React 19 + Vite 6 + Tailwind CSS 4 SPA  (package: 3vikram-technologies)
├── backend/           # Express 4 API on Node + TypeScript       (package: @crm/backend)
│   ├── src/accounting # Vouchers, documents, reports, maker-checker workflow
│   ├── src/auth       # Login, password hashing, tokens
│   └── sql/           # Numbered SQL migrations
├── packages/shared/   # Zod schemas and types shared by both apps (package: @crm/shared)
├── docker-compose.yml # Local Postgres for development
└── docs/              # PRDs, issue specs, accounting design notes, reference invoices
```

## Prerequisites

- **Node.js** 20 or newer
- **pnpm** 11 (`corepack enable` or `npm install -g pnpm`)
- **Docker**, for the local Postgres in `docker-compose.yml` — or point `DATABASE_URL` at any Postgres instance you already have.

## Getting started

```bash
pnpm install
pnpm approve-builds          # only if pnpm warns about ignored esbuild build scripts
cp .env.example .env         # then set SEED_ADMIN_PASSWORD and ACCOUNTING_AUTH_SECRET

# The apps import @crm/shared from its dist/ folder, so build it first
pnpm --filter @crm/shared build

pnpm db:up                   # starts Postgres (docker compose)
pnpm db:migrate
pnpm db:seed                 # creates the admin user from .env

pnpm dev                     # starts frontend and backend in parallel
```

| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://127.0.0.1:3001   |
| Backend  | http://localhost:4000   |

Open the frontend and sign in at `/login` with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` to reach the Accounts module. The Sales module at `/sales/*` needs no login.

The Vite dev server proxies `/api` to the backend on port 4000. If you edit `packages/shared`, run `pnpm --filter @crm/shared dev` in another terminal so its build stays up to date.

## Environment variables

Copy `.env.example` to `.env` at the repo root — the backend loads it automatically (`db:migrate`, `db:seed`, `dev` and `start` all read it via `node --env-file-if-exists`).

| Variable | Used by | Required | Default | Purpose |
|----------|---------|----------|---------|---------|
| `DATABASE_URL` | backend (`src/db.ts`) | For any Accounts route | none | PostgreSQL connection string. Without it, Accounts routes return `503 DATABASE_UNAVAILABLE`; the rest of the API (health, entities, invoice compute) still works. |
| `ACCOUNTING_AUTH_SECRET` | backend (`src/auth/token.ts`) | For login and the Accounts module | none | HMAC-SHA256 secret used to sign and verify bearer tokens. Without it, login fails and every request returns 401. |
| `DB_POOL_SIZE` | backend (`src/db.ts`) | No | `10` | Maximum connections in the pg pool. |
| `PORT` | backend (`src/index.ts`) | No | `4000` | API listen port. If you change it, also update the proxy target in `frontend/vite.config.ts`. |
| `TEST_DATABASE_URL` | backend integration tests | For `pnpm test` to exercise a real database | none | A second database (`crm_test` in `docker-compose.yml`) the integration test suite migrates and truncates. Tests that need it are skipped, not failed, when it's unset. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `pnpm db:seed` | For `db:seed` | none | Creates the first `administrator` user. Change the password after first login in a shared environment. |
| `LOCALAPPDATA` / `TEMP` | frontend (`vite.config.ts`) | No | `frontend/` | Parent folder for Vite's `crm-vite-cache`. On Linux and macOS neither variable is usually set, so the cache goes in `frontend/crm-vite-cache/`. |

## Database

```bash
pnpm db:up        # docker compose up -d --wait db
pnpm db:migrate   # applies backend/sql/*.sql in order, tracked in schema_migrations
pnpm db:seed      # dev-only, idempotent: creates the admin user
pnpm db:down      # stops the container
pnpm db:reset     # drops and recreates the schema, then migrates and seeds — refuses to run against a non-localhost DATABASE_URL
```

The first migration creates both legal entities, financial years FY 2025-26 and FY 2026-27, and a starter chart of accounts; later migrations add users/login, the rest of the chart of accounts, the purchase-invoice/bank-payment/sale-invoice document tables, and scope voucher numbering to the financial year (so `PURCHASE-000001` can recur in each new year without colliding with a prior year's). See [docs/accounting-foundation.md](docs/accounting-foundation.md) for the full schema and workflow.

Add a user beyond the seeded admin with:

```bash
pnpm --filter @crm/backend user:create --email jane@example.com --name "Jane Doe" --role accountant
```

## Scripts

Run these from the repository root:

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Frontend and backend dev servers in parallel |
| `pnpm dev:frontend` / `pnpm dev:backend` | Start one of the dev servers |
| `pnpm build` | Build every package (`tsc` for backend and shared, `vite build` for frontend) |
| `pnpm test` | Run Vitest in every package (backend integration tests skip themselves without `TEST_DATABASE_URL`) |
| `pnpm db:up` / `db:down` / `db:migrate` / `db:seed` / `db:reset` | See **Database** above |
| `pnpm --filter @crm/backend start` | Run the compiled backend from `dist/` |
| `pnpm --filter @crm/backend user:create` | Create a login user (prompts for the password) |

## API overview

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/health` | Liveness probe — public |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` — public |
| GET  | `/api/entities` | Seller entity presets (reads the database when configured, falls back to a static config otherwise) |
| POST | `/api/invoices/compute` | Deterministic invoice math (tax, round-off, amount in words) — doesn't need a database |
| GET/POST | `/api/invoices`, `POST /api/invoices/:id/cancel` | Issued sale invoices — issuing recomputes and posts a voucher |
| GET/PUT/DELETE | `/api/invoice-draft` | The signed-in user's one autosaved sale-invoice draft |
| *    | `/api/accounting/...` | Companies, ledgers, vouchers, purchase invoices, bank payments, reports, migration jobs, and the one-time browser-data import — all company-scoped |

Everything above except `/api/health` and `/api/auth/login` requires `Authorization: Bearer <token>`. A token is `base64url(JSON {id, role, exp})`, then `.`, then its HMAC-SHA256 signature, issued by `/api/auth/login` and good for 8 hours. The roles, the posting workflow (including when the single-click "Post" button is allowed vs. the full maker-checker flow), and the purchase-invoice/bank-payment/sale-invoice document lifecycle are in [docs/accounting-foundation.md](docs/accounting-foundation.md).

## Front-end modules

- **Sales** (`/sales/*`, no login): dashboard, customers, leads, inventory, purchase orders, DC tracking, bill sale. Data is in-memory/hardcoded; not covered by this migration.
- **Accounts** (`/accounts/*`, requires login): sale invoice generator (Excel import, live preview, issue & print), purchase invoice, journal register, bank payments, ledger, P&L, balance sheet, reports. All of it reads and writes through the API in `backend/src/accounting`.

## Further docs

- [docs/PRDs/sale-invoice-generator.md](docs/PRDs/sale-invoice-generator.md): sale invoice PRD
- [docs/PRDs/issues/](docs/PRDs/issues/): implementation issues ISSUE-01 to ISSUE-09
- [docs/accounting-foundation.md](docs/accounting-foundation.md): accounting engine, security and workflow
- [docs/plans/postgres-migration.md](docs/plans/postgres-migration.md): the plan this Postgres migration followed
