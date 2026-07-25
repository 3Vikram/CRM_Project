# Sale Invoice Generator — issue backlog

Vertical-slice (tracer-bullet) breakdown of [the Sale Invoice Generator PRD](../sale-invoice-generator.md). Each issue is a thin end-to-end slice that is demoable/verifiable on its own and cuts through every layer it touches (shared types → backend → API → UI → tests).

> Not published to an issue tracker — no tracker is wired up in this repo. When one is set up, mirror these with the `ready-for-agent` triage label.

## Dependency graph

```
ISSUE-01 (prefactor)
   └─ ISSUE-02 (xlsx → rows)
        └─ ISSUE-03 (rows → compute → minimal preview)   ← the spine
              ├─ ISSUE-04 (grouping + returns + prorate)
              ├─ ISSUE-05 (seller + mixed-Co warning + defaults)
              ├─ ISSUE-06 (buyer + consignee + tax-type suggest)
              └─ ISSUE-08 (round-off + INR words + numbering)
                    ├─ ISSUE-07 (toggles: e-Invoice / dispatch / footer)   ← needs 05 + 06
                    └─ ISSUE-09 (PDF print + pagination + autosave + reset)
```

## Issues

| ID  | Title | Blocked by |
|-----|-------|------------|
| [ISSUE-01](ISSUE-01-prefactor-workspace.md) | Prefactor: pnpm workspace, backend skeleton, shared package, frontend rename + `/api` proxy | — (needs Vite dev server stopped) |
| [ISSUE-02](ISSUE-02-xlsx-to-rows.md) | Tracer: drop `.xlsx` → parsed flat line rows on screen | ISSUE-01 |
| [ISSUE-03](ISSUE-03-rows-to-compute-preview.md) | Tracer: line rows → `POST /api/invoices/compute` → minimal Flatworld preview | ISSUE-02 |
| [ISSUE-04](ISSUE-04-grouping-returns-prorate.md) | Grouping + returned-row prorate + line discount | ISSUE-03 |
| [ISSUE-05](ISSUE-05-seller-selection-defaults.md) | Seller selection from `COMPANY` + mixed-company warning + seller/bank/remarks defaults | ISSUE-03 |
| [ISSUE-06](ISSUE-06-buyer-consignee-taxtype.md) | Buyer block + Consignee toggle + tax-type auto-suggestion | ISSUE-03 |
| [ISSUE-07](ISSUE-07-toggles-einvoice-dispatch-footer.md) | Toggles: e-Invoice block, Buyer's Order No, dispatch & reference section, footer sections | ISSUE-05, ISSUE-06 |
| [ISSUE-08](ISSUE-08-roundoff-words-numbering.md) | Round-off + INR words (amount + tax) + manual numbering | ISSUE-03 |
| [ISSUE-09](ISSUE-09-pdf-pagination-autosave.md) | PDF print + pagination + localStorage autosave + Reset | ISSUE-07, ISSUE-08 |

## How to grab

Pick the lowest-numbered issue whose blockers are all done. ISSUE-03 is the spine — once it's green, issues 04/05/06/08 can be grabbed in parallel. Do not start 07 until 05 and 06 are both done; do not start 09 until 07 and 08 are done.

## Open questions answered (from planning)

- Slice 3 stays whole (compute + minimal preview together) to keep end-to-end-demoable.
- 4 stays whole (grouping + returns/prorate together — both edit the same line table).
- 5 and 8 stay split (seller defaults vs backend math are different risks).