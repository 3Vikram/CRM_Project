# ISSUE-01 — Prefactor: pnpm workspace, backend skeleton, shared package, frontend rename + `/api` proxy

## Parent

Sale Invoice Generator PRD — `docs/PRDs/sale-invoice-generator.md`.

## What to build

Reorganise the repo into a pnpm workspace so the Accounts backend can be built alongside the existing frontend with a shared types package and a Vite dev proxy. Specifically:

- Move the existing `forntend/` directory to `frontend/` (the Vite `@` alias is relative, so no source edits are required). **Prerequisite, owned by the operator:** stop the running Vite dev server so the folder can be moved.
- Add a root `pnpm-workspace.yaml` declaring `frontend`, `backend`, and `packages/*`. Run a single root `pnpm install`.
- Scaffold `backend/` as a layered Express + TypeScript service (`routes → controllers → services`, plus `schemas` for zod and `config` for entity presets), entry `src/index.ts`, dev via `tsx watch` on port 4000.
- Scaffold `packages/shared` as a plain TS package built with `tsc`, holding the zod schemas and TypeScript types used by both sides. Start it minimal: an `Entity` (seller legal entity) type + its zod schema, since that's all slice 1 needs to expose.
- Implement `GET /api/entities` on the backend returning the two seller presets resolved from the backend config: **3Vikram Technologies** (GSTIN 29APPPK7534R1ZR, HDFC Bank, MSME UDYAM-KR-03-0029793, prefix `3VT/`, e-Invoice on by default) and **SYNOV IT Services Pvt Ltd** (GSTIN 29ABICS1686C1Z4, ICICI Bank, prefix `SISPL/`, e-Invoice off by default). Both Karnataka-registered, state code 29.
- Add the Vite dev proxy: `server.proxy['/api']` → `http://localhost:4000` so the frontend calls `/api/...` without CORS plumbing.
- Add test tooling: `vitest` to `packages/shared` and `backend` (no tests written yet in the repo; this issues introduces the runner).

No Sale Invoice UI yet — this slice proves the workspace, the proxy, and the entities endpoint end to end.

## Acceptance criteria

- [ ] `forntend/` has moved to `frontend/` and `pnpm --filter frontend dev` still starts the existing app on port 3000.
- [ ] `pnpm -r install` succeeds from the repo root with `pnpm-workspace.yaml` listing `frontend`, `backend`, `packages/*`.
- [ ] `pnpm --filter backend dev` starts the Express server on port 4000.
- [ ] `GET http://localhost:4000/api/entities` returns a JSON array of two entities (3Vikram Technologies and SYNOV IT Services) including name, address, GSTIN/UIN, PAN, state name & code 29, email, contact, MSME no., bank details, declaration, T&C, remarks template, invoice-number prefix, and e-Invoice default flag.
- [ ] The shared package exports the `Entity` type and its zod schema, and is importable from both `frontend` and `backend` via the workspace.
- [ ] The frontend can fetch `/api/entities` through the Vite proxy and log both entities to the browser console without CORS errors.
- [ ] `vitest` runs across the workspace (`pnpm -r test`) and exits cleanly (a placeholder test is fine).
- [ ] `pnpm -r build` succeeds for `frontend`, `backend`, and `packages/shared`.

## Blocked by

None — can start immediately once the operator stops the running Vite dev server.