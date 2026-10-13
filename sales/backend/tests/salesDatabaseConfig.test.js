const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const databaseModule = path.join(backendRoot, 'utils', 'salesDatabase.js');

const runDatabaseProcess = (env, script = `require(${JSON.stringify(databaseModule)})`) => spawnSync(
  process.execPath,
  ['-e', script],
  {
    cwd: backendRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', SALES_DB_PATH: '', ...env },
  },
);

test('production database startup requires an explicit absolute path', () => {
  const missingPath = runDatabaseProcess({});
  assert.notEqual(missingPath.status, 0);
  assert.match(missingPath.stderr, /SALES_DB_PATH must be configured/);

  const relativePath = runDatabaseProcess({ SALES_DB_PATH: 'data/sales.db' });
  assert.notEqual(relativePath.status, 0);
  assert.match(relativePath.stderr, /SALES_DB_PATH must be an absolute path/);
});

test('production initializes SQLite at the configured path with foreign keys enabled', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-db-config-'));
  const configuredPath = path.join(directory, 'sales.sqlite');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const script = `
    const { db, dbPath } = require(${JSON.stringify(databaseModule)});
    console.log(JSON.stringify({
      dbPath,
      foreignKeys: db.pragma('foreign_keys')[0].foreign_keys,
      integrity: db.pragma('integrity_check')[0].integrity_check,
      foreignKeyViolations: db.pragma('foreign_key_check').length,
      leadsTable: Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'leads'").get()),
      customersTable: Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'customers'").get()),
      companyProfilesTable: Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'company_profiles'").get()),
      emailLogsTable: Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'email_logs'").get()),
    }));
    db.close();
  `;
  const result = runDatabaseProcess({ SALES_DB_PATH: configuredPath }, script);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    dbPath: configuredPath,
    foreignKeys: 1,
    integrity: 'ok',
    foreignKeyViolations: 0,
    leadsTable: true,
    customersTable: true,
    companyProfilesTable: true,
    emailLogsTable: true,
  });
});

test('Sales records persist after reopening SQLite in a separate process', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-db-restart-'));
  const configuredPath = path.join(directory, 'sales.sqlite');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const leadModel = path.join(backendRoot, 'models', 'Lead.js');
  const createScript = `
    const { db } = require(${JSON.stringify(databaseModule)});
    const Lead = require(${JSON.stringify(leadModel)});
    const lead = Lead.create({
      companyName: 'SQLite restart persistence test',
      contactPerson: 'Test Contact',
      email: 'restart@example.test',
      mobile: '5550100',
      createdBy: 'database-config-test',
    });
    console.log(JSON.stringify({ id: lead._id }));
    db.close();
  `;
  const created = runDatabaseProcess({ SALES_DB_PATH: configuredPath }, createScript);
  assert.equal(created.status, 0, created.stderr);
  const { id } = JSON.parse(created.stdout);

  const readScript = `
    const { db } = require(${JSON.stringify(databaseModule)});
    const Lead = require(${JSON.stringify(leadModel)});
    const lead = Lead.findById(process.env.SALES_TEST_LEAD_ID);
    console.log(JSON.stringify({ companyName: lead?.companyName }));
    db.close();
  `;
  const reopened = runDatabaseProcess({
    SALES_DB_PATH: configuredPath,
    SALES_TEST_LEAD_ID: id,
  }, readScript);

  assert.equal(reopened.status, 0, reopened.stderr);
  assert.deepEqual(JSON.parse(reopened.stdout), {
    companyName: 'SQLite restart persistence test',
  });
});

test('Sales backup script creates a validated backup outside the live database path', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-db-backup-'));
  const configuredPath = path.join(directory, 'sales.sqlite');
  const backupDirectory = path.join(directory, 'backups');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const initialize = runDatabaseProcess({
    SALES_DB_PATH: configuredPath,
  }, `
    const { db } = require(${JSON.stringify(databaseModule)});
    db.prepare("INSERT INTO leads (id, company_name) VALUES (?, ?)").run('backup-test-id', 'Backup test record');
    db.close();
  `);
  assert.equal(initialize.status, 0, initialize.stderr);

  const backupScript = path.resolve(backendRoot, '..', '..', 'database', 'scripts', 'backup-sales-db.js');
  const result = spawnSync(process.execPath, [backupScript], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      SALES_DB_PATH: configuredPath,
      SALES_BACKUP_DIR: backupDirectory,
    },
  });
  assert.equal(result.status, 0, result.stderr);

  const { backupPath, integrity, foreignKeyViolations } = JSON.parse(result.stdout);
  assert.equal(integrity, 'ok');
  assert.equal(foreignKeyViolations, 0);
  assert.notEqual(path.resolve(backupPath), path.resolve(configuredPath));

  const backup = new (require('better-sqlite3'))(backupPath, { readonly: true, fileMustExist: true });
  assert.equal(backup.prepare('SELECT company_name FROM leads WHERE id = ?').get('backup-test-id').company_name, 'Backup test record');
  backup.close();
});
