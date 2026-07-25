# ISSUE-06 — Buyer block + Consignee toggle + tax-type auto-suggestion

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

Editable Buyer (Bill to) block, a "Shipping same as billing" toggle that exposes a separate Consignee (Ship to) block, and tax-type auto-suggestion driven by seller-state vs buyer-state.

- Buyer block: editable name, address, GSTIN/UIN, state name & code. Both Consignee and Buyer blocks render in the preview exactly like the existing PDF two-block layout.
- "Shipping same as billing" toggle (on by default). When off, a separate Consignee block becomes editable (name/address/GSTIN/state); when on, the Consignee block mirrors the Buyer block in the preview.
- **Tax-type auto-suggestion:** the backend compute service compares the seller's state (from the selected entity, both presets are Karnataka 29) to the buyer's state. Same state → suggest `CGST_SGST`; different state → suggest `IGST`. The suggestion pre-fills the tax-type toggle; the user can override. Place of Supply = buyer state code, displayed in the controls panel and in the preview.
- Backend must handle the **IGST path** (full GST rate as a single line, no CGST/SGST split) in addition to the CGST+SGST path implemented in ISSUE-03. When `taxType` is overridden, compute uses the override.
- Frontend re-runs `/invoices/compute` on buyer-state change (debounced) so the suggested tax type and totals recompute.

## Acceptance criteria

- [ ] Entering buyer name/address/GSTIN/state renders the Buyer (Bill to) block in the preview matching the Flatworld two-block layout.
- [ ] With "Shipping same as billing" on, the Consignee block mirrors the Buyer block in the preview; switching it off exposes an editable Consignee block and renders it separately.
- [ ] For a Karnataka seller and a Karnataka buyer, the tax type is suggested as `CGST_SGST` (9+9 for 18%) and the preview shows OUTPUT CGST + OUTPUT SGST.
- [ ] For a Karnataka seller and a non-Karnataka buyer, the tax type is suggested as `IGST` (18% single line) and the preview shows OUTPUT IGST only — no CGST/SGST.
- [ ] The user can override the suggested tax-type toggle, and the preview recomputes accordingly.
- [ ] Place of Supply (buyer state code) is shown in the controls panel and preview.
- [ ] `vitest` + `supertest` suite covers the IGST-full-rate path and the auto-suggestion logic (same-state vs different-state), in addition to ISSUE-03's CGST/SGST tests.

## Blocked by

- ISSUE-03 (draft reducer, compute endpoint, and preview must exist; ISSUE-01 provides the seller state codes via `GET /api/entities`).