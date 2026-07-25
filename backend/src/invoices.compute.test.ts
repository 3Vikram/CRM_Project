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

  it('exposes suggestedTaxType matching the seller<->buyer state', async () => {
    const app = createApp()
    const intra = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ taxType: 'CGST_SGST' }))
      .expect(200)
    expect(intra.body.suggestedTaxType).toBe('CGST_SGST')
    const inter = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ buyer: { ...baseDraft().buyer, stateCode: '27', stateName: 'Maharashtra' } }))
      .expect(200)
    expect(inter.body.suggestedTaxType).toBe('IGST')
    // even when the operator overrides to CGST_SGST, suggested stays IGST
    expect(inter.body.taxType).toBe('CGST_SGST')
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

  it('carries stacked sub-lines for grouped members and sums their amount/tax', async () => {
    const app = createApp()
    const groupedLines = [
      {
        rowRef: 1,
        make: 'LENOVO',
        model: 'L14',
        serial: ['S1', 'S2'],
        configuration: 'WIN11 / WIN11PRO',
        price: 3650,
        quantity: 2,
        isReturned: false,
        amount: 7300,
        company: '3VIKRAM',
        members: [
          { rowRef: 1, serial: 'S1', configuration: 'WIN11', from: '2025-12-01', to: '2025-12-31', isReturned: false },
          { rowRef: 2, serial: 'S2', configuration: 'WIN11PRO', from: '2025-12-01', to: '2025-12-31', isReturned: false },
        ],
      },
    ]
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ lines: groupedLines as any }))
      .expect(200)
    const body = res.body
    expect(body.lines[0].quantity).toBe(2)
    expect(body.lines[0].subLines.length).toBe(2)
    expect(body.lines[0].subLines[0].serial).toBe('S1')
    expect(body.taxableTotal).toBe(7300)
    expect(body.totalTax).toBeCloseTo((18 / 100) * 7300, 2)
  })

  it('blocks compute when rows mix COMPANY into an empty-lines mixedCompany response', async () => {
    const app = createApp()
    const lines = [
      { ...line1(), company: 'SYNOV' },
      { ...line2(), company: '3VIKRAM' },
    ]
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ lines: lines as any }))
      .expect(200)
    const body = res.body
    expect(body.mixedCompany).toBe(true)
    expect(body.mixedCompanyWarning).toBeTruthy()
    expect(body.lines).toEqual([])
    expect(body.taxableTotal).toBe(0)
    expect(body.companyBreakdown.map((c: any) => c.company).sort()).toEqual(['3VIKRAM', 'SYNOV'])
  })

  it('resolves the seller footer blocks (remarks/declaration/terms/bank) from preset when toggles on', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({
        sellerId: '3vikram',
        footer: {}, // blank -> fall back to seller preset
        invoiceNo: '3VT/177/2026-27',
        lines: [{ ...line2(), company: '3VIKRAM' }],
      }))
      .expect(200)
    const body = res.body
    const f = body.resolvedFooter
    expect(f).toBeDefined()
    expect(f.remarks).toContain('Rental Invoice')
    expect(f.remarks).toContain('December 2025')
    expect(f.declaration).toBeTruthy()
    expect(f.terms).toContain('Interest @24%')
    expect(f.bank?.ifsc).toBe('HDFC0000446')
    expect(body.seller.invoicePrefix).toBe('3VT/')
  })

  it('omits resolved footer fields when their toggle is off', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({
        footer: {},
        toggles: {
          eInvoice: false, buyersOrder: false, dispatchDetails: false, lineDiscount: false,
          showRemarks: false, showDeclaration: true, showTc: false, showBank: false,
        },
      }))
      .expect(200)
    const f = res.body.resolvedFooter
    expect(f.remarks).toBeUndefined()
    expect(f.terms).toBeUndefined()
    expect(f.bank).toBeUndefined()
    expect(f.declaration).toBeTruthy()
  })

  it('round-off line carries the signed paise diff to the nearest ₹1', async () => {
    const app = createApp()
    const lines = [{ ...line1(), amount: 100.48 }, { ...line2(), amount: 0 }]
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ lines: lines as any, roundOff: true, gstApplicable: false }))
      .expect(200)
    const body = res.body
    expect(body.grandTotal).toBeCloseTo(100.48, 2)
    expect(body.roundedGrandTotal).toBe(100)
    expect(body.roundOff.difference).toBeCloseTo(-0.48, 2)
    expect(body.roundOff.label).toContain('Rounded Off')
    // words describe the rounded grand total, not the pre-round value
    expect(body.amountInWords).toBe('Rupees One Hundred Only')
  })

  it('rounds mid-values up via Math.round and emits a positive diff', async () => {
    const app = createApp()
    const lines = [{ ...line1(), amount: 1000.6 }, { ...line2(), amount: 0 }]
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ lines: lines as any, roundOff: true, gstApplicable: false }))
      .expect(200)
    const body = res.body
    expect(body.roundedGrandTotal).toBe(1001)
    expect(body.roundOff.difference).toBeCloseTo(0.4, 2)
  })

  it('tax words include paise when total tax has paise', async () => {
    const app = createApp()
    const lines = [{ ...line1(), amount: 100.01 }, { ...line2(), amount: 0 }]
    const res = await request(app)
      .post('/api/invoices/compute')
      .send(baseDraft({ lines: lines as any, roundOff: false }))
      .expect(200)
    const body = res.body
    // tax = 100.01 * 0.18 = 18.0018 -> 18.00 (round2)
    // taxable = 100.01 -> tax = 18.00
    expect(body.taxInWords).toBe('Rupees Eighteen Only')
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