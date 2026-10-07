# 3Vikram Technologies

A CRM application built with **React 19**, **Vite**, **TypeScript**, **React Router**, and **Tailwind CSS 4**.

## Prerequisites

Install the following on your Windows machine:

1. **Node.js** — v20 or newer (the project runs on v24; download from https://nodejs.org). Using the official Windows installer is fine. Verify with:
   ```powershell
   node -v
   ```

2. **pnpm** — the package manager used by this project. Install it globally:
   ```powershell
   npm install -g pnpm
   ```
   Verify:
   ```powershell
   pnpm -v
   ```

> Tip: If you use [nvm-windows](https://github.com/coreybutler/nvm-windows), switch to a supported Node version first: `nvm use 24`.
>
> Note: This project uses [pnpm](https://pnpm.io) `allowBuilds` settings in `pnpm-workspace.yaml` to allow `esbuild` (required by Vite) to run its install script. If you hit an `ERR_PNPM_IGNORED_BUILDS` warning, run `pnpm approve-builds` and approve `esbuild`.

## Getting Started

All commands below run in **PowerShell** (or any terminal) from the project folder, e.g. `C:\Users\workspace\crm`.

### 1. Install dependencies

```powershell
pnpm install
```

If pnpm warns about **ignored build scripts** for `esbuild`, approve it — Vite needs esbuild's native binary:

```powershell
pnpm approve-builds
```

Select `esbuild`, press Enter, then re-run `pnpm install`.

### 2. Start the development server

```powershell
pnpm dev
```

Open **http://localhost:3000** in your browser. The server stays running in that terminal; press `Ctrl + C` to stop it.

If port 3000 is in use, Vite automatically picks another port (e.g. 3001) — check the terminal output for the actual URL.

### 3. Build for production (optional)

```powershell
pnpm build
pnpm start
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the Vite dev server with hot reload |
| `pnpm build` | Create an optimized production build (outputs to `dist/`) |
| `pnpm preview` | Preview the production build locally |
| `pnpm start` | Alias for `pnpm preview` |

## Project Structure

```
crm/
├── index.html          # Vite entry HTML (title, meta, favicons)
├── vite.config.ts      # Vite config (React plugin, @ alias, dev port)
├── src/
│   ├── main.tsx        # React entry point
│   ├── App.tsx         # Router + layout (sidebar, top bar, routes)
│   ├── pages/          # One component per route
│   │   ├── CustomersPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── LeadsPage.tsx
│   │   ├── InventoryPage.tsx
│   │   ├── PurchaseOrdersPage.tsx
│   │   ├── DCTrackingPage.tsx
│   │   └── BillSalePage.tsx
│   ├── components/      # Reusable UI components (sidebar, modal, cards, etc.)
│   ├── lib/             # Utilities
│   └── index.css        # Global styles / Tailwind theme tokens
├── public/             # Static assets (favicons, images)
└── package.json
```

## Tech Stack

- [React 19](https://react.dev)
- [Vite](https://vite.dev) (dev server & build)
- [React Router](https://reactrouter.com) (client-side routing)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- [pnpm](https://pnpm.io) for dependency management

## Notes

- Customer data currently lives in component state and resets when you refresh. Wire up a backend or `localStorage` persistence when you're ready.
- For any "command not found" errors, make sure Node.js and pnpm are installed and that they appear on your `PATH` (close and reopen the terminal after installing).