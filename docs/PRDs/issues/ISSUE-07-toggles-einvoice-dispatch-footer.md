# ISSUE-07 — Toggles: e-Invoice block, Buyer's Order No, dispatch & reference section, footer sections

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

The Tally-Prime-style optional header/footer blocks, each toggleable, each with per-seller defaults where applicable. This slice wires the `toggles` bag and the collapsible/collapsible sections end-to-end through the draft → compute → preview.

- **e-Invoice block** (IRN / Ack No / Ack Date): toggle, default **on for 3VIKRAM, off for SYNOV** (driven by the entity preset's `eInvoice` default flag from ISSUE-01). Fields are manual text inputs (no live e-invoicing integration v1). Today only the toggle and fields — backend IRN generation is v2.
- **Buyer's Order No. + Date**: toggle, off by default. Two manual fields.
- **Collapsible "Dispatch & reference details" section** off by default; opening it exposes (none required): Delivery Note + Date, Dispatch Doc No, Dispatched through, Destination, Reference No & Date, Other References, Terms of Delivery.
- **Per-line discount toggle** is implemented in ISSUE-04; this slice does not redo it.
- **Footer sections** — Declaration, Terms & Conditions, Bank Details — each individually show/hide-able (Remarks/Bank already surfaced in ISSUE-05; here we add Declaration, T&C, and the per-section show/hide controls). Each footer block fills from the seller preset and remains editable; edits live on the invoice only.

## Acceptance criteria

- [ ] The e-Invoice block toggle reflects the seller preset default (on for 3VIKRAM, off for SYNOV) when the seller is selected; toggling it shows/hides the IRN / Ack No / Ack Date fields in the controls panel and in the preview.
- [ ] The Buyer's Order No. + Date block is toggleable; off by default; manually fillable; rendered in the preview when shown.
- [ ] The "Dispatch & reference details" section is collapsed/off by default; expanding it exposes all eight dispatch/reference fields (none required); the populated fields render in the preview header area.
- [ ] Declaration, T&C, and Bank Details footer sections each have their own show/hide control; turning a section off removes it from the preview entirely; turning it back on restores the per-seller default text (editable).
- [ ] Per-seller footer defaults come from `GET /api/entities` (ISSUE-01) and edits do not mutate the backend preset.
- [ ] The `toggles` bag (already in `InvoiceDraft` from ISSUE-03) is populated by these controls and survives the debounced `/invoices/compute` round trip unchanged.

## Blocked by

- ISSUE-05 (seller presets drive e-Invoice default and footer defaults).
- ISSUE-06 (buyer block exists before dispatch section can be stacked next to it).