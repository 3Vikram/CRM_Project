# PRD — Sale Invoice Generator (Accounts module)

> Status: ready-for-agent (label not applied — no issue tracker integration available; this doc lives in `docs/PRDs/`).
> Source references: `docs/references/Flatworld.pdf` (visual target), `docs/references/Sales_3VT_177_2026-27.pdf` (3Vikram variant with e-Invoice block), `docs/references/AIE SOFTWARE INDIA PVT LTD 2026.xlsx` (rental ledger).

## Problem Statement

Today, generating a rental tax invoice at 3Vikram is manual and error-prone: the team keeps a per-client spreadsheet of every rented laptop (serial, make/model, configuration, monthly price, how many months it's been out, whether it's been returned, and which legal entity rents it). To produce a GST invoice they copy rows out of the spreadsheet by hand, pick the right seller (3Vikram Technologies vs SYNOV IT Services), enter HSN codes and tax, compute CGST/SGST or IGST, round off, write amounts in words, and lay it all out to match their existing Tally-style PDF — one slip breaks a billing document. There is no tool: it's spreadsheet + eyeballing + repeated copy-paste, carried out invoice by invoice, and the result must still look exactly like the paper invoice their clients expect.

## Solution

A generator-only **Sale Invoice** screen inside the Accounts module that takes the rental spreadsheet and a handful of editable, toggleable inputs and produces a printable invoice matching the existing Flatworld/SYNOV layout. The user drops the `.xlsx` in the browser (the file never leaves the machine), reviews and edits the resulting line rows, toggles tax and optional header/footer blocks on or off Tally-Prime-style, picks the seller (auto-detected from the `COMPANY` column), and watches a live preview that mirrors the target PDF. A backend service owns the deterministic invoice math (taxable values, CGST/SGST vs IGST breakdown, totals, round-off, INR number-to-words) so the math is never computed in ad-hoc client JavaScript. "Download PDF" prints the live preview to an A4 paginated stylesheet. Nothing is saved server-side in v1 — if the user closes the tab, the draft survives only via local browser storage; this is a generator, not a manager.

## User Stories

### Ingestion
1. As an accounts operator, I want to drag my client's rental `.xlsx` onto the Sale Invoice page, so that I don't have to retype line items by hand.
2. As an accounts operator, I want the spreadsheet parsed instantly in my browser, so that the sensitive rental data (serials, contact numbers, addresses) is never uploaded to a server.
3. As an accounts operator, I want only the rows from `Sheet1` of the workbook used, so that stray sheets are ignored.
4. As an accounts operator, I want a clear error shown if the uploaded file is missing expected columns, so that I know I picked the wrong file.
5. As an accounts operator, I want the parsed rows shown in an editable table before anything is generated, so that I can spot a bad or stale row.
6. As an accounts operator, I want the original `.xlsx` file never to be sent to the backend, so that the rental ledger stays on my machine.

### Line items
7. As an accounts operator, I want every laptop from the spreadsheet shown as its own row by default, so that I see exactly what will be billed and nothing is silently merged.
8. As an accounts operator, I want to remove individual rows from the invoice, so that returned or non-billable units can be excluded.
9. As an accounts operator, I want to trigger a "Group identical" action that collapses rows sharing the same make, model, and monthly price into one "N Pcs" line, so that the invoice looks like the multi-serial grouped lines in the existing PDF.
10. As an accounts operator, I want grouped lines to stack each unit's serial number, configuration, and rental period underneath, so that the grouped line shows all the detail.
11. As an accounts operator, I want to switch back from grouped to flat rows, so that I can re-check coverage before generating.
12. As an accounts operator, I want returned units to never be hidden inside a grouped line, so that a return is always visible and never absorbed into a "N Pcs" total.
13. As an accounts operator, I want each row's `Amount` to default to one month of the monthly price, so that a typical full-month rental needs no editing.
14. As an accounts operator, I want to edit each row's rental `From`/`To` dates, so that partial-month rentals read correctly.
15. As an accounts operator, I want a "Returned → prorate" action per row that computes a prorated amount from the unit's `RETURNED` date, so that a mid-month return is billed correctly without me doing arithmetic.
16. As an accounts operator, I want a returned unit's prorated amount to use a separate "returned billing rate" (default ₹2,500/month × days/30), so that it matches the existing prorate convention shown on current invoices.
17. As an accounts operator, I want to override the prorated amount manually, so that I can correct a computed value the spreadsheet disagrees with.
18. As an accounts operator, I want the cumulative `MONTHS` column shown for reference only, so that I have audit context without it driving the billed amount.
19. As an accounts operator, I want the HSN/SAC code editable per invoice (default 997315), so that the standard rental HSN is pre-filled but changeable.
20. As an accounts operator, I want to toggle a per-line discount column on, so that I can apply discounts when needed without the column cluttering the usual case.

### Seller / legal entity
21. As an accounts operator, I want the seller legal entity auto-selected from the majority `COMPANY` value across the dropped rows (SYNOV or 3VIKRAM), so that I don't bill from the wrong GSTIN.
22. As an accounts operator, I want a warning and a requirement to split into two invoices when the dropped rows contain mixed `COMPANY` values, so that one entity never bills another's rentals in a single GST invoice.
23. As an accounts operator, I want the selected seller to fill the header block (name, address, GSTIN/UIN, PAN, email, contact, MSME no.) from a preset, so that the header is correct without manual entry.
24. As an accounts operator, I want to manually override any seller header field per invoice, so that a one-off correction is possible without changing the preset.
25. As an accounts operator, I want the seller preset to drive the suggested invoice-number prefix (e.g. `3VT/__/2026-27` for 3Vikram, `SISPL/__/25-26` for SYNOV), so that the numbering style matches the existing series.
26. As an accounts operator, I want to type the running invoice number myself, so that I keep the numbering correct against whatever else has been issued.

### Buyer / consignee
27. As an accounts operator, I want to enter the Buyer (Bill to) name and address, so that the invoice is addressed correctly.
28. As an accounts operator, I want to enter the buyer's GSTIN/UIN and state, so that GST is billed to the right party.
29. As an accounts operator, I want a "Shipping same as billing" toggle (on by default), so that the Consignee (Ship to) block is auto-filled when delivery goes to the billing address.
30. As an accounts operator, I want to switch "Shipping same as billing" off and enter a separate Consignee address, so that rentals delivered to a different site are shipped correctly.
31. As an accounts operator, I want the preview to render both the Consignee and Buyer blocks exactly as in the existing PDF layout, so that the printed invoice matches what clients receive today.

### Tax
32. As an accounts operator, I want GST applicable to be toggleable on/off for the whole invoice, so that a non-GST invoice can still be produced from the same screen.
33. As an accounts operator, I want the GST rate to default to 18% and be editable at the invoice level, so that rentals bill uniformly without per-line rate sprawl.
34. As an accounts operator, I want the invoice to auto-suggest CGST+SGST (intra-state) or IGST (inter-state) from the seller's state versus the buyer's state, so that the correct tax split is proposed without me remembering the rule.
35. As an accounts operator, I want to override the suggested CGST+SGST vs IGST choice, so that I can correct a state mismatch or an edge case.
36. As an accounts operator, I want the Place of Supply (state code) displayed, so that the split decision is auditable.
37. As an accounts operator, I want the system to compute CGST and SGST as equal halves of the GST rate (9%/9% for 18%), so that the split matches the existing invoices.
38. As an accounts operator, I want IGST, when active, to show as a single line at the full GST rate, so that inter-state invoices read correctly.
39. As an accounts operator, I want a round-off toggle (on by default) that rounds the grand total to the nearest ₹1 and shows a "Rounded Off ±x" line, so that the printed total is a whole rupee as on existing invoices.
40. As an accounts operator, I want "Amount Chargeable (in words)" computed automatically, so that the words always match the figures and I never mistype them.
41. As an accounts operator, I want "Tax Amount (in words)" computed automatically, so that the tax-in-words line matches the tax figures exactly.

### Optional header blocks (Tally-Prime-style toggles)
42. As an accounts operator, I want the e-Invoice block (IRN / Ack No / Ack Date) toggleable, defaulting on for 3Vikram and off for SYNOV, so that the e-Invoice details appear on the 3Vikram variant and don't clutter the SYNOV variant.
43. As an accounts operator, I want the e-Invoice fields to be manual text inputs, so that I can paste details from the e-invoicing portal without a live integration.
44. As an accounts operator, I want a Buyer's Order No. + Date block toggleable on, so that I can record a PO reference when the client provides one.
45. As an accounts operator, I want a collapsible "Dispatch & reference details" section covering Delivery Note, Delivery Note Date, Dispatch Doc No, Dispatched through, Destination, Reference No & Date, Other References, and Terms of Delivery, so that dispatch detail is available when needed but hidden when not.
46. As an accounts operator, I want each of those dispatch fields individually present (not required) once the section is open, so that I can fill only what applies.
47. As an accounts operator, I want the invoice date to default to today and be editable, so that I don't backdate by accident but can when needed.
48. As an accounts operator, I want the billing-month range to default to the previous full calendar month and be editable, so that a typical "billing for last month" rental invoice needs no date entry.

### Footer blocks
49. As an accounts operator, I want a Remarks field with a per-seller default ("Being Rental Invoice Raised for the Month of {month} ({seller short name})"), so that the standard wording is pre-filled.
50. As an accounts operator, I want a Declaration field with a per-seller default, so that the standard declaration text is pre-filled.
51. As an accounts operator, I want Terms & Conditions editable with a per-seller default, so that the standard T&C is pre-filled and tweakable.
52. As an accounts operator, I want the Company Bank Details block (holder name, bank name, account no, branch & IFSC) filled from the seller preset and editable, so that bank details are correct and quick.
53. As an accounts operator, I want each footer block (Remarks / Declaration / T&C / Bank Details) individually show/hide-able, so that I can suppress any section an invoice doesn't need.

### Preview & output
54. As an accounts operator, I want a live on-screen invoice preview that mirrors the existing Flatworld/SYNOV PDF layout, so that what I see is what I will print.
55. As an accounts operator, I want the preview to update as I edit any field or toggle, so that I never print something I haven't seen.
56. As an accounts operator, I want the preview's tax and totals to come from the backend compute service, so that the math on screen is verified, not improvised in the browser.
57. As an accounts operator, I want a "Download PDF" button that prints the preview to an A4 portrait stylesheet, so that the output is a clean independent PDF.
58. As an accounts operator, I want the printed PDF to paginate like the existing invoice (line items flowing, summary footer kept together on the final page), so that multi-page invoices don't split a tax summary across pages.
59. As an accounts operator, I want the page footer counter ("continued to page number N" / "Page X") to render automatically, so that multi-page invoices read like the existing ones.
60. As an accounts operator, I want the controls panel hidden from the print output, so that only the invoice prints.
61. As an accounts operator, I want my draft to survive a browser refresh via local storage, so that an accidental tab close doesn't lose a 22-row invoice.
62. As an accounts operator, I want a "Reset" action that clears the draft, so that I can start a fresh invoice without leftover rows.
63. As an accounts operator, I want the page to work as a single screen with the controls panel and the preview side by side, so that I can edit and watch at the same time.

### Foundation & engineering
64. As a developer, I want the repo reorganised into a pnpm workspace with separate `frontend/` and `backend/` packages, so that the two servers are started independently but share tooling.
65. As a developer, I want a `packages/shared` workspace package holding the zod schemas and TypeScript types for entities, line items, the compute request, and the computed invoice, so that the frontend and backend never drift on the contract.
66. As a developer, I want the backend to be a layered Express + TypeScript service with zod-validated endpoints, so that invoice logic is testable and the codebase stays maintainable as the Accounts module grows.
67. As a developer, I want the frontend Vite dev server to proxy `/api` to the backend, so that the frontend calls the backend without CORS plumbing.
68. As a developer, I want `GET /api/entities` to return the seller legal-entity presets, so that the frontend has a single source of truth for seller headers.
69. As a developer, I want `POST /api/invoices/compute` to accept a validated draft and return a fully-resolved invoice with tax breakdown, round-off, and words, so that all invoice math lives in one tested, stateless place.

## Implementation Decisions

### Product shape
- **Generator only, v1 — no server-side persistence.** The Sale Invoice page produces an invoice for preview/print; it does not save invoices. Save/list/history is explicitly v2. Draft resilience is client-side local storage only.
- **Fixed template, editable values.** The invoice layout is fixed to mirror the Flatworld/SYNOV PDF. The user controls *which fields are filled and what they say*; the user does not move sections or redefine the template.
- **One screen, two panes:** left = collapsible controls panel; right = sticky live preview styled to match the target PDF. "Download PDF" and "Reset" live in a top action bar. On narrow screens the preview stacks under the controls.

### Monorepo & infrastructure
- **pnpm workspaces at the repo root** with packages `frontend/`, `backend/`, `packages/shared` (and `packages/*` glob). Single root `pnpm install`; two servers started separately (`pnpm --filter frontend dev`, `pnpm --filter backend dev`).
- **Folder rename:** `forntend/` → `frontend/` (the `@` Vite alias is relative, so no source changes are required). Blocked until the currently running Vite dev server is stopped by the operator.
- **Frontend dev proxy:** Vite `server.proxy['/api']` → `http://localhost:4000`, so the frontend calls `/api/...` uniformly.
- **Backend:** Express + TypeScript, layered as `routes → controllers → services`, with a `schemas` layer for zod and a `config` layer for entity presets; entry `src/index.ts`; dev via `tsx watch` on port 4000.
- **Shared package `packages/shared`:** holds the zod schemas and TS types used by both sides; built with `tsc`; imported via the workspace. Defined types/entities: `Entity` (seller legal entity), `LineItem`, `InvoiceDraft` (the compute request), `ComputedInvoice` (the compute response), `Toggles`, `TaxType = 'CGST_SGST' | 'IGST' | 'NONE'`. The zod schema for `InvoiceDraft` is shared so the frontend validates before sending and the backend validates on receipt using the *same* schema.

### Excel ingestion (privacy-first, browser-side)
- **Parse in the browser with the `xlsx` (SheetJS) library; never upload the `.xlsx` to the server.** Only normalized line-item JSON is sent to backend endpoints, and only to `/invoices/compute`.
- **Expected workbook shape:** `Sheet1`, 16 columns — `SL. NO. | DC.NO. | DC DATE | PRESENT MONTH | MONTHS | MAKE | MODEL | SL. NO. (serial) | CONFIGURATION | PRICE | PERSON | COURIER | CONTACT NO | RETURNED | COMPANY`. Unknown/missing columns produce a clear parse error.
- **Each row → one laptop → one candidate invoice line item.** Rows are shown flat in the editable review table by default; the original file is discarded after parsing.

### Line items & grouping
- **Flat by default.** Every selected row renders as its own "1 Pcs" line.
- **User-driven "Group identical" action.** Collapses rows whose `(MAKE, MODEL, PRICE)` all match into one "N Pcs @ PRICE" line; each row's serial number, configuration, and rental From/To are stacked as sub-lines beneath the group. `CONFIGURATION` is *display-only*, never part of the grouping key (its string drifts by trim — WIN11 vs WIN11PRO, BOXPIECE present/absent — and would otherwise prevent grouping).
- **Returned rows are never absorbed into a group.** A row carrying a `RETURNED` value stays as its own line so the return is always visible. Grouping applies only to non-returned rows.
- **Per-row `Amount` default = `PRICE × 1`** (one month).
- **Per-row "Returned → prorate" action** computes `amount = returnedBillingRate × days(From → To)/30`, rounded to two decimals, then stays manually editable. The `From`/`To` defaults come from the `RETURNED` date display.
- **`returnedBillingRate` is an invoice-level editable field, default ₹2,500**, used by every "Returned → prorate" action on that invoice (matching the existing prorate convention visible on current invoices).
- **`MONTHS` is display-only** audit context; it never drives an amount.
- **Per-line discount** is a toggle (off by default); when on, a Disc column appears and discounts apply before tax.
- **HSN/SAC default = `997315`**, editable at the invoice level (per-line override is out of scope for v1).

### Seller / legal entity
- **`COMPANY` column drives the seller selection** (value `SYNOV` → SYNOV IT Services; `3VIKRAM` → 3Vikram Technologies). The controls panel's Seller field auto-sets from the majority `COMPANY` of the dropped rows and is editable.
- **Mixed `COMPANY` in one drop** → warn and require the user to split into two invoices. One GSTIN cannot bill another entity's rentals in a single GST invoice; this is a hard correctness rule.
- **Seller presets sourced from `GET /api/entities`** (seed data in the backend `config` layer). Each preset supplies: legal name, address, state name & code, GSTIN/UIN, PAN, email, contact, MSME no., bank details (holder, bank, account no, branch & IFSC), declaration text, T&C text, remarks template, and invoice-number prefix.
- **Per-invoice seller edits do not mutate the preset** — edits live only on that invoice.
- **Invoice numbering is manual** in v1 (generator-only has no auto-number without persistence). The prefix is suggested from the preset; the user fills the running number (e.g. `3VT/177/2026-27`, `SISPL/403/25-26`).

### Buyer / consignee
- **Buyer (Bill to)** block: editable name, address, GSTIN/UIN, state name & code.
- **"Shipping same as billing" toggle (on by default).** When off, a separate Consignee (Ship to) block becomes editable. Both blocks render in the preview exactly as the existing PDF's two-block layout.

### Tax
- **`TaxType = 'CGST_SGST' | 'IGST' | 'NONE'`.**
- **GST applicable toggle** (whole invoice). When off, no tax is computed and tax fields/words are suppressed.
- **Invoice-level GST rate, default 18%, editable.** Applied to all taxable lines. Per-line GST rate override is out of scope v1.
- **Tax-type auto-suggestion:** the system compares the seller's state to the buyer's state — same state → `CGST_SGST` (each half = rate/2, i.e. 9%/9% for 18%); different state → `IGST` (full rate). The suggestion pre-fills the toggle; the user can override.
- **Place of Supply = buyer state code**, displayed.
- **Round-off toggle (on by default).** When on, the backend rounds the final grand total to the nearest ₹1 and emits a "Rounded Off ±x" line; the sign of the difference is shown. Round-off applies at the *invoice total* level, not per line. When off, totals retain paise.
- **INR number-to-words** is computed backend-side for both "Amount Chargeable (in words)" and "Tax Amount (in words)", including paise handling. Deterministic, unit-tested.

### Optional header blocks (toggleable)
- **e-Invoice block (IRN / Ack No / Ack Date):** toggle; default on for 3VIKRAM seller, off for SYNOV seller. Fields are manual text (no live e-invoicing integration v1).
- **Buyer's Order No. + Date:** toggle, off by default.
- **Collapsible "Dispatch & reference details" section:** groups Delivery Note, Delivery Note Date, Dispatch Doc No, Dispatched through, Destination, Reference No & Date, Other References, Terms of Delivery. Section off by default; opening it exposes the fields, none required.
- **Per-line discount:** toggle, off by default (covered above).
- **Invoice date:** default today, editable. **Billing-month `From`/`To`:** default previous full calendar month from today, editable; used as the per-row default `From`/`To` for line items.

### Footer blocks (toggleable, with per-seller defaults)
- **Remarks:** default "Being Rental Invoice Raised for the Month of {billingMonth} ({seller short name})".
- **Declaration, Terms & Conditions, Company Bank Details:** filled from the seller preset, editable, each individually show/hide-able.
- All footer text lives on the draft; edits don't mutate presets.

### Frontend architecture
- **Draft state via `useReducer`** over a typed `InvoiceDraft` (from `packages/shared`). No form library — the screen is a dynamic edit table plus ~20 toggles, which a fixed-field form lib handles poorly and a reducer handles cleanly.
- **Local storage autosave** of the draft (debounced) so accidental refresh/close doesn't lose work.
- **Live preview from `ComputedInvoice`:** the frontend debounces calls to `POST /api/invoices/compute` on each meaningful edit and renders the returned `ComputedInvoice`. The preview never computes tax/totals locally — preview data === PDF data.
- **Page files** (under the Sale Invoice route in the accounts area) include: the route component laying out the split pane and wiring the reducer + compute; the draft context (reducer + context + local storage); an Excel dropzone that owns `xlsx` parsing; the editable line-items table (with group-identical and returned-prorate actions); the toggles panel; buyer and seller blocks; the collapsed dispatch section; the footer section; the live `InvoicePreview` and its sub-pieces (header, parties, line table, tax summary, signatory). No persistence/network beyond the compute endpoint.

### PDF output
- **Client-side print-to-PDF.** "Download PDF" opens the browser print dialog scoped to an A4 portrait print stylesheet that paginates the existing preview DOM. Because the printed DOM *is* the preview DOM, the PDF always matches what the user sees. Server-side PDF generation (puppeteer/pdfkit) is out of scope v1.
- **Pagination:** line-items table flows and may break across pages, repeating the header row; the summary footer block (OUTPUT CGST/SGST or OUTPUT IGST, Total, Amount Chargeable in words, Tax Analysis table, Tax Amount in words, Remarks, Bank Details, Declaration, signatory) is kept together via `break-inside: avoid` and placed at the end. Page counter renders automatically to match the existing "continued to page number N" / "Page 2" convention.

### API contracts
- `GET /api/entities` → `Entity[]` (seller legal-entity presets).
- `POST /api/invoices/compute` — request body `InvoiceDraft` (selected line items + toggles + buyer block + consignee block + billing month + GST rate + tax type + round-off flag + seller id + optional header/footer fields) validated by the shared zod schema; response `ComputedInvoice` containing per-line taxable values, the tax breakdown (CGST/SGST halves, or IGST, or none), totals, the round-off line, amount-in-words, tax-in-words, and resolved seller/buyer display blocks. Stateless.
- `POST /api/invoices` (save) and `GET /api/invoices` (list) are stubbed/reserved for v2.

### Prototype-derived decision shapes
The following shapes encode structural decisions more precisely than prose and were resolved during the planning spike (to be refined in `packages/shared`):
```ts
type TaxType = 'CGST_SGST' | 'IGST' | 'NONE'

interface LineItem {
  rowRef: number            // source Excel SL. NO.
  make: string
  model: string
  serial: string | string[] // stacked when grouped
  configuration: string      // display only
  price: number              // monthly rate; grouping key component
  quantity: number            // 1 flat, N when grouped
  from?: string               // ISO date
  to?: string                 // ISO date
  isReturned: boolean
  amount: number              // editable; default price*1 or prorate
  discount?: number
}

interface InvoiceDraft {
  sellerId: string
  buyer: { name; address; gstin; stateName; stateCode }
  shippingSameAsBilling: boolean
  consignee?: { name; address; gstin; stateName; stateCode }
  hsn: string                 // default '997315'
  gstApplicable: boolean
  gstRate: number             // default 18
  taxType: TaxType            // suggested from seller vs buyer state
  roundOff: boolean           // default true
  returnedBillingRate: number // default 2500
  invoiceNo: string
  invoiceDate: string         // ISO, default today
  billingMonth: { from; to }  // default previous full month
  lines: LineItem[]
  toggles: {
    eInvoice: boolean
    buyersOrder: boolean
    dispatchDetails: boolean
    lineDiscount: boolean
    showRemarks; showDeclaration; showTc; showBank: boolean
  }
  footer: { remarks?; declaration?; terms?; bank? }
  eInvoice?: { irn?; ackNo?; ackDate? }
}
```

## Testing Decisions

### What makes a good test here
A good test asserts **external behavior at a stable boundary**, never implementation details (no asserting on internal service variable names, framework wiring, or DOM markup that isn't a user-visible requirement). The correctness-critical behavior in this feature is the invoice math and the Excel-to-line-item mapping; both should be testable without a browser.

### Seams
1. **Primary seam — `POST /api/invoices/compute` and `GET /api/entities` (HTTP boundary).** Tests drive the Express app via `supertest`, post a constructed `InvoiceDraft` (built with the shared types), and assert on the returned `ComputedInvoice` JSON. This single seam covers all deterministic invoice logic: taxable value per line, CGST/SGST halving vs IGST, GST-off behavior, round-off line and sign, grand total, amount-in-words, tax-in-words, and per-seller entity fetching. Because the frontend preview renders the response of this endpoint, the frontend needs no math tests — if the math is right here, the screen is right. This is the highest available seam and covers the riskiest code.
2. **Incidental pure-function seam — `rowsFromWorkbook(bytes) → LineItem[]`.** A pure module (no React, no DOM) tested in node by importing a `xlsx`-encoded buffer of the reference `AIE SOFTWARE INDIA PVT LTD 2026.xlsx` fixture and asserting the produced rows. Exists only because parsing was deliberately kept browser-side for privacy (the file is never uploaded). It does not cross an architectural boundary, so it doesn't count against the "one seam" principle in the spirit of the rule.

These two seams match the architecture chosen during planning (browser-parse + server-compute). If a stricter single-seam policy is preferred, the alternative would be a tiny `POST /api/ingest/excel` endpoint folded into seam #1 — but we explicitly rejected uploading the spreadsheet, so the two-seam approach is recommended.

### Modules tested
- Backend `compute` service (via the endpoint): tax math, round-off, words.
- Backend `entities` config (via the endpoint): preset shapes.
- Shared zod schemas: invalid drafts are rejected at the same boundary (covered by supertest sending bad payloads expecting 4xx).

### Prior art
There is currently no test harness or test code in the repo (only a Vite + React + TS frontend with no tests). Test tooling will be introduced with this feature: `vitest` for the frontend/shared pure module, and `vitest` + `supertest` (or `vitest`'s request helpers) for the backend HTTP seam — chosen to stay within the existing vite/vitest TS toolchain rather than introducing a separate runner. (Vitest isn't yet a dependency; this PRD's implementation should add it.)

## Out of Scope

- **No server-side persistence.** No save/list/reopen of generated invoices; no auto invoice numbering. (v2.)
- **No real e-invoicing integration.** The e-Invoice block (IRN/Ack No/Ack Date) is manual text entry; no NIC portal calls.
- **No server-side PDF generation.** "Download PDF" is browser print-to-PDF only; no puppeteer/pdfkit server endpoint. (v2.)
- **No per-line GST rate / per-line HSN override.** Tax rate and HSN are invoice-level in v1.
- **No TCS, no Reverse Charge (RCM), no Cess/Surcharge, no forex/multi-currency, no additional charges/expenses ledger, no cash-vs-credit voucher distinction.** These are real Tally features but not emitted by the target invoices today; deferred.
- **No template/layout editor.** The invoice visual layout is fixed to the Flatworld/SYNOV target; the user edits values, not structure.
- **No automatic Excel grouping.** Collapsing rows is a user action, not a silent default.
- **No client/CRM contacts import.** The buyer block is typed or pasted per invoice; no shared address book.
- **No scaffolding of the other Accounts pages** (Purchase Invoice, General Voucher, Bank Payments, Ledger, P&L, Reports). They remain blank placeholders; only Sale Invoice ships behaviour in this PRD.
- **No `forntend` → `frontend` rename automation while the user's Vite dev server holds the folder open.** Rename is a one-line action item for the operator; it is a prerequisite to the monorepo scaffolding, not part of the feature logic.

## Further Notes

- **Reference artefacts** for layout and data live in `docs/references/`: `Flatworld.pdf` (the visual target — SYNOV selling to Flatworld, GST intra-state CGST+SGST 9/9), `Sales_3VT_177_2026-27.pdf` (the 3Vikram variant with the e-Invoice block), and `AIE SOFTWARE INDIA PVT LTD 2026.xlsx` (the per-client rental ledger whose `Sheet1` schema defines the line-item source). Plain-text extractions of the two PDFs are kept alongside for quick reference.
- **Two seller entities** are known from the references: **3Vikram Technologies** (GSTIN 29APPPK7534R1ZR, HDFC Bank, MSME UDYAM-KR-03-0029793, prefix `3VT/`) and **SYNOV IT Services Pvt Ltd** (GSTIN 29ABICS1686C1Z4, ICICI Bank, prefix `SISPL/`). Both are Karnataka-registered (state code 29), so the seller-vs-buyer state comparison for CGST/SGST vs IGST centres on the *buyer's* state.
- **Privacy posture is a hard requirement, not a nicety:** the rental ledger contains real persons' names, contact numbers, courier addresses, and laptop serial numbers. Keeping the `.xlsx` in the browser and sending only normalized line JSON (no PII columns beyond what the invoice itself prints) is the chosen posture; the `PERSON`, `COURIER`, `CONTACT NO` columns from the spreadsheet are **never** sent to the backend and never rendered on the invoice.
- **Prerequisite action items before implementation begins** (operator, not implementer): (1) stop the running Vite dev server so the `forntend`→`frontend` rename can land; (2) decide the canonical issue-tracker + `ready-for-agent` triage label scheme, since the skill expects to publish there (no `.github` / labels exist yet). This PRD is stored as a file for now.