
const path = require('path');
const { createRequire } = require('module');
const requireInventory = createRequire(path.resolve(__dirname, '../../inventory/backend/package.json'));
requireInventory('dotenv').config({ path: path.resolve(__dirname, '../../inventory/backend/.env') });
const Database = requireInventory('better-sqlite3');
const bcrypt = requireInventory('bcryptjs');
const configuredPath = process.env.INVENTORY_DB_PATH?.trim();
if (configuredPath && !path.isAbsolute(configuredPath)) {
  throw new Error('INVENTORY_DB_PATH must be an absolute path.');
}

const dbPath = configuredPath || path.resolve(__dirname, '..', 'inventory.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_id_sequences (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS asset_movements (
    id TEXT PRIMARY KEY,
    asset_id TEXT,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS accessories (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS accessory_movements (
    id TEXT PRIMARY KEY,
    accessory_id TEXT,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS delivery_challans (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS returned_challans (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS returned_challan_sequences (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS daily_email_settings (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_email_snapshots (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS email_history (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const demoEmail = 'admin@synov.in';
const demoPassword = 'admin123';

const ensureDemoAdmin = async () => {
  const existing = db.prepare('SELECT id, password_hash FROM admin_users WHERE email = ? COLLATE NOCASE').get(demoEmail);
  if (existing && await bcrypt.compare(demoPassword, existing.password_hash)) return;

  const passwordHash = await bcrypt.hash(demoPassword, 12);
  db.prepare(`
    INSERT INTO admin_users (id, email, password_hash)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      updated_at = CURRENT_TIMESTAMP
  `).run(existing?.id || 'admin', demoEmail, passwordHash);
};

ensureDemoAdmin()
  .then(() => {
    console.log('Inventory database initialized:', dbPath);
    console.log(
      'Tables:',
      db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      ).all().map(row => row.name).join(', ')
    );
  })
  .catch((error) => {
    console.error('Inventory database initialization failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
