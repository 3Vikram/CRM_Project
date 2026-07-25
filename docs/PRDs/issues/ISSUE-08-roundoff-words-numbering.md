# ISSUE-08 — Round-off + INR words (amount + tax) + manual numbering

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

The deterministic backend math that finishes the invoice totals, plus the manual invoice-number UI.

- **Round-off toggle.** Default **on**. When on, the backend compute service rounds the **invoice grand total** to the nearest ₹1 and emits a `Rounded Off ±x` line carrying the signed difference; the preview shows that line and the rounded grand total (matching the existing "Rounded Off (-)0.48" convention from the reference PDFs). Round-off applies at the **invoice total level**, not per line. When off, totals retain paise and the round-off line is suppressed.
- **INR number-to-words**, computed backend-side, for both "Amount Chargeable (in words)" (the grand total) and "Tax Amount (in words)" (total tax). Includes paise handling ("Rupees X and Paise Y only"). Deterministic and unit-tested — this is why number-to-words lives on the backend.
- The compute response (`ComputedInvoice` from ISSUE-03) gains: `roundOff` applied result, `roundedGrandTotal`, `amountInWords: string`, `taxInWords: string`. The preview renders all three from the response (no client-side math).
- **Manual invoice numbering.** The invoice number field is manual (per ISSUE-05 the seller prefix is suggested). This slice adds the visible suggested-prefix + running-number input on the controls panel and renders the full invoice number in the preview header.

## Acceptance criteria

- [ ] With round-off on, the preview shows a "Rounded Off ±x" line whose signed difference is the paise required to take the grand total to a whole ₹1, and the grand total shown is the rounded value.
- [ ] With round-off off, no round-off line renders and totals retain paise.
- [ ] "Amount Chargeable (in words)" renders the backend-computed INR words for the grand total including paise; mismatched words/totals should never be possible.
- [ ] "Tax Amount (in words)" renders the backend-computed INR words for total tax including paise.
- [ ] The invoice-number input shows the seller's suggested prefix and a running-number field; the resulting full invoice number renders in the preview header.
- [ ] Backend `vitest` suite covers: round-off edge cases (0.48 → -0.48, mid values, near-round), paise-inclusive number-to-words, and the round-off-then-words ordering (words describe the final rounded grand total, not the pre-round value).
- [ ] Frontend renders none of these computed values itself — all come from `POST /api/invoices/compute`.

## Blocked by

- ISSUE-03 (compute endpoint and `ComputedInvoice` response shape already exist; this slice fills in the round-off/words fields and the preview rows that render them).