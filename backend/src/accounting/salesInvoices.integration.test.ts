import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { authHeader, closeTestPool, hasTestDb, resetBusinessData, seedTestUser, useTestDatabase } from '../testUtils/integrationDb.js'
import type { InvoiceDraft } from '@crm/shared'

describe.skipIf(!hasTestDb())('Sale invoices against a real database', () => {
  const app = createApp()
  const COMPANY = '3vikram'

  beforeAll(async () => { useTestDatabase() })
  beforeEach(async () => { await resetBusinessData() })
  afterAll(async () => { await closeTestPool(); delete process.env.DATABASE_URL })

  function draft(overrides: Partial<InvoiceDraft> = {}): InvoiceDraft {
    return {
      sellerId: COMPANY,
      buyer: { name: 'Acme Buyer', address: 'Bengaluru', gstin: '29AAACF9405D1ZS', stateName: 'Karnataka', stateCode: '29' },
      shippingSameAsBilling: true,
      consignee: undefined,
      hsn: '997315',
      gstApplicable: true,
      gstRate: 18,
      taxType: 'CGST_SGST',
      roundOff: true,
      returnedBillingRate: 2500,
      invoiceNo: '3VT/SMOKE/1',
      invoiceDate: '2025-06-15',
      billingMonth: { from: '2025-06-01', to: '2025-06-30' },
      lines: [{ rowRef: 1, make: 'DELL', model: 'X1', serial: 'S1', configuration: 'cfg', price: 1000, quantity: 1, isReturned: false, amount: 1000 }],
      toggles: { eInvoice: false, buyersOrder: false, dispatchDetails: false, lineDiscount: false, showRemarks: true, showDeclaration: true, showTc: true, showBank: true },
      footer: {},
      ...overrides,
    } as InvoiceDraft
  }

  it('issues a sale invoice, posts AR/Sales/Output GST, and the trial balance reflects it', async () => {
    const admin = authHeader('administrator')
    const res = await request(app).post('/api/invoices').set('Authorization', admin).send(draft()).expect(201)
    expect(res.body.status).toBe('issued')
    expect(Number(res.body.grandTotal)).toBeCloseTo(1180, 2) // 1000 + 18% GST

    const tb = await request(app).get(`/api/accounting/companies/${COMPANY}/reports/trial-balance?to=2025-12-31`).set('Authorization', admin).expect(200)
    expect(tb.body.totals.balanced).toBe(true)
    const ar = tb.body.rows.find((r: any) => r.name === 'Accounts Receivable')
    const sales = tb.body.rows.find((r: any) => r.name === 'Sales Income')
    expect(Number(ar.debit)).toBeCloseTo(1180, 2)
    expect(Number(sales.credit)).toBeCloseTo(1000, 2)
  })

  it('rejects a duplicate invoice number with 409', async () => {
    const admin = authHeader('administrator')
    await request(app).post('/api/invoices').set('Authorization', admin).send(draft()).expect(201)
    await request(app).post('/api/invoices').set('Authorization', admin).send(draft()).expect(409)
  })

  it('cancelling an issued invoice reverses it back to a balanced zero', async () => {
    const admin = authHeader('administrator')
    const issued = await request(app).post('/api/invoices').set('Authorization', admin).send(draft()).expect(201)
    const cancelled = await request(app).post(`/api/invoices/${issued.body.id}/cancel`).set('Authorization', admin).send({ reason: 'test' }).expect(200)
    expect(cancelled.body.status).toBe('cancelled')
    const tb = await request(app).get(`/api/accounting/companies/${COMPANY}/reports/trial-balance?to=2025-12-31`).set('Authorization', admin).expect(200)
    expect(tb.body.totals.balanced).toBe(true)
    const ar = tb.body.rows.find((r: any) => r.name === 'Accounts Receivable')
    expect(Number(ar.debit) - Number(ar.credit)).toBeCloseTo(0, 4)
  })

  it('rejects mixed-company rows with 422', async () => {
    const admin = authHeader('administrator')
    const res = await request(app).post('/api/invoices').set('Authorization', admin).send(draft({
      lines: [
        { rowRef: 1, make: 'DELL', model: 'X1', serial: 'S1', configuration: 'cfg', price: 1000, quantity: 1, isReturned: false, amount: 1000, company: 'SYNOV' },
        { rowRef: 2, make: 'HP', model: 'X2', serial: 'S2', configuration: 'cfg', price: 500, quantity: 1, isReturned: false, amount: 500, company: '3VIKRAM' },
      ] as any,
    })).expect(422)
    expect(res.body.code).toBe('MIXED_COMPANY')
  })

  it('saves, reads and clears a per-user invoice draft', async () => {
    const { authHeader: admin } = await seedTestUser('administrator')
    await request(app).put('/api/invoice-draft').set('Authorization', admin).send(draft()).expect(204)
    const read = await request(app).get('/api/invoice-draft').set('Authorization', admin).expect(200)
    expect(read.body.draft.invoiceNo).toBe('3VT/SMOKE/1')
    await request(app).delete('/api/invoice-draft').set('Authorization', admin).expect(204)
    const cleared = await request(app).get('/api/invoice-draft').set('Authorization', admin).expect(200)
    expect(cleared.body.draft).toBeNull()
  })
})
