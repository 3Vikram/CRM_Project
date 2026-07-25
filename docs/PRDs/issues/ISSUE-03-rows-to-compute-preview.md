# ISSUE-03 — Tracer: line rows → `POST /api/invoices/compute` → minimal Flatworld-style preview

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

The spine of the generator: drive the parsed line rows through the backend compute endpoint and render a minimal live invoice preview matched to the existing Flatworld/SYNOV layout. This is the largest slice and is intentionally kept whole so the end-to-end path is demoable.

Concretely:

- Define the `InvoiceDraft` zod schema + type in `packages/shared` (selected line items + invoice-level toggles + buyer + billing month + GST rate + tax type + round-off flag + seller id). Trim to the decision-rich shape established in planning:
  ```ts
  type TaxType = 'CGST_SGST' | 'IGST' | 'NONE'

  interface LineItem {
    rowRef: number
    make: string
    model: string
    serial: string | string[]
    configuration: string
    price: number
    quantity: number
    from?: string
    to?: string
    isReturned: boolean
    amount: number
    discount?: number
  }

  interface InvoiceDraft {
    sellerId: string
    buyer: { name; address; gstin; stateName; stateCode }
    shippingSameAsBilling: boolean
    consignee?: { name; address; gstin; stateName; stateCode }
    hsn: string                // default '997315'
    gstApplicable: boolean
    gstRate: number             // default 18
    taxType: TaxType
    roundOff: boolean
    returnedBillingRate: number // default 2500
    invoiceNo: string
    invoiceDate: string
    billingMonth: { from: string; to: string }
    lines: LineItem[]
    toggles: { eInvoice; buyersOrder; dispatchDetails; lineDiscount; showRemarks; showDeclaration; showTc; showBank: boolean }
    footer: { remarks?; declaration?; terms?; bank? }
    eInvoice?: { irn?; ackNo?; ackDate? }
  }
  ```
  (from the planning prototype — refine in `packages/shared`; this slice only needs to populate the fields its preview shows.)
- Define `ComputedInvoice` (the response): per-line taxable value, tax breakdown (CGST/SGST halves, or IGST, or none), totals, round-off line (carried but not yet emitted — see ISSUE-08), amount-in-words/tax-in-words (placeholders), resolved seller/buyer display blocks.
- Implement `POST /api/invoices/compute` on the backend with zod validation of `InvoiceDraft`, computing using the invoice-level GST rate (default 18) and the current tax-type toggle. For this slice: **CGST+SGST intra-state (9%/9% for 18%) only**, totals, and a stub for words/round-off. Mixed-company detection is out of scope here (ISSUE-05).
- On the frontend, build the draft state with a `useReducer` over `InvoiceDraft` (no form library), and a minimal controls pane on the left exposing: line-item `amount` editable (default `price × 1`), HSN field (default `997315`), GST-applicable toggle, GST rate (default 18), tax-type toggle (default `CGST_SGST`), invoice date (default today), billing-month `From`/`To` (default previous full month).
- Render a **live invoice preview** styled to match `docs/references/Flatworld.pdf`: header (seller name/address/GSTIN/PAN/email/contact from `GET /api/entities`), Buyer (Bill to) block, line-item table with `SL/DESCRIPTION/HSN/Rate/Qty/Amount`, and an `OUTPUT CGST` + `OUTPUT SGST` + `Total` summary footer. **No Consignee/round-off/words/optional blocks yet.**
- The preview is rendered **entirely from the `ComputedInvoice` response** — tax/total math is computed by the backend, never in the browser. Debounced `POST /api/invoices/compute` fires on every meaningful edit.
- Wire the primary test seam: a `vitest` + `supertest` suite against the Express app posting constructed `InvoiceDraft` payloads and asserting the returned tax breakdown, totals, and CGST/SGST halving.

## Acceptance criteria

- [ ] Dropping the reference `.xlsx` produces rows (ISSUE-02), and the right pane renders a Flatworld-styled live invoice preview with the line table + OUTPUT CGST + OUTPUT SGST + Total.
- [ ] Editing a line `amount` or the GST rate / tax-type toggle / GST-applicable toggle updates the preview totals, and the totals come from `POST /api/invoices/compute` (verified via the network panel — the request fires and its response drives the totals).
- [ ] With tax type `CGST_SGST` and rate 18%, the backend splits CGST and SGST as equal 9%/9% halves on the taxable value and the preview shows both lines.
- [ ] With `gstApplicable = false`, no tax lines render and the total equals the sum of line amounts.
- [ ] Default HSN is `997315`, default invoice date is today, default billing month is the previous full calendar month.
- [ ] The `InvoiceDraft` and `ComputedInvoice` zod schemas live in `packages/shared` and are imported by both frontend and backend.
- [ ] The backend rejects an invalid `InvoiceDraft` (supertest, 4xx) for a malformed payload.
- [ ] `vitest` + `supertest` suite covers: intra-state CGST/SGST halving, GST-off, line totals, taxable value per line. Tests pass.

## Blocked by

- ISSUE-02 (Excel-to-rows must exist; this slice consumes those rows).