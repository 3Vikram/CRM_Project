import { database, closeDatabase } from './db.js'
import { findUserByEmail, createUser } from './auth/users.js'
import { hashPassword } from './auth/password.js'

const email = process.env.SEED_ADMIN_EMAIL
const password = process.env.SEED_ADMIN_PASSWORD
if (!email || !password) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set')

const pool = database()
try {
  const existing = await findUserByEmail(pool, email)
  if (existing) {
    console.log(`Admin user ${email} already exists`)
  } else {
    await createUser(pool, { email, name: 'Admin', passwordHash: await hashPassword(password), role: 'administrator' })
    console.log(`Created admin user ${email}`)
  }
} finally { await closeDatabase() }
