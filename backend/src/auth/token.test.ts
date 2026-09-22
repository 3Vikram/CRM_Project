import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { signAccessToken } from './token.js'

describe('accounting authentication', () => {
  afterEach(() => { delete process.env.ACCOUNTING_AUTH_SECRET })

  it('rejects company accounting access without a signed token', async () => {
    const response = await request(createApp()).get('/api/accounting/companies')
    expect(response.status).toBe(401)
    expect(response.body.code).toBe('UNAUTHENTICATED')
  })

  it('accepts a valid signed identity before checking database availability', async () => {
    process.env.ACCOUNTING_AUTH_SECRET = 'test-secret'
    const token = signAccessToken({ id: 'user-1', role: 'auditor', exp: Math.floor(Date.now() / 1000) + 60 }, 'test-secret')
    const response = await request(createApp()).get('/api/accounting/companies').set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(503)
    expect(response.body.code).toBe('DATABASE_UNAVAILABLE')
  })
})
