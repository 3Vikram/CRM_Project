#!/usr/bin/env node
// Drops and recreates the public schema, then re-runs migrations and the dev seed.
// Refuses to run against anything that isn't a local database, since this is destructive.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import pg from 'pg'

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2]
    }
  } catch {}
}
loadEnvFile(new URL('../.env', import.meta.url))

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.')
  process.exit(1)
}

const url = new URL(connectionString)
if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
  console.error(`Refusing to reset a non-local database (host: ${url.hostname}).`)
  process.exit(1)
}

const pool = new pg.Pool({ connectionString })
await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
await pool.end()
console.log('Schema reset.')

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
run('pnpm', ['--filter', '@crm/backend', 'db:migrate'])
run('pnpm', ['--filter', '@crm/backend', 'db:seed'])
console.log('Database reset complete.')
