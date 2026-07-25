# ISSUE-09 — PDF print + pagination + localStorage autosave + Reset

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

Output and resilience: turn the live preview into a printable A4 invoice, and keep the draft alive across refreshes.

- **Client-side print-to-PDF.** "Download PDF" in the top action bar opens the browser print dialog scoped to an A4 portrait print stylesheet that paginates the **existing preview DOM** (so the printed PDF always matches what the user sees; preview === PDF). No server-side PDF (v2).
- **Pagination:** line-items table flows and may break across multiple A4 pages, repeating the header row on each page; the entire summary footer block (OUTPUT CGST/SGST or OUTPUT IGST, Total, Amount Chargeable in words, Tax Analysis table, Tax Amount in words, Remarks, Bank Details, Declaration, signatory) is kept together via `break-inside: avoid` and placed at the end. A page counter renders automatically ("continued to page number N" / "Page 2") to match the reference PDFs' convention.
- **Print-only CSS hides the controls panel** and any UI chrome so only the invoice prints.
- **localStorage autosave** of the draft (`useReducer` state from ISSUE-03), debounced, so accidental tab close / refresh does not lose a 22-row invoice.
- **Reset** action in the top action bar that clears the draft (and its localStorage entry) so the user can start a fresh invoice.

## Acceptance criteria

- [ ] Clicking "Download PDF" opens the browser print dialog with the preview as the printable area, A4 portrait, and the controls panel absent from the printed output.
- [ ] For an invoice with more line rows than fit on one A4 page, the line table flows to page 2+ repeating the header row, and the summary footer block (totals + tax analysis + words + remarks + bank + declaration + signatory) stays together on the final page (no mid-summary split).
- [ ] A page counter ("Page X of Y" or "continued to page number N") renders on multi-page output matching the reference PDFs.
- [ ] Refreshing the browser restores the full draft (rows, toggles, buyer, seller, footer text) as it was before refresh, via localStorage (verified by editing several rows then reloading).
- [ ] Closing all rows / starting "Reset" clears the draft and the localStorage entry; the Sale Invoice page returns to the empty dropzone state.
- [ ] Print layout matches the Flatworld/SYNOV reference PDFs' margins and general density (body ≈ 12pt; "looks like the paper invoice").

## Blocked by

- ISSUE-07 (footer sections and dispatch toggles must exist so the printed invoice includes them when shown).
- ISSUE-08 (round-off/words renders in the printed summary footer).