import type pg from 'pg'
import type { AccountingRole } from './token.js'

export type UserRow = { id: string; email: string; name: string; role: AccountingRole; active: boolean; password_hash: string }
export type PublicUser = { id: string; email: string; name: string; role: AccountingRole; active: boolean }

export function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role, active: row.active }
}

export async function findUserByEmail(pool: pg.Pool, email: string): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(`SELECT id,email,name,role,active,password_hash FROM users WHERE email=$1`, [email])
  return result.rows[0]
}

export async function findUserById(pool: pg.Pool, id: string): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(`SELECT id,email,name,role,active,password_hash FROM users WHERE id=$1`, [id])
  return result.rows[0]
}

export async function createUser(pool: pg.Pool, input: { email: string; name: string; passwordHash: string; role: AccountingRole }): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,email,name,role,active,password_hash`,
    [input.email, input.name, input.passwordHash, input.role],
  )
  return result.rows[0]
}

export async function touchLastLogin(pool: pg.Pool, id: string): Promise<void> {
  await pool.query(`UPDATE users SET last_login_at=now() WHERE id=$1`, [id])
}
