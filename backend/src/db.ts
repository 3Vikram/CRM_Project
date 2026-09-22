import pg from 'pg'

const { Pool } = pg
let pool: pg.Pool | undefined

export function database(): pg.Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new DatabaseUnavailableError()
  pool ??= new Pool({ connectionString, max: Number(process.env.DB_POOL_SIZE ?? 10) })
  return pool
}

export class DatabaseUnavailableError extends Error {
  status = 503
  constructor() { super('Accounting database is not configured') }
}

export async function closeDatabase() {
  if (pool) await pool.end()
  pool = undefined
}

/** Runs `work` inside a BEGIN/COMMIT block on a single client, rolling back on error. */
export async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
