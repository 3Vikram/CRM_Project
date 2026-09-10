# Accounting foundation

This repository now contains the first production-facing accounting slice: company-isolated PostgreSQL books, immutable double-entry vouchers, maker-checker workflow, reversals, audit events, core statements, and migration staging tables.

## Configure and migrate

Set these backend environment variables:

- `DATABASE_URL`: PostgreSQL connection string.
- `ACCOUNTING_AUTH_SECRET`: a strong secret used to verify short-lived accounting access tokens.
- `DB_POOL_SIZE`: optional pool size; defaults to 10.

Then run:

```powershell
pnpm --filter @crm/backend db:migrate
```

The initial migration creates both legal entities, FY 2025-26 and FY 2026-27, and a starter chart of accounts. Production GST/PAN details, financial years, period locks, roles, and Schedule III mappings still require accountant review before go-live.

## Security boundary

All `/api/accounting/*` routes require a signed bearer token. The token payload is `{ "id": "user-id", "role": "accounting-role", "exp": unixSeconds }`, encoded as base64url and signed with HMAC-SHA256 using `ACCOUNTING_AUTH_SECRET`. Token issuance belongs in the application login/session service; the backend only verifies it.

Supported roles are `administrator`, `accountant`, `maker`, `approver`, `auditor`, `read_only_management`, and `migration_operator`. Creation, approval, posting, reversal, and migration routes apply additional role checks. A voucher maker cannot approve their own voucher.

## Posting workflow

1. `POST /api/accounting/companies/:companyId/vouchers`
2. `POST .../:voucherId/submit`
3. `POST .../:voucherId/approve`
4. `POST .../:voucherId/post`
5. For corrections, `POST .../:voucherId/reverse`

Amounts are decimal strings with up to four decimal places. The service and database both enforce company ownership and debit/credit equality. Posted headers and lines cannot be edited or deleted. Reports read only posted voucher lines.

Opening balances use the same endpoint with `voucherType: "opening"`. Only eligible ledgers are accepted; use of Migration Clearing requires an explanatory narration and the normal maker-checker workflow.

## Reports and migration

Company-scoped routes provide Trial Balance, Ledger, Profit & Loss, and comparative Balance Sheet. Migration jobs and raw/normalized staging, mappings, errors, lineage fields, and reconciliation rows are represented in the schema; job creation/listing is exposed by the API. Parsing adapters, mapping UI, commit batches, and safe rollback dependency analysis remain subsequent delivery slices.

The existing Accounts screens remain browser-backed operational prototypes. Their storage is now separated by legal entity and visibly selected in the Accounts sidebar. They are not a substitute for the server posting engine and should be moved route-by-route to the authenticated API before statutory go-live.
