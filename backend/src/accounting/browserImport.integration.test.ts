import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { authHeader, closeTestPool, hasTestDb, resetBusinessData, testPool, useTestDatabase } from '../testUtils/integrationDb.js'

describe.skipIf(!hasTestDb())('Browser data import against a real database', () => {
  const app = createApp()
  const COMPANY = '3vikram'

  beforeAll(async () => { useTestDatabase() })
  beforeEach(async () => { await resetBusinessData() })
  afterAll(async () => { await closeTestPool(); delete process.env.DATABASE_URL })

  // Dates must fall inside the migration-seeded FY 2025-26 (2025-04-01..2026-03-31).
  function payload() {
    return {
      purchaseInvoices: [{
        id: 'legacy-pi-1', number: 'PI-0001', vendor: 'Legacy Vendor', vendorInvoiceNumber: 'LV-1',
        invoiceDate: '2025-06-10', dueDate: '2025-06-20', taxMode: 'intra', notes: 'legacy',
        lines: [{ id: 'line-1', description: 'Stuff', quantity: 1, rate: 1000, gstRate: 18, account: 'Purchases' }],
        status: 'posted',
      }],
      vouchers: [{
        id: 'legacy-v-1', number: 'JR-0001', invoiceNumber: '', date: '2025-06-05', reference: '', narration: 'Opening cash',
        lines: [
          { id: 'l1', account: 'Cash', entryType: 'debit', debit: 5000, credit: 0, description: '' },
          { id: 'l2', account: 'Capital', entryType: 'credit', debit: 0, credit: 5000, description: '' },
        ],
        status: 'posted',
      }],
      bankPayments: [{
        id: 'legacy-bp-1', number: 'BP-0001', date: '2025-06-15', payee: 'Legacy Vendor', bankAccount: 'Cash',
        linkedInvoiceId: 'legacy-pi-1', mode: 'Bank transfer', reference: '', amount: 1180, narration: 'settle',
        clearance: 'Cleared', status: 'posted',
      }],
    }
  }

  it('imports purchase invoices, vouchers, and linked bank payments, and the books balance', async () => {
    const admin = authHeader('administrator')
    const res = await request(app).post(`/api/accounting/companies/${COMPANY}/import/browser`).set('Authorization', admin).send(payload()).expect(201)
    expect(res.body.counts).toMatchObject({
      purchaseInvoices: { created: 1, skipped: 0 },
      vouchers: { created: 1, skipped: 0 },
      bankPayments: { created: 1, skipped: 0 },
    })
    const tb = await request(app).get(`/api/accounting/companies/${COMPANY}/reports/trial-balance?to=2025-12-31`).set('Authorization', admin).expect(200)
    expect(tb.body.totals.balanced).toBe(true)

    const invoices = await request(app).get(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).expect(200)
    expect(invoices.body[0].paymentStatus).toBe('Paid')
  })

  it('running the same payload twice creates each record only once', async () => {
    const admin = authHeader('administrator')
    await request(app).post(`/api/accounting/companies/${COMPANY}/import/browser`).set('Authorization', admin).send(payload()).expect(201)
    const second = await request(app).post(`/api/accounting/companies/${COMPANY}/import/browser`).set('Authorization', admin).send(payload()).expect(201)
    expect(second.body.counts).toMatchObject({
      purchaseInvoices: { created: 0, skipped: 1 },
      vouchers: { created: 0, skipped: 1 },
      bankPayments: { created: 0, skipped: 1 },
    })
    const invoices = await request(app).get(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).expect(200)
    expect(invoices.body).toHaveLength(1)
  })

  it('fails the whole import, writing nothing, when an account name is unknown', async () => {
    const admin = authHeader('administrator')
    const bad = payload()
    bad.vouchers[0].lines[0].account = 'Nonexistent Ledger'
    const res = await request(app).post(`/api/accounting/companies/${COMPANY}/import/browser`).set('Authorization', admin).send(bad)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('UNKNOWN_LEDGER')
    const invoices = await request(app).get(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).expect(200)
    expect(invoices.body).toHaveLength(0)
    const jobs = await testPool().query(`SELECT * FROM migration_jobs WHERE company_id=$1`, [COMPANY])
    expect(jobs.rowCount).toBe(0)
  })
})
