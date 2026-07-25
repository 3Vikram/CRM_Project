# ISSUE-05 — Seller selection from `COMPANY` + mixed-company warning + seller/bank/remarks defaults

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

Drive the seller legal entity from the `COMPANY` column of the dropped rows, surface a correctness guard against mixed-entity drops, and have the chosen seller preset fill the header/bank/remarks/number-prefix automatically.

- After ingestion, the draft's `sellerId` is auto-set from the **majority** `COMPANY` value across the dropped rows (`SYNOV` → SYNOV IT Services, `3VIKRAM` → 3Vikram Technologies). The controls panel shows the Seller field, editable to override.
- If the dropped rows contain **mixed `COMPANY`** values, show a clear warning and require the user to split into two invoices before computing — one GSTIN cannot bill another entity's rentals in a single GST invoice. This is a hard correctness rule; compute is blocked while mixed.
- The selected seller fills the preview header (name, address, GSTIN/UIN, PAN, email, contact, MSME no.), the Bank Details footer block (holder, bank name, account no, branch & IFSC), the Remarks default ("Being Rental Invoice Raised for the Month of {billingMonth} ({seller short name})"), and the suggested invoice-number prefix (`3VT/__/2026-27` for 3Vikram, `SISPL/__/25-26` for SYNOV). All from `GET /api/entities` (ISSUE-01).
- Per-invoice edits to any of these fields stay on the invoice; they **do not mutate** the backend preset. (Generator-only v1 has no preset editing anyway.)
- Invoice number is **manual**; the prefix is suggested from the preset and the user fills the running number.

## Acceptance criteria

- [ ] Dropping a workbook whose rows are all `3VIKRAM` auto-selects 3Vikram Technologies; all-`SYNOV` auto-selects SYNOV IT Services; the seller field is editable to override either.
- [ ] Dropping a workbook containing both `3VIKRAM` and `SYNOV` rows shows a warning that mixed companies cannot be billed in one invoice and **blocks** `POST /api/invoices/compute` (no preview totals) until the user resolves the split.
- [ ] The preview header renders the selected seller's name, address, GSTIN/UIN, PAN, email, contact, and MSME no. from the preset; editing fields in the controls panel updates the preview without changing the backend preset.
- [ ] The Bank Details footer block renders from the preset, and the Remarks field defaults to "Being Rental Invoice Raised for the Month of {billingMonth} ({seller short name})".
- [ ] The invoice-number input shows the seller's suggested prefix (`3VT/` or `SISPL/`); the user types the running number. (Manual numbering; auto-number is v2.)
- [ ] Switching the seller selector re-fills the header/bank/remarks/prefix from the new preset.

## Blocked by

- ISSUE-03 (preview, compute endpoint, draft reducer, and entity fetch must exist).