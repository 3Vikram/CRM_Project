# Accounting foundation

This repository contains the production-facing accounting slice: company-isolated PostgreSQL books, immutable double-entry vouchers, an optional maker-checker workflow, reversals, audit events, core statements, and migration staging tables. Every Accounts screen (sale invoice, purchase invoice, journal register, bank payments, ledger, P&L, balance sheet, reports) is backed by this engine — see [docs/plans/postgres-migration.md](plans/postgres-migration.md) for how that migration was carried out and why specific choices were made.

## Configure and migrate

Copy `.env.example` to `.env` at the repo root and set at least:

- `DATABASE_URL`: PostgreSQL connection string.
- `ACCOUNTING_AUTH_SECRET`: a strong secret used to sign and verify login access tokens.
- `DB_POOL_SIZE`: optional pool size; defaults to 10.

Then run, from the repo root:

```bash
pnpm db:up        # starts Postgres via Docker Compose (or point DATABASE_URL at your own instance)
pnpm db:migrate    # applies backend/sql/*.sql in order
pnpm db:seed       # creates the first admin user from SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD
```

`pnpm db:reset` drops and recreates the schema, then migrates and seeds again — it refuses to run unless `DATABASE_URL` points at localhost.

The first migration creates both legal entities, FY 2025-26 and FY 2026-27, and a starter chart of accounts. Later migrations add the ledgers the UI needs beyond that starter set, the `users` table, and the purchase-invoice/bank-payment/sale-invoice document tables. Production GST/PAN details, financial years, period locks, and Schedule III mappings still require accountant review before go-live.

## Login and the security boundary

Every `/api` route requires a signed bearer token except `GET /api/health` and `POST /api/auth/login`. Log in with `POST /api/auth/login {email, password}` to get one; the frontend's `/login` page does this for you and stores the token.

The token payload is `{ "id": "user-id", "role": "accounting-role", "exp": unixSeconds }`, encoded as base64url and signed with HMAC-SHA256 using `ACCOUNTING_AUTH_SECRET`. Tokens expire after 8 hours. Failed logins are rate-limited in memory (5 per 15 minutes per email+IP).

Supported roles are `administrator`, `accountant`, `maker`, `approver`, `auditor`, `read_only_management`, and `migration_operator`. Create additional users with:

```bash
pnpm --filter @crm/backend user:create --email jane@example.com --name "Jane Doe" --role accountant
```

It prompts for the password on stdin, so it never ends up in shell history. `auditor` and `read_only_management` can read everything but get 403 on every write.

## Posting workflow

The full workflow is:

1. `POST /api/accounting/companies/:companyId/vouchers`
2. `POST .../:voucherId/submit`
3. `POST .../:voucherId/approve` — a voucher's maker cannot approve their own voucher
4. `POST .../:voucherId/post`
5. For corrections, `POST .../:voucherId/reverse`

Each company has a `require_maker_checker` flag (defaults to `false`). When it's off, `administrator`/`accountant` can skip straight to posting with **`POST .../:voucherId/post-direct`**, which runs submit+approve+post in one transaction — this is what the Accounts UI's single "Post" button uses, and what purchase invoices, bank payments and sale invoices use internally when *they* post (see `createAndPostVoucherOnClient` in `backend/src/accounting/service.ts`). Turn `require_maker_checker` on for a company to require the full four-step flow from everyone, including administrators.

Amounts are decimal strings with up to four decimal places. The service and database both enforce company ownership and debit/credit equality. Posted headers and lines cannot be edited or deleted — a draft voucher that was never posted can instead be deleted outright (`POST .../:voucherId/cancel`), since it never had a ledger effect to reverse. Reports read only posted voucher lines.

Opening balances use the same endpoint with `voucherType: "opening"`. Only eligible ledgers are accepted; use of Migration Clearing requires an explanatory narration and the normal maker-checker workflow.

## Documents built on the voucher engine

- **Purchase invoices** (`backend/src/accounting/purchaseInvoices.ts`): draft → post → cancel. Posting debits each line's ledger and Input GST (if any), and credits Accounts Payable. `outstanding`/`paymentStatus` are computed in SQL from linked, posted bank payments.
- **Bank payments** (`backend/src/accounting/bankPayments.ts`): debits Accounts Payable (if linked to an invoice) or a category ledger, credits the bank/cash ledger.
- **Sale invoices** (`backend/src/accounting/salesInvoices.ts`): always recomputes the draft server-side (via the same `computeInvoice` used by `POST /api/invoices/compute` — a client-sent total is never trusted) before posting Accounts Receivable / Sales Income / Output GST, with any round-off difference going to Other Income or Other Expenses so the voucher balances.

All three follow the same draft → post → cancel shape: cancelling a draft just deletes it (nothing was posted yet); cancelling a posted document reverses its voucher.

## Reports and migration

Company-scoped routes provide Trial Balance, Ledger (with source document and party joined in), Profit & Loss, and comparative Balance Sheet — all read by the frontend directly, with no client-side recomputation. Migration jobs and raw/normalized staging, mappings, errors, lineage fields, and reconciliation rows are represented in the schema; job creation/listing is exposed by the API, and a one-time import of the pre-migration browser localStorage data is available from the Accounts sidebar (`backend/src/accounting/browserImport.ts`) — idempotent, so re-running it is safe. Parsing adapters for other source systems, a mapping UI, commit batches, and safe rollback dependency analysis remain future work.
