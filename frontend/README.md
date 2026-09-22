# 3Vikram Technologies — frontend

The React SPA for the 3Vikram CRM (package name `3vikram-technologies`). This is one piece of a monorepo — see the [repo root README](../README.md) for prerequisites, database setup, login, and how to run the whole app (`pnpm dev` from the root starts this and the backend together).

## Tech stack

- [React 19](https://react.dev), [Vite 6](https://vite.dev), [React Router 7](https://reactrouter.com), [TypeScript](https://www.typescriptlang.org), [Tailwind CSS 4](https://tailwindcss.com)
- [TanStack Query](https://tanstack.com/query) for the Accounts module's server state (`src/lib/queries/`)

## Scripts (run from this directory, or via `pnpm --filter ./frontend <script>` from the root)

| Command | Description |
|---------|--------------|
| `pnpm dev` | Vite dev server with hot reload, on **http://127.0.0.1:3001**, proxying `/api` to the backend on port 4000 |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` / `pnpm start` | Preview the production build |
| `pnpm test` | Vitest |

## Structure

```
frontend/
├── index.html
├── vite.config.ts        # React plugin, @ alias, dev port/proxy
├── src/
│   ├── main.tsx
│   ├── App.tsx            # Router + both module layouts (Sales, Accounts)
│   ├── pages/
│   │   ├── *.tsx           # Sales module pages (no login)
│   │   └── accounts/       # Accounts module pages (behind /login)
│   ├── components/
│   │   ├── accounts/       # Accounts-only: auth, query provider, ledger context
│   │   └── *.tsx            # Shared / Sales UI (sidebar, top bar, cards, ...)
│   ├── lib/
│   │   ├── queries/         # TanStack Query hooks for the Accounts API
│   │   ├── api.ts, auth.ts  # Accounts fetch wrapper + auth context
│   │   └── ...               # Excel parsing, tax rules, date helpers
│   └── index.css            # Tailwind theme tokens
└── public/
```

## Notes

- The **Sales** module (`/sales/*`) has no backend of its own yet — its data lives in component state and resets on refresh.
- The **Accounts** module (`/accounts/*`) is fully backed by the Postgres API; see [docs/accounting-foundation.md](../docs/accounting-foundation.md).
- If pnpm warns about **ignored build scripts** for `esbuild` on install, run `pnpm approve-builds` from the repo root and select `esbuild`.
