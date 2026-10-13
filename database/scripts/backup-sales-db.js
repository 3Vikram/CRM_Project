const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const projectRoot = path.resolve(__dirname, '..', '..');
const configuredDbPath = process.env.SALES_DB_PATH?.trim();
if (process.env.NODE_ENV === 'production' && !configuredDbPath) {
  throw new Error('SALES_DB_PATH must be configured with an absolute path in production.');
}
if (configuredDbPath && !path.isAbsolute(configuredDbPath)) {
  throw new Error('SALES_DB_PATH must be an absolute path.');
}

const dbPath = configuredDbPath || path.join(projectRoot, 'database', 'sales.db');
const configuredBackupDir = process.env.SALES_BACKUP_DIR?.trim();
if (configuredBackupDir && !path.isAbsolute(configuredBackupDir)) {
  throw new Error('SALES_BACKUP_DIR must be an absolute path.');
}
const backupDir = configuredBackupDir || path.join(projectRoot, 'database', 'backups');

const nextBackupPath = () => {
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  let suffix = 0;
  let candidate;
  do {
    const suffixText = suffix ? `-${suffix}` : '';
    candidate = path.join(backupDir, `sales-${timestamp}${suffixText}.db`);
    suffix += 1;
  } while (fs.existsSync(candidate));
  return candidate;
};

(async () => {
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = nextBackupPath();
  const source = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(backupPath);
  } finally {
    source.close();
  }

  const backup = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    const integrity = backup.pragma('integrity_check')[0].integrity_check;
    const foreignKeyViolations = backup.pragma('foreign_key_check').length;
    if (integrity !== 'ok' || foreignKeyViolations !== 0) {
      throw new Error(`Sales backup validation failed: integrity=${integrity}, foreignKeyViolations=${foreignKeyViolations}`);
    }
  } finally {
    backup.close();
  }

  console.log(JSON.stringify({ backupPath, integrity: 'ok', foreignKeyViolations: 0 }));
})().catch((error) => {
  console.error(`Sales database backup failed: ${error.message}`);
  process.exitCode = 1;
});
