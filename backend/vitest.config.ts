import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'

// Load ../.env (repo root) if present, without adding a dependency. Existing
// process.env values (e.g. from CI) win. DATABASE_URL is deliberately NOT
// loaded here: unit tests rely on it being absent, and integration test
// files that need a real database set it explicitly from TEST_DATABASE_URL.
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match && match[1] !== 'DATABASE_URL' && !(match[1] in process.env)) process.env[match[1]] = match[2]
  }
} catch {}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: [],
  },
})