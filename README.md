# 3Vikram Technologies CRM

A pnpm monorepo for the 3Vikram CRM: a React front end for sales, inventory and accounts, and an Express API. The API computes GST sale invoices and runs a double-entry accounting engine backed by PostgreSQL.

## Repository layout

```
crm/
├── frontend/          # React 19 + Vite 6 + Tailwind CSS 4 SPA  (package: 3vikram-technologies)
├── backend/           # Express 4 API on Node + TypeScript       (package: @crm/backend)
│   ├── src/accounting # Vouchers, maker-checker workflow, reports, auth
│   └── sql/           # Numbered SQL migrations
├── packages/shared/   # Zod schemas and types shared by both apps (package: @crm/shared)
└── docs/              # PRDs, issue specs, accounting design notes, reference invoices
```

## Prerequisites

- **Node.js** 20 or newer
- **pnpm** 11 (`corepack enable` or `npm install -g pnpm`)
- **PostgreSQL**. You only need it for the `/api/accounting/*` routes. Invoice computation and entity presets work without a database.

## Getting started

```bash
pnpm install
pnpm approve-builds          # only if pnpm warns about ignored esbuild build scripts

# The apps import @crm/shared from its dist/ folder, so build it first
pnpm --filter @crm/shared build

pnpm dev                     # starts frontend and backend in parallel
```

| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://127.0.0.1:3001   |
| Backend  | http://localhost:4000   |

The Vite dev server proxies `/api` to the backend on port 4000. If you edit `packages/shared`, run `pnpm --filter @crm/shared dev` in another terminal so its build stays up to date.

## Environment variables

The repository has no `.env` file. Set these variables in your shell, or in a `.env*.local` file (git ignores those).

| Variable | Used by | Required | Default | Purpose |
|----------|---------|----------|---------|---------|
| `DATABASE_URL` | backend (`src/db.ts`) | For accounting routes | none | PostgreSQL connection string. Without it, accounting routes return `503 DATABASE_UNAVAILABLE`. |
| `ACCOUNTING_AUTH_SECRET` | backend (`src/accounting/auth.ts`) | For accounting routes | none | HMAC-SHA256 secret used to verify bearer tokens. Without it, every accounting request returns 401. |
| `DB_POOL_SIZE` | backend (`src/db.ts`) | No | `10` | Maximum connections in the pg pool. |
| `PORT` | backend (`src/index.ts`) | No | `4000` | API listen port. If you change it, also update the proxy target in `frontend/vite.config.ts`. |
| `LOCALAPPDATA` / `TEMP` | frontend (`vite.config.ts`) | No | `frontend/` | Parent folder for Vite's `crm-vite-cache`. On Linux and macOS neither variable is usually set, so the cache goes in `frontend/crm-vite-cache/`. |

Example:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/crm
export ACCOUNTING_AUTH_SECRET=$(openssl rand -hex 32)
```

## Database

```bash
pnpm --filter @crm/backend db:migrate
```

This command applies the files in `backend/sql/` in order and records each one in a `schema_migrations` table. It must run from the `backend/` package (the `--filter` form above handles that). The first migration creates the legal entities, financial years FY 2025-26 and FY 2026-27, and a starter chart of accounts.

## Scripts

Run these from the repository root:

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Frontend and backend dev servers in parallel |
| `pnpm dev:frontend` / `pnpm dev:backend` | Start one of the dev servers |
| `pnpm build` | Build every package (`tsc` for backend and shared, `vite build` for frontend) |
| `pnpm test` | Run Vitest in every package |
| `pnpm --filter @crm/backend start` | Run the compiled backend from `dist/` |

## API overview

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/health` | Liveness probe |
| GET  | `/api/entities` | Seller entity presets |
| POST | `/api/invoices/compute` | Deterministic invoice math (tax, round-off, amount in words) |
| *    | `/api/accounting/...` | Needs `Authorization: Bearer <token>`. See below. |

The accounting routes are scoped by company. They cover companies, ledgers, vouchers (create → submit → approve → post, plus reverse), reports (trial balance, ledger, P&L, balance sheet) and migration jobs. A token is `base64url(JSON {id, role, exp})`, then `.`, then its HMAC-SHA256 signature. The backend only verifies tokens. Issuing them is the job of the login service. The roles, the workflow rules and the known gaps before go-live are in [docs/accounting-foundation.md](docs/accounting-foundation.md).

## Front-end modules

- **Sales**: dashboard, customers, leads, inventory, purchase orders, DC tracking, bill sale
- **Accounts**: sale invoice generator (Excel import, live preview, print to PDF), purchase invoice, journal register, bank payments, ledger, P&L, balance sheet, reports

Most Accounts screens other than the sale invoice still keep their data in the browser, separated by legal entity. They have not been moved to the authenticated accounting API yet.

## Further docs

- [docs/PRDs/sale-invoice-generator.md](docs/PRDs/sale-invoice-generator.md): sale invoice PRD
- [docs/PRDs/issues/](docs/PRDs/issues/): implementation issues ISSUE-01 to ISSUE-09
- [docs/accounting-foundation.md](docs/accounting-foundation.md): accounting engine, security and workflow
