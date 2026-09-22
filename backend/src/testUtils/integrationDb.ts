// Shared setup for integration tests that hit a real Postgres database.
// Skipped automatically (describe.skipIf) when TEST_DATABASE_URL isn't set,
// so `pnpm test` still passes on a machine without Postgres running.
import pg from 'pg'
import { signAccessToken, type AccountingRole } from '../auth/token.js'

export const TEST_SECRET = 'integration-test-secret'

export function hasTestDb(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL)
}

/** Call in beforeAll: points DATABASE_URL at the test database for the rest of the test file. */
export function useTestDatabase() {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set')
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  process.env.ACCOUNTING_AUTH_SECRET ??= TEST_SECRET
}

let pool: pg.Pool | undefined
export function testPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })
  return pool
}

export async function closeTestPool() {
  if (pool) await pool.end()
  pool = undefined
}

/** Wipes everything except the migration-seeded companies/ledgers/financial years/chart of accounts. */
export async function resetBusinessData() {
  await testPool().query(`
    TRUNCATE TABLE
      audit_events, voucher_lines, vouchers, voucher_sequences,
      purchase_invoice_lines, purchase_invoices, bank_payments,
      migration_reconciliation_results, migration_errors, migration_mappings, migration_records, migration_files, migration_jobs,
      users
    RESTART IDENTITY CASCADE
  `)
  // Not part of the TRUNCATE list above (companies is seed data, not business data),
  // but a test that flips this flag must not leak it into the next test.
  await testPool().query(`UPDATE companies SET require_maker_checker=false`)
}

export function testToken(role: AccountingRole, id = `test-${role}`) {
  return signAccessToken({ id, role, exp: Math.floor(Date.now() / 1000) + 3600 }, process.env.ACCOUNTING_AUTH_SECRET ?? TEST_SECRET)
}

export function authHeader(role: AccountingRole, id?: string) {
  return `Bearer ${testToken(role, id)}`
}
