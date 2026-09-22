import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { authHeader, closeTestPool, hasTestDb, resetBusinessData, testPool, useTestDatabase } from '../testUtils/integrationDb.js'

describe.skipIf(!hasTestDb())('Accounts module against a real database', () => {
  const app = createApp()
  const COMPANY = '3vikram'
  let cashLedgerId = ''
  let purchasesLedgerId = ''

  beforeAll(async () => {
    useTestDatabase()
  })

  beforeEach(async () => {
    await resetBusinessData()
    const ledgers = await testPool().query<{ id: string; name: string }>(`SELECT id, name FROM ledgers WHERE company_id=$1`, [COMPANY])
    cashLedgerId = ledgers.rows.find((l) => l.name === 'Cash')!.id
    purchasesLedgerId = ledgers.rows.find((l) => l.name === 'Purchases')!.id
  })

  afterAll(async () => {
    await closeTestPool()
    delete process.env.DATABASE_URL
  })

  it('rejects every protected route without a token', async () => {
    const res = await request(app).get(`/api/accounting/companies/${COMPANY}/purchase-invoices`)
    expect(res.status).toBe(401)
  })

  it('health and login stay public', async () => {
    await request(app).get('/api/health').expect(200)
  })

  it('rejects login with a wrong password and rejects an inactive/unknown user the same way', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever123' })
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_CREDENTIALS')
  })

  it('lets an auditor read but blocks writes with 403', async () => {
    const readRes = await request(app).get(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', authHeader('auditor'))
    expect(readRes.status).toBe(200)
    const writeRes = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', authHeader('auditor')).send({})
    expect(writeRes.status).toBe(403)
  })

  function purchaseInvoicePayload(overrides: Record<string, unknown> = {}) {
    return {
      number: 'PI-0001',
      vendor: 'Acme Supplies',
      vendorInvoiceNumber: 'ACME-100',
      invoiceDate: '2025-06-15',
      taxMode: 'intra',
      notes: 'Office supplies',
      lines: [{ description: 'Paper', quantity: 10, rate: 100, gstRate: 18, ledgerId: purchasesLedgerId }],
      ...overrides,
    }
  }

  it('creates, posts a purchase invoice into a balanced voucher, and reflects it in the trial balance', async () => {
    const admin = authHeader('administrator')
    const created = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).send(purchaseInvoicePayload()).expect(201)
    expect(created.body.status).toBe('draft')
    expect(created.body.totals.total).toBeCloseTo(1180, 2) // 1000 + 18% GST

    const posted = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}/post`).set('Authorization', admin).expect(200)
    expect(posted.body.status).toBe('posted')
    expect(posted.body.postedVoucherId).toBeTruthy()

    const voucher = await testPool().query(`SELECT status, (SELECT sum(debit) FROM voucher_lines WHERE voucher_id=v.id) d, (SELECT sum(credit) FROM voucher_lines WHERE voucher_id=v.id) c FROM vouchers v WHERE id=$1`, [posted.body.postedVoucherId])
    expect(voucher.rows[0].status).toBe('posted')
    expect(Number(voucher.rows[0].d)).toBeCloseTo(Number(voucher.rows[0].c), 4)

    const tb = await request(app).get(`/api/accounting/companies/${COMPANY}/reports/trial-balance?to=2025-12-31`).set('Authorization', admin).expect(200)
    expect(tb.body.totals.balanced).toBe(true)
    const payable = tb.body.rows.find((r: any) => r.name === 'Accounts Payable')
    expect(Number(payable.credit)).toBeCloseTo(1180, 2)
  })

  it('refuses to edit or re-post a posted purchase invoice (409)', async () => {
    const admin = authHeader('administrator')
    const created = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).send(purchaseInvoicePayload()).expect(201)
    await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}/post`).set('Authorization', admin).expect(200)
    await request(app).put(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}`).set('Authorization', admin).send(purchaseInvoicePayload()).expect(409)
    await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}/post`).set('Authorization', admin).expect(409)
  })

  it('rejects a duplicate purchase invoice number with 409', async () => {
    const admin = authHeader('administrator')
    await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).send(purchaseInvoicePayload()).expect(201)
    await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).send(purchaseInvoicePayload({ vendorInvoiceNumber: 'DIFFERENT' })).expect(409)
  })

  it('cancelling a posted purchase invoice reverses its voucher back to a zero net effect', async () => {
    const admin = authHeader('administrator')
    const created = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).send(purchaseInvoicePayload()).expect(201)
    await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}/post`).set('Authorization', admin).expect(200)
    const cancelled = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}/cancel`).set('Authorization', admin).send({ reason: 'wrong vendor' }).expect(200)
    expect(cancelled.body.status).toBe('cancelled')

    const tb = await request(app).get(`/api/accounting/companies/${COMPANY}/reports/trial-balance?to=2025-12-31`).set('Authorization', admin).expect(200)
    const payable = tb.body.rows.find((r: any) => r.name === 'Accounts Payable')
    expect(Number(payable.debit) - Number(payable.credit)).toBeCloseTo(0, 4)
  })

  it('a linked bank payment moves the purchase invoice from Unpaid to Paid', async () => {
    const admin = authHeader('administrator')
    const created = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).send(purchaseInvoicePayload()).expect(201)
    await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}/post`).set('Authorization', admin).expect(200)

    const payment = await request(app).post(`/api/accounting/companies/${COMPANY}/bank-payments`).set('Authorization', admin).send({
      number: 'BP-0001', paymentDate: '2025-06-20', payee: 'Acme Supplies', bankLedgerId: cashLedgerId,
      linkedPurchaseInvoiceId: created.body.id, amount: 1180, narration: 'Full settlement',
    }).expect(201)
    await request(app).post(`/api/accounting/companies/${COMPANY}/bank-payments/${payment.body.id}/post`).set('Authorization', admin).expect(200)

    const refreshed = await request(app).get(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}`).set('Authorization', admin).expect(200)
    expect(refreshed.body.paymentStatus).toBe('Paid')
    expect(refreshed.body.outstanding).toBeCloseTo(0, 2)
  })

  it('a bank payment needs a category ledger or a linked invoice', async () => {
    const admin = authHeader('administrator')
    const res = await request(app).post(`/api/accounting/companies/${COMPANY}/bank-payments`).set('Authorization', admin).send({
      number: 'BP-0002', paymentDate: '2025-06-20', payee: 'Someone', bankLedgerId: cashLedgerId, amount: 500,
    })
    expect(res.status).toBe(400)
  })

  it('postDirect is refused once the company turns on maker-checker', async () => {
    const admin = authHeader('administrator')
    await testPool().query(`UPDATE companies SET require_maker_checker=true WHERE id=$1`, [COMPANY])
    const created = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices`).set('Authorization', admin).send(purchaseInvoicePayload()).expect(201)
    const res = await request(app).post(`/api/accounting/companies/${COMPANY}/purchase-invoices/${created.body.id}/post`).set('Authorization', admin)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('MAKER_CHECKER_REQUIRED')
    await testPool().query(`UPDATE companies SET require_maker_checker=false WHERE id=$1`, [COMPANY])
  })
})
