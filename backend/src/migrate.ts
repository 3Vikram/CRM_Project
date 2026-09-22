import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { database, closeDatabase } from './db.js'

const migrations = ['001_accounting_foundation.sql', '002_auth_and_platform.sql', '003_accounting_documents.sql', '004_sales_invoices.sql', '005_voucher_number_per_fy.sql']
const pool = database()

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  for (const name of migrations) {
    const done = await pool.query(`SELECT 1 FROM schema_migrations WHERE name=$1`, [name])
    if (done.rowCount) continue
    const sql = await readFile(resolve(process.cwd(), 'sql', name), 'utf8')
    const client = await pool.connect()
    try { await client.query('BEGIN'); await client.query(sql); await client.query(`INSERT INTO schema_migrations(name) VALUES($1)`, [name]); await client.query('COMMIT'); console.log(`Applied ${name}`) }
    catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
} finally { await closeDatabase() }
