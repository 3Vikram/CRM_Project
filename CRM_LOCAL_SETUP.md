# CRM local setup

## Requirements

- Node.js 20 or newer
- npm
- A local MongoDB instance or an authorized MongoDB URI for Inventory API data; the Sales admin login does not use MongoDB

The Sales database is `database/sales.db`. Inventory uses `database/inventory.db`. Both are created locally by the initialization scripts and are excluded from Git so a clone does not receive company database contents.

## Install dependencies

From the project root:

```powershell
npm install
npm install --prefix sales\backend
npm install --prefix sales\frontend
npm install --prefix inventory\backend
npm install --prefix inventory\frontend
```

## Configure local environment

Copy `sales\backend\.env.example` to `sales\backend\.env`, and `inventory\backend\.env.example` to `inventory\backend\.env`.

Set a unique, random `JWT_SECRET` in the Sales backend environment and a unique, random `INVENTORY_AUTH_SECRET` of at least 32 characters in the Inventory backend environment. For local Inventory APIs, configure `MONGO_URI` to a local MongoDB database or a separately authorized environment. Do not share `.env` files or put secrets in source control.

For example, generate a session secret locally without displaying any existing credentials:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value into the appropriate local `.env` file. Do not reuse the same secret for both modules.

## Initialize both databases

From the project root:

```powershell
npm --prefix sales\backend run db:init
npm --prefix inventory\backend run db:init
```

The scripts create missing application/admin tables without dropping existing tables. They safely create or update one `admin_users` row per normalized email, storing a bcrypt hash rather than the plaintext password. Initialization is safe to repeat.

The demo login for both modules is:

- Email: `admin@synov.in`
- Password: `admin123`

This is a local-demo credential only. Change it before any real deployment. Re-running initialization restores the demo password hash.

To select a non-default database file, set `SALES_DB_PATH` or `INVENTORY_DB_PATH` to an absolute path before running the corresponding initializer. Production Sales startup requires an absolute `SALES_DB_PATH`.

## Start the backends

Use separate PowerShell terminals, from the project root:

```powershell
npm --prefix sales\backend start
```

```powershell
npm --prefix inventory\backend start
```

Sales listens on port 5001 by default; Inventory listens on port 5000. Inventory’s application APIs still use MongoDB for Inventory data; this change moves only Inventory administrator authentication to SQLite.

## Verify admin login

After both backends start, in another PowerShell terminal:

```powershell
$body = @{ email = 'admin@synov.in'; password = 'admin123' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:5001/api/auth/admin-login' -ContentType 'application/json' -Body $body
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/inventory/auth/login' -ContentType 'application/json' -Body $body
```

The Sales response contains its existing user and JWT fields. The Inventory response contains its session token. Do not paste tokens into source control or chat.

## Tests

```powershell
npm --prefix sales\backend test
npm --prefix inventory\backend test
```

## Back up before database maintenance

Before any manual schema or data maintenance, use the Sales backup helper and make an SQLite online backup of `database\inventory.db` using a trusted SQLite backup tool. The backup directory is ignored by Git:

```powershell
node database\scripts\backup-sales-db.js
```

Never commit either database file, a backup, a `.env` file, SQLite WAL/SHM files, or company/customer records. The repository `.gitignore` excludes these local artifacts.
