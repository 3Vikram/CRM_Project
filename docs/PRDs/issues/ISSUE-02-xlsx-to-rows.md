# ISSUE-02 — Tracer: drop `.xlsx` → parsed flat line rows on screen

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

A privacy-first Excel ingestion flow on the Sale Invoice page: the user drops the rental ledger `.xlsx` onto the page, it is parsed entirely in the browser with the `xlsx` (SheetJS) library, and the resulting laptops render as a flat editable table — one row per laptop. The file is never uploaded to the backend; only normalised line JSON would ever be sent onwards (in later slices).

Concretely:

- Add the `xlsx` dependency to `frontend`.
- Add an Excel dropzone on the Sale Invoice route that accepts a single `.xlsx`, reads `Sheet1` only, and produces `LineItem[]` via a **pure module** `rowsFromWorkbook(bytes) → LineItem[]` (no React, no DOM).
- Expected workbook shape (16 columns on `Sheet1`): `SL. NO. | DC.NO. | DC DATE | PRESENT MONTH | MONTHS | MAKE | MODEL | SL. NO. (serial) | CONFIGURATION | PRICE | PERSON | COURIER | CONTACT NO | RETURNED | COMPANY`.
- Rendering is flat by default — every selected row is one "1 Pcs" line in the editable review table. The `MONTHS` column is displayed for audit context only. The `PERSON`, `COURIER`, and `CONTACT NO` columns are **never** rendered on the invoice (privacy) and never sent to the backend.
- Missing/unrecognised columns produce a clear parse error shown to the user; the user can re-drop.
- Add the incidental test seam: a node test for `rowsFromWorkbook` using `docs/references/AIE SOFTWARE INDIA PVT LTD 2026.xlsx` as a fixture, asserting the count of rows and the shape of parsed fields (make, model, serial, configuration, price as number, months as number, returned flag, company).

This slice defines the `LineItem` shared type (added to `packages/shared`) but does not yet call the backend.

## Acceptance criteria

- [ ] Dropping `docs/references/AIE SOFTWARE INDIA PVT LTD 2026.xlsx` onto the Sale Invoice page produces a flat editable table with one row per laptop (≈22 rows for that fixture), with make, model, serial, configuration, price, months (display only), and a returned flag rendered.
- [ ] The `.xlsx` file is never sent to a server (verified via the browser network panel — no upload request appears on drop).
- [ ] `PERSON`, `COURIER`, and `CONTACT NO` columns are not rendered anywhere on the page.
- [ ] Dropping a file that is not a valid `.xlsx` or whose `Sheet1` is missing the expected columns shows a clear user-facing error and does not crash the page.
- [ ] `rowsFromWorkbook` is a pure module with no React/DOM imports and is covered by a `vitest` test using the reference workbook as a fixture.
- [ ] The `LineItem` type is exported from `packages/shared` and used by both the dropzone and the test.
- [ ] Existing Sale Invoice route previously rendered a blank page; it now renders the dropzone + review table.

## Blocked by

- ISSUE-01 (the `frontend` rename, shared package, and workspace are prerequisites to adding the `LineItem` shared type and the `xlsx` dependency cleanly).