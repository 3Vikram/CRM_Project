# Plan: move the Accounts module to PostgreSQL

Status: approved for implementation · Written 2026-09-22 · **Scope narrowed 2026-09-22: Accounts only, see note below**

> **Scope note:** this plan originally covered the Sales/CRM pages too (customers, leads, inventory, purchase orders, DC tracking, bill sale, dashboard). That is explicitly **out of scope**. Do not touch anything under `frontend/src/pages/` other than `frontend/src/pages/accounts/**`, and do not touch `frontend/src/components/` other than the `accounts/` subfolder and shared primitives you're only *reading*. The former "Phase 5: CRM" and the `/api/customers`, `/api/leads`, etc. endpoints and `005_crm.sql` migration described lower in earlier drafts of this doc are cancelled — this version has them removed.

## Goal

Every piece of data the **Accounts module** shows or edits lives in PostgreSQL and goes through the Express API. That covers the Accounts screens (purchase invoices, journal register/vouchers, bank payments, ledger, P&L, balance sheet, reports), the sale invoice generator and its drafts, and seller entity presets. Login is included because every accounting route requires a signed-in user. After this work, nothing in the Accounts module is stored in React component state or `localStorage` except per-browser preferences: the selected company and the login token.

The Sales CRM pages (dashboard, customers, leads, inventory, purchase orders, DC tracking, bill sale) and the standalone `/inventory` route are **not touched** by this plan.

## Decisions already made (do not revisit)

| Topic | Decision |
|---|---|
| Local Postgres | **Docker Compose** (`postgres:18`). The native Arch service stays off. |
| Auth | **Real login**: `users` table, scrypt-hashed passwords, `POST /api/auth/login`, a login page, and every `/api` route protected except `/api/health` and `/api/auth/login`. |
| Accounting workflow | **Keep the simple UI flow.** The UI's **Post** button creates, submits, approves and posts in one server transaction for `administrator`/`accountant`. The engine keeps maker-checker, behind a per-company flag that defaults to off. |
| Existing browser data | **One-time import**: an "Import browser data" action uploads the old `localStorage` accounting data once. |

## Current state (what has to change)

| Area | Where data lives today | File(s) |
|---|---|---|
| Accounts: purchase invoices, journal register, bank payments | `localStorage` key `crm-accounting-data-v2:<companyId>` | `frontend/src/lib/accounting.ts`, `frontend/src/components/accounts/accounting-context.tsx`, `frontend/src/pages/accounts/AccountingPages.tsx` |
| Accounts: ledger, P&L, balance sheet, reports | Computed in the browser from the above | `frontend/src/lib/accounting.ts`, `BalanceSheetPage.tsx`, `AccountingPages.tsx` |
| Chart of accounts | Hardcoded `CHART` (20 names) in the frontend. The DB seeds only 12 ledgers. | `frontend/src/lib/accounting.ts`, `backend/sql/001_accounting_foundation.sql` |
| Sale invoice draft | `localStorage` key `crm.sale-invoice.draft.v1` | `frontend/src/pages/accounts/sale-invoice/draft-context.tsx` |
| Issued sale invoices | Not saved anywhere. Print is the end of the flow, and `POST /api/invoices` returns 501. | `SaleInvoicePage.tsx`, `backend/src/routes/index.ts` |
| Seller entity presets | Hardcoded `ENTITIES` array | `backend/src/config/entities.ts` |

Out of scope, not touched: `CustomersPage.tsx`, `LeadsPage.tsx`, `InventoryPage.tsx`, `PurchaseOrdersPage.tsx`, `DCTrackingPage.tsx`, `BillSalePage.tsx`, `DashboardPage.tsx`, and everything else under `/sales/*` and the top-level `/inventory` route.

The backend already has a working PostgreSQL accounting engine: `backend/src/accounting/*` and `backend/sql/001_accounting_foundation.sql`. That includes companies, ledgers, vouchers with DB-enforced immutability and balance, audit events, reports, and migration job tables. **Build on it; don't replace it.**

## Conventions for all new code

- **Migrations** are new numbered files in `backend/sql/`, registered in the `migrations` array in `backend/src/migrate.ts`. Never edit `001_…sql`, because it may already be applied.
- **Validation:** zod schemas and TS types go in `packages/shared/src/` and are exported from `index.ts`. The backend `.parse()`s every request body and query. Rebuild shared (`pnpm --filter @crm/shared build`) after changing it.
- **Money** is `numeric(20,4)` in the DB and a decimal string in the API (reuse `MoneySchema`). Convert to and from `number` only in the UI. Reuse `backend/src/accounting/money.ts` for arithmetic.
- **SQL** is always parameterised (`$1`). Multi-statement writes use the existing `transaction()` helper in `service.ts`; move it to `backend/src/db.ts` so every module can share it.
- **Company scoping:** accounting and invoice tables carry `company_id` and every query filters on it.
- **Route style:** follow `backend/src/accounting/routes.ts`. One router per domain, mounted in `backend/src/routes/index.ts`, with errors passed to `next()`. Add a small `asyncHandler` wrapper so routes stop repeating try/catch.
- **Audit:** every create, update or delete on a business table writes an `audit_events` row through the existing `audit()` helper. `company_id` is currently `NOT NULL`, so make it nullable in migration 002 (auth events have no company).
- **Frontend data layer:** add `@tanstack/react-query`. There is one `apiFetch` in `frontend/src/lib/api.ts` that adds `Authorization: Bearer <token>`, and a 401 sends the user to `/login`. Each domain gets a hooks file (`frontend/src/lib/queries/<domain>.ts`) with `useX()` and `useCreateX()` style hooks that invalidate on success. Every page shows loading and error states.

## Target schema

### 002_auth_and_platform.sql
- `users(id uuid pk, email citext unique not null, name text not null, password_hash text not null, role text not null check in accountingRoles, active bool default true, created_at, last_login_at)`. Enable `citext`.
- `ALTER TABLE audit_events ALTER COLUMN company_id DROP NOT NULL`.
- `ALTER TABLE companies ADD COLUMN require_maker_checker boolean NOT NULL DEFAULT false`.
- `ALTER TABLE companies ADD COLUMN profile jsonb`, then backfill it from `backend/src/config/entities.ts`: address, state code and name, email, contact, MSME, CIN, invoice prefix, e-invoice default, bank. `GET /api/entities` then builds `Entity[]` from `companies`, and `config/entities.ts` is deleted.

### 003_accounting_documents.sql
- Seed the ledgers the UI uses but the DB lacks, for both companies, under the matching group: Vendor Advances (asset, current), Accrued Expenses (liability, current), Service Income, Other Income, Utilities Expense, Travel Expense, Professional Fees, Other Expenses, Retained Earnings (equity). Pick codes that fit the existing scheme and use `ON CONFLICT DO NOTHING`.
- `ALTER TYPE voucher_status ADD VALUE 'cancelled'` (for drafts only). Postgres doesn't allow a new enum value to be used in the same transaction that adds it, so do nothing else with `'cancelled'` in this file.
- `ALTER TABLE vouchers ADD COLUMN invoice_reference text`. This backs the journal register's "Invoice number" field; the existing `external_reference` holds "Reference".
- `purchase_invoices(id uuid, company_id, number, vendor, vendor_gstin, vendor_invoice_number, invoice_date, due_date, tax_mode text check in ('intra','inter','none'), notes, status text check in ('draft','posted','cancelled'), posted_voucher_id uuid, legacy_client_id text, created_by, created_at, updated_at)`, with:
  - a partial unique index on `(company_id, lower(number)) WHERE status <> 'cancelled'`
  - a partial unique index on `(company_id, lower(vendor), lower(vendor_invoice_number)) WHERE status <> 'cancelled'`
  - a unique index on `(company_id, legacy_client_id)`
- `purchase_invoice_lines(id, company_id, purchase_invoice_id, line_number, description, quantity numeric, rate numeric(20,4), gst_rate numeric(5,2), ledger_id uuid)`.
- `bank_payments(id uuid, company_id, number, payment_date, payee, bank_ledger_id uuid, category_ledger_id uuid null, linked_purchase_invoice_id uuid null, mode, reference, amount numeric(20,4) check > 0, narration, clearance text check in ('Pending','Cleared'), status text check in ('draft','posted','cancelled'), posted_voucher_id uuid, legacy_client_id text, created_by, created_at, updated_at)`. It needs either `category_ledger_id` or `linked_purchase_invoice_id`, enforced by a CHECK.
- Add a unique index on `vouchers(company_id, source_type, source_id)` where `source_type IN ('legacy_browser')`, so the import can't create duplicates.
- Add `document_sequences(company_id, financial_year_id, doc_type, next_number)` for server-assigned bank payment numbers (`BP-0001`).

### 004_sales_invoices.sql
- `sales_invoices(id uuid, company_id, invoice_number, invoice_date, buyer_name, buyer_gstin, status text check in ('issued','cancelled'), draft jsonb not null, computed jsonb not null, grand_total numeric(20,4), posted_voucher_id uuid, created_by, created_at)`, unique on `(company_id, invoice_number)`. `draft` stores the `InvoiceDraft`; `computed` stores the server-recomputed `ComputedInvoice` snapshot at the time the invoice is issued.
- `invoice_drafts(user_id uuid pk references users, draft jsonb not null, updated_at)`. There is one working draft per user, which replaces the `localStorage` draft.

## API surface

`/api/health` and `/api/auth/login` are public. Everything else sits behind `requireActor`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login {email,password}` → `{token, user}`. `GET /api/auth/me`. Tokens expire after 8h. Rate-limit failed logins in memory (5 per 15 minutes per email+IP). |
| Entities | `GET /api/entities` (now read from the DB) |
| Invoice compute | `POST /api/invoices/compute` (unchanged) |
| Sales invoices | `GET /api/invoices?companyId=`, `GET /api/invoices/:id`, `POST /api/invoices` (recompute on the server, store, post the sales voucher), `POST /api/invoices/:id/cancel` (reverse the voucher) |
| Invoice draft | `GET /api/invoice-draft`, `PUT /api/invoice-draft`, `DELETE /api/invoice-draft` |
| Accounting (existing, extended) | `GET …/ledgers`. Vouchers: add `GET …/vouchers?type=journal`, `PUT …/vouchers/:id` (drafts only, replaces lines), `POST …/vouchers/:id/post-direct`, `POST …/vouchers/:id/cancel` (drafts only). Existing reports and reverse stay. |
| Purchase invoices | `GET/POST …/companies/:companyId/purchase-invoices`, `GET/PUT …/:id` (drafts only), `POST …/:id/post`, `POST …/:id/cancel` (draft → cancelled; posted → reverse the voucher, then cancelled) |
| Bank payments | Same shape as purchase invoices, under `…/bank-payments`, plus `PATCH …/:id/clearance` (allowed while posted, because clearance is not a ledger field) |
| Import | `POST …/companies/:companyId/import/browser` with the old `AccountingData` JSON |

**Role rules.** Any authenticated user can read. `auditor` and `read_only_management` get 403 on every write. Accounting writes keep the existing `allow(...)` role lists.

## Accounting engine changes

1. **`postDirect(pool, companyId, voucherId, actor)`** in `service.ts`. In one transaction it runs the submit, approve and post checks and updates, with these rules:
   - The maker≠approver rule is skipped only when `companies.require_maker_checker = false` **and** the actor is `administrator` or `accountant`.
   - It writes an extra audit event, `voucher.self_approved`.
   - Refactor `transitionVoucher` so both share the checks. Don't copy them.
2. **Document posting.** Posting a document builds its voucher lines, calls `createVoucher` and `postDirect` in the **same transaction**, then sets `status='posted'` and `posted_voucher_id` on the document. Change `createVoucher` and `transitionVoucher` to accept a `PoolClient` so they can join an outer transaction.
   - **Purchase invoice** (`voucher_type 'purchase'`):
     - Dr each line's ledger for quantity × rate
     - Dr Input GST for the total GST, if any
     - Cr Accounts Payable for the grand total
     - Reuse the `invoiceTotals` math; move it to `packages/shared` so the UI preview and the server agree.
   - **Bank payment** (`'payment'`): Dr Accounts Payable when linked to an invoice, otherwise Dr the category ledger. Cr the bank or cash ledger.
   - **Sales invoice** (`'sales'`):
     - Dr Accounts Receivable for the grand total
     - Cr Sales Income for the taxable value
     - Cr Output GST for CGST+SGST+IGST
     - Put round-off into Other Income or Other Expenses so the voucher balances.
     - Voucher date is the invoice date, and the invoice number goes in `external_reference`.
3. **Outstanding and payment status** for purchase invoices are computed in SQL: the invoice total minus posted, linked bank payments. Return them on the list endpoint so the UI stops computing them.
4. **Reports.** The UI's ledger view shows *source* and *party*. Extend `ledgerReport` to join each voucher to its source document (`source_type` / `source_id`) and return `source` and `party`. Trial balance, P&L and balance sheet already exist server-side. Match their response shapes to what the pages render, and change the page or the report when they differ; don't compute in the browser.

## Frontend changes

- **Auth:** `/login` page, an `AuthProvider` holding the token and user (token stored in `localStorage` key `crm-auth-token`), and a `RequireAuth` wrapper around every route in `App.tsx` except `/login`. Show the user name and a sign-out control in `top-bar.tsx`.
- **Accounting context:** keep `companyId`, `companyName` and `setCompanyId`, with the company still in `localStorage` because that's a per-browser preference. Load the company list from `GET /api/accounting/companies` instead of the hardcoded `ACCOUNTING_COMPANIES`. Remove `data` and `setData`; pages use query hooks.
- **`AccountingPages.tsx`:** replace every `setData({...})` with the matching mutation. Account pickers list ledgers from `GET …/ledgers` and store `ledgerId`. Voucher and bank payment numbers come from the server. "Cancel" on a posted entry calls reverse; show its status as Reversed or Cancelled.
- **`BalanceSheetPage.tsx` and the P&L, ledger and reports views** call the server report endpoints. CSV export still happens in the browser from the fetched rows.
- **Delete** `loadData`, `saveData`, `storageKey`, `emptyData`, `CHART`, `ledgerEntries`, `trialBalance`, `profitLoss` and `balanceSheet` from `frontend/src/lib/accounting.ts` once nothing uses them. Update `accounting.test.ts` to match. Keep pure helpers like `money`, `today` and `exportCsv`.
- **Sale invoice:**
  - `draft-context.tsx` autosaves to `PUT /api/invoice-draft`, debounced with the existing `useDebounced`. On first load, if the server has no draft and the old `localStorage` key exists, upload it and then remove the key.
  - Replace the **Print** button with **Issue & Print**. It calls `POST /api/invoices`, runs `window.print()` on success, and clears the draft.
  - Add a simple list of issued invoices under the page, or at `/accounts/sale-invoice/history`, with Cancel.

## One-time browser import

- The Accounts sidebar shows **Import browser data** only when `localStorage` has `crm-accounting-data-v2:<companyId>` and that key hasn't been marked imported.
- The server endpoint (roles `administrator`/`migration_operator`) runs in one transaction:
  1. Creates a `migration_jobs` row with `source_type='local_storage'` and `mode='full_history'`.
  2. Maps account **names** to ledger ids. Any unknown name fails the whole import with a list of the missing names.
  3. Inserts purchase invoices, vouchers and bank payments, with the old client `id` stored as `legacy_client_id` (vouchers use `source_type='legacy_browser'`, `source_id`=old id). That makes a re-run a no-op.
  4. Posts the posted ones with `postDirect`.
  5. Returns counts (created, skipped as already imported, failed).
- On success the client renames the key to `…:imported-<date>`. It doesn't delete it, so the old data can still be recovered.

## Implementation phases

Do them in order. Each phase ends with `pnpm test` and `pnpm build` passing and one commit on a new branch `feat/postgres-everywhere` created from the current branch. Don't mix phases in one commit.

**Phase 0: Infrastructure**
- Run `corepack enable`. pnpm is not on PATH right now.
- Add `docker-compose.yml` at the root:
  - service `db`, image `postgres:18`, host port **5433**:5432
  - named volume `crm-pgdata`
  - healthcheck
  - an init script in `docker/postgres/init/` that creates a second database `crm_test`
- Add `.env.example`:
  ```
  DATABASE_URL=postgres://crm:crm@localhost:5433/crm
  TEST_DATABASE_URL=postgres://crm:crm@localhost:5433/crm_test
  ACCOUNTING_AUTH_SECRET=change-me
  PORT=4000
  ```
- Add `.env` and `frontend/crm-vite-cache/` to `.gitignore`.
- Load `backend/.env` automatically: change the backend `dev`, `db:migrate` and `start` scripts to `node --env-file-if-exists=.env …`, or `tsx --env-file-if-exists=.env …` for `dev` and `db:migrate`.
- Root scripts: `db:up` (`docker compose up -d --wait db`), `db:down`, `db:migrate`, `db:seed`, `db:reset` (drop and recreate the schema, then migrate and seed; refuse to run unless `DATABASE_URL` points at localhost).
- `backend/src/seed.ts` is **dev-only** and idempotent. It creates the admin user from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. (No CRM seed data — that module is out of scope.)
- Fix `pnpm-workspace.yaml` by setting `allowBuilds.esbuild: true`; it currently holds a placeholder string.
- Done when `pnpm db:up && pnpm db:migrate` works on a fresh volume, and running `db:migrate` a second time is a no-op.

**Phase 1: Auth**
- Migration 002 (the users part).
- Move `backend/src/accounting/auth.ts` to `backend/src/auth/`. It keeps the token format and `signAccountingAccessToken`, renamed `signAccessToken`.
- Add a scrypt password hash/verify helper using `node:crypto`; no new dependency.
- Add the auth routes, and apply `requireActor` to all `/api` routes except the public ones.
- Add a CLI `pnpm --filter @crm/backend user:create --email … --name … --role …` that prompts for the password.
- Add the frontend login page, `AuthProvider`, `RequireAuth` and the `apiFetch` 401 handling.
- Update existing backend tests that call protected routes (`entities.test.ts`, `invoices.compute.test.ts`) to send a signed test token.

**Phase 2: Accounting backend**
- Rest of migration 002 (companies columns and entity profile) and migration 003.
- Move `transaction` to `db.ts`, and make `createVoucher` and `transitionVoucher` client-aware.
- Add `postDirect`, the purchase invoice and bank payment services and routes, the voucher draft update and cancel, ledger report source and party, and the `/entities` DB read.
- Add integration tests (see Testing).

**Phase 3: Accounting frontend**
- Add React Query and the hooks.
- Rewrite the context, `AccountingPages.tsx` and `BalanceSheetPage.tsx` on the API.
- Delete the browser storage and report code.

**Phase 4: Sales invoices**
- Migration 004.
- Draft endpoints, issue with sales voucher posting, cancel, history list.
- Update `draft-context.tsx` and `SaleInvoicePage.tsx`.

**Phase 5: Browser import**
- Endpoint, sidebar action, tests. Include a re-run that must be a no-op.

**Phase 6: Docs and cleanup**
- Update root `README.md`: DB setup, login, the `user:create` CLI and the new env vars.
- Update `docs/accounting-foundation.md`: `postDirect` and `require_maker_checker`.
- Update or replace the outdated `frontend/README.md`.
- Remove the 501 invoice stubs.
- Grep the code for `localStorage`. The only allowed hits are the auth token, the selected company, and the import and draft-migration code.

## Testing

- **Backend integration tests** run against `TEST_DATABASE_URL` with Vitest and supertest. A global setup migrates `crm_test` once, and each test file truncates the tables it uses. Use `describe.skipIf(!process.env.TEST_DATABASE_URL)` so `pnpm test` still passes on machines without Docker.
- **Must-have cases:**
  - login succeeds and fails, and the rate limit triggers
  - every protected route returns 401 without a token
  - read-only roles get 403 on writes
  - posting a purchase invoice produces a balanced posted voucher, and the trial balance reflects it
  - a posted document can't be edited (409); cancelling a posted document creates a reversal and the balances net to zero
  - with `require_maker_checker=true`, `postDirect` fails with `MAKER_CHECKER_REQUIRED`
  - duplicate purchase invoice number gives 409
  - bank payment linked to an invoice changes its outstanding amount and payment status
  - issuing a sale invoice stores the computed snapshot and posts AR, Sales and Output GST; a duplicate invoice number gives 409
  - running the browser import twice creates each record once
  - an unknown account name makes the import fail with nothing written
- **Frontend:** keep the existing Vitest tests green, and add tests for any pure mapping helpers you create.
- **Manual smoke test** at the end, and report the results:
  1. `pnpm db:reset`, create a user, `pnpm dev`, log in.
  2. Create and post one of each accounting document.
  3. Check that the balance sheet balances.
  4. Issue a sale invoice.

## Things to watch

- `ALTER TYPE … ADD VALUE` can't be used in the same transaction that adds it (the migration runner wraps each file in `BEGIN`/`COMMIT`). Keep the enum change in its own file if anything else needs it.
- The `immutable_posted_lines` trigger fires on **INSERT** too, so voucher lines must be inserted while the voucher is still `draft`. `createVoucher` already does this, so keep that order in document posting.
- `financial_years` are seeded only for FY 2025-26 and 2026-27. Any posting outside those years fails `validatePostingContext`. Surface that error clearly in the UI; don't auto-create years.
- The `frontend/src/index.css` change was already uncommitted before this work. Don't include it in phase commits unless it belongs to them.
- Don't change maker-checker behaviour beyond the `require_maker_checker` flag, and don't weaken the DB triggers.
