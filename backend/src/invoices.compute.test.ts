import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import type { InvoiceDraft } from '@crm/shared'

function line1(amount = 4200) {
  return {
    rowRef: 1,
    make: 'LENOVO',
    model: 'L14',
    serial: 'PW0GR96Q',
    configuration: 'ULTRA 7 - 155U/32GBRAM/512GBSSD/WINDOWS 11/ADAPTER/BOXPIECE/BAG',
    price: 4200,
    quantity: 1,
    isReturned: true,
    amount,
  }
}

function line2(amount = 3650) {
  return {
    rowRef: 2,
    make: 'DELL LATITUDE',
    model: '5450',
    serial: 'JK530B4',
    configuration: 'I5/13THGEN/32GBRAM/512GBSSD/WINDOWS11/ADAPTER/BAG',
    price: 3650,
    quantity: 1,
    isReturned: false,
    amount,
  }
}

function baseDraft(overrides: Partial<InvoiceDraft> = {}): InvoiceDraft {
  return {
    sellerId: 'synov',
    buyer: {
      name: 'Flatworld Solutions Pvt.Ltd.',
      address: 'No.6. Opp. BPCL Petrol Bunk., Dodda Banasawadi., Bengaluru-560001',
      gstin: '29AAACF9405D1ZS',
      stateName: 'Karnataka',
      stateCode: '29',
    },
    shippingSameAsBilling: true,
    consignee: undefined,
    hsn: '997315',
    gstApplicable: true,
    gstRate: 18,
    taxType: 'CGST_SGST',
    roundOff: false,
    returnedBillingRate: 2500,
    invoiceNo: 'SISPL/403/25-26',
    invoiceDate: '2025-12-31',
    billingMonth: { from: '2025-12-01', to: '2025-12-31' },
    lines: [line1(), line2()],
    toggles: {
      eInvoice: false,
      buyersOrder: false,
      dispatchDetails: false,
      lineDiscount: false,
      showRemarks: true,
      showDeclaration: true,
      showTc: true,
      showBank: true,
    },
    footer: {
      remarks: 'Being Rental Invoice Raised for the Month of December 2025 (KVAS)',
    },
    ...overrides,
  } as InvoiceDraft
}

describe('GET /api/entities', () => {
  it('returns the two seller presets with full fields', async () => {
    const app = createApp()
    const res = await request(app).get('/api/entities').expect(200)
    const ids = (res.body as { id: string }[]).map((e) => e.id).sort()
    expect(ids).toEqual(['3vikram', 'synov'])
    for (const e of res.body as any[]) {
      expect(e.stateCode).toBe('29')
      expect(e.bank?.ifsc).toBeTruthy()
    }
  })
})

describe('POST /api/invoices/compute', () => {
  it('splits CGST/SGST as equal 9%/9% halves on taxable value (intra-state 18%)', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft())
      .expect(200)
    const body = res.body
    const taxable = line1().amount + line2().amount // 7850
    expect(body.taxableTotal).toBe(taxable)
    expect(body.cgst.rate).toBe(9)
    expect(body.sgst.rate).toBe(9)
    expect(body.cgst.amount).toBeCloseTo((9 / 100) * taxable, 2)
    expect(body.sgst.amount).toBeCloseTo((9 / 100) * taxable, 2)
    expect(body.totalTax).toBeCloseTo((18 / 100) * taxable, 2)
    expect(body.grandTotal).toBeCloseTo(taxable + (18 / 100) * taxable, 2)
    expect(body.taxType).toBe('CGST_SGST')
    expect(body.igst).toBeUndefined()
  })

  it('charges IGST as a single full-rate line when taxType is IGST', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ taxType: 'IGST' }))
      .expect(200)
    const body = res.body
    const taxable = 7850
    expect(body.igst.rate).toBe(18)
    expect(body.igst.amount).toBeCloseTo((18 / 100) * taxable, 2)
    expect(body.cgst).toBeUndefined()
    expect(body.sgst).toBeUndefined()
    expect(body.taxType).toBe('IGST')
  })

  it('suppresses all tax when gstApplicable is false', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ gstApplicable: false }))
      .expect(200)
    const body = res.body
    expect(body.cgst).toBeUndefined()
    expect(body.sgst).toBeUndefined()
    expect(body.igst).toBeUndefined()
    expect(body.totalTax).toBe(0)
    expect(body.grandTotal).toBe(7850)
    expect(body.taxType).toBe('NONE')
  })

  it('applies per-line discount before tax', async () => {
    const app = createApp()
    const lines = [
      { ...line1(), amount: 4200, discount: 200 },
      { ...line2(), amount: 3650, discount: 150 },
    ]
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ lines: lines as any }))
      .expect(200)
    const body = res.body
    expect(body.taxableTotal).toBe(4200 + 3650 - 200 - 150) // 7500
    expect(body.totalTax).toBeCloseTo((18 / 100) * 7500, 2)
  })

  it('ignores taxType override when gstApplicable is false', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ gstApplicable: false, taxType: 'IGST' }))
      .expect(200)
    expect(res.body.taxType).toBe('NONE')
    expect(res.body.igst).toBeUndefined()
  })

  it('rounds the grand total and emits a signed Rounded Off line', async () => {
    const app = createApp()
    const lines = [{ ...line1(), amount: 100.48 }, { ...line2(), amount: 0 }]
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ lines: lines as any, roundOff: true, gstApplicable: false }))
      .expect(200)
    const body = res.body
    expect(body.grandTotal).toBeCloseTo(100.48, 2)
    expect(body.roundedGrandTotal).toBe(100)
    expect(body.roundOff).toBeDefined()
    expect(body.amountInWords).toContain('One Hundred')
  })

  it('keeps paise when roundOff is off', async () => {
    const app = createApp()
    const lines = [{ ...line1(), amount: 100.48 }, { ...line2(), amount: 0 }]
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ lines: lines as any, roundOff: false, gstApplicable: false }))
      .expect(200)
    const body = res.body
    expect(body.roundOff).toBeUndefined()
    expect(body.roundedGrandTotal).toBeCloseTo(100.48, 2)
  })

  it('rejects a malformed draft with 4xx', async () => {
    const app = createApp()
    await request(app)
      .post('/api/invoices/compute')
      .send({ not: 'a draft' })
      .expect(400)
  })
})

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const app = createApp()
    await request(app).get('/api/health').expect(200, { ok: true })
  })
})