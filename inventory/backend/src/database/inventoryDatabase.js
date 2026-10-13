import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, '../../../../');
dotenv.config({ path: path.resolve(moduleDirectory, '../../.env') });
const configuredPath = process.env.INVENTORY_DB_PATH?.trim();

if (configuredPath && !path.isAbsolute(configuredPath)) {
  throw new Error('INVENTORY_DB_PATH must be an absolute path.');
}

const dbPath = configuredPath || path.join(projectRoot, 'database', 'inventory.db');
let database;

export const getInventoryDatabase = () => {
  if (database) return database;

  database = new Database(dbPath);
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return database;
};

export { dbPath };
