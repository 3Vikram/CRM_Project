import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import express from 'express';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-auth-test-'));
const databasePath = path.join(tempDirectory, 'inventory.sqlite');
process.env.INVENTORY_DB_PATH = databasePath;
process.env.INVENTORY_AUTH_SECRET = 'inventory-auth-test-secret-that-is-long-enough';
delete process.env.INVENTORY_LOGIN_EMAIL;
delete process.env.INVENTORY_LOGIN_PASSWORD;

const [{ default: inventoryAuthRoutes }, { dbPath }] = await Promise.all([
  import('../src/routes/inventoryAuth.js'),
  import('../src/database/inventoryDatabase.js'),
]);
assert.equal(path.resolve(dbPath), path.resolve(databasePath));
const initializerPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'database',
  'scripts',
  'init-inventory-db.js',
);

test('Inventory login uses SQLite bcrypt credentials and preserves session validation', async (t) => {
  const db = new Database(databasePath);
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.prepare('INSERT INTO products (id, data_json) VALUES (?, ?)').run('existing-product', '{"preserved":true}');
  db.close();

  const initializerEnv = {
    ...process.env,
    INVENTORY_DB_PATH: databasePath,
  };
  for (let run = 0; run < 2; run += 1) {
    const initialized = spawnSync(process.execPath, [initializerPath], {
      cwd: tempDirectory,
      encoding: 'utf8',
      env: initializerEnv,
    });
    assert.equal(initialized.status, 0, initialized.stderr);
  }

  const initializedDb = new Database(databasePath, { readonly: true });
  const storedAdmin = initializedDb.prepare('SELECT email, password_hash FROM admin_users WHERE id = ?').get('admin');
  assert.equal(storedAdmin.email, 'admin@synov.in');
  assert.equal(await bcrypt.compare('admin123', storedAdmin.password_hash), true);
  assert.equal(initializedDb.prepare('SELECT COUNT(*) AS count FROM admin_users').get().count, 1);
  assert.equal(initializedDb.prepare('SELECT data_json FROM products WHERE id = ?').get('existing-product').data_json, '{"preserved":true}');
  initializedDb.close();

  const app = express();
  app.use(express.json());
  app.use('/api/inventory/auth', inventoryAuthRoutes);
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    const { getInventoryDatabase } = await import('../src/database/inventoryDatabase.js');
    getInventoryDatabase().close();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/inventory/auth`;
  const login = (email, password) => fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginResponse = await login(' ADMIN@SYNOV.IN ', 'admin123');
  assert.equal(loginResponse.status, 200);
  const { token } = await loginResponse.json();
  assert.equal(typeof token, 'string');

  const invalidPassword = await login('admin@synov.in', 'incorrect');
  assert.equal(invalidPassword.status, 401);
  assert.deepEqual(await invalidPassword.json(), { error: 'Invalid email or password' });

  const invalidEmail = await login('unknown@synov.in', 'admin123');
  assert.equal(invalidEmail.status, 401);

  const validSession = await fetch(`${baseUrl}/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(validSession.status, 200);
  assert.deepEqual(await validSession.json(), { authenticated: true });

  const invalidSession = await fetch(`${baseUrl}/session`, {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  assert.equal(invalidSession.status, 401);
  assert.deepEqual(await invalidSession.json(), { authenticated: false });

  const dbCheck = new Database(databasePath, { readonly: true });
  try {
    const admin = dbCheck.prepare('SELECT email, password_hash FROM admin_users WHERE id = ?').get('admin');
    assert.equal(admin.email, 'admin@synov.in');
    assert.notEqual(admin.password_hash, 'admin123');
    assert.equal(await bcrypt.compare('admin123', admin.password_hash), true);
  } finally {
    dbCheck.close();
  }
});
