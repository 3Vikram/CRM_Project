#!/usr/bin/env -S node
// Usage: pnpm --filter @crm/backend user:create --email a@b.com --name "Jane Doe" --role accountant
// Prompts for the password on stdin (not an argument, so it doesn't end up in shell history).
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { database, closeDatabase } from '../db.js'
import { hashPassword } from '../auth/password.js'
import { createUser, findUserByEmail } from '../auth/users.js'
import { accountingRoles, type AccountingRole } from '../auth/token.js'

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '')
    if (key) args[key] = argv[i + 1] ?? ''
  }
  return args
}

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout })
  stdout.write(question)
  return new Promise((resolve) => {
    let answer = ''
    const onData = (char: Buffer) => {
      const c = char.toString('utf8')
      if (c === '\n' || c === '\r' || c === '\u0004') {
        stdin.removeListener('data', onData)
        stdout.write('\n')
        rl.close()
        resolve(answer)
      } else if (c === '\u0003') {
        process.exit(1)
      } else if (c === '\u007f') {
        answer = answer.slice(0, -1)
      } else {
        answer += c
      }
    }
    stdin.setRawMode?.(true)
    stdin.resume()
    stdin.on('data', onData)
  })
}

const args = parseArgs(process.argv.slice(2))
const email = args.email
const name = args.name
const role = args.role as AccountingRole

if (!email || !name || !role) {
  console.error('Usage: pnpm --filter @crm/backend user:create --email a@b.com --name "Jane Doe" --role accountant')
  console.error(`Roles: ${accountingRoles.join(', ')}`)
  process.exit(1)
}
if (!accountingRoles.includes(role)) {
  console.error(`Invalid role "${role}". Roles: ${accountingRoles.join(', ')}`)
  process.exit(1)
}

const pool = database()
try {
  const existing = await findUserByEmail(pool, email)
  if (existing) {
    console.error(`A user with email ${email} already exists.`)
    process.exit(1)
  }
  const password = await promptHidden('Password: ')
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }
  const user = await createUser(pool, { email, name, role, passwordHash: await hashPassword(password) })
  console.log(`Created user ${user.email} (${user.role})`)
} finally {
  await closeDatabase()
}
