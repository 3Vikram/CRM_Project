# ISSUE-04 — Grouping + returned-row prorate + line discount

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

Two line-table features that edit how rows render and how returned units are billed:

1. **User-driven "Group identical" action.** A control collapses the non-returned rows whose `(MAKE, MODEL, PRICE)` all match into one "N Pcs @ PRICE" line, with each constituent unit's serial number, configuration, and rental `From`/`To` stacked as sub-lines beneath the group. `Configuration` is display-only and **never part of the grouping key** (it tends to drift by trim — WIN11 vs WIN11PRO, BOXPIECE present/absent). The user can switch back to flat.
2. **Returned rows never disappear into a group.** Any row carrying a `RETURNED` value stays as its own line so the return is always visible. A per-row **"Returned → prorate"** action computes `amount = returnedBillingRate × days(From → To)/30` (rounded to two decimals), then leaves the amount manually editable. `returnedBillingRate` is an invoice-level editable field, default ₹2,500.
3. **Per-line discount toggle** (off by default). When on, a Disc column appears on the line table and discounts apply before tax.

These are pure client-side line-table edits; they update the draft and the debounced `/invoices/compute` re-runs to refresh the preview. No backend schema changes beyond the discount already present on `LineItem` (added in ISSUE-03). Add backend compute support for per-line discounts (discount applies before tax; taxable value per line = `amount − discount`).

## Acceptance criteria

- [ ] Clicking "Group identical" collapses non-returned rows sharing `MAKE + MODEL + PRICE` into one "N Pcs" line that stacks each unit's serial, configuration, and From/To beneath the group; rows with differing `CONFIGURATION` for the same make/model/price still group (configuration is display-only).
- [ ] Rows whose `RETURNED` column is populated never appear inside a grouped line — they stay as individual lines with a visible "returned" marker.
- [ ] Switching back to flat re-expands the grouped rows to one line per laptop.
- [ ] "Returned → prorate" on a returned row sets that row's amount to `returnedBillingRate × days(From→To)/30` rounded to two decimals, using the invoice-level `returnedBillingRate` (default 2500); the resulting amount is manually editable.
- [ ] Per-line discount toggle (off by default): when on, a Disc column appears, and the preview's per-line taxable value becomes `amount − discount` (verified via the compute response).
- [ ] Tax/totals in the preview update (via `/invoices/compute`) whenever a row is grouped/ungrouped, a prorate is applied, or a discount is added.
- [ ] `vitest` + `supertest` suite covers the discounted-line tax computation on the backend.

## Blocked by

- ISSUE-03 (the line table, the draft reducer, the compute endpoint, and the preview must already exist).