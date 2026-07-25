import { describe, it, expect } from 'vitest'
import { EntitySchema, InvoiceDraftSchema } from './index'

describe('shared schemas', () => {
  it('parses a minimal entity', () => {
    const e = EntitySchema.parse({
      id: 'x',
      name: 'X',
      shortName: 'X',
      legalName: 'X',
      address: '',
      stateCode: '29',
      stateName: 'Karnataka',
      gstin: '29APPPK7534R1ZR',
      pan: 'APPPK7534R',
      email: '',
      contact: '',
      invoicePrefix: 'X/',
      eInvoiceDefault: false,
      bank: { holderName: '', bankName: '', accountNo: '', branch: '', ifsc: 'HDFC0000446' },
      declaration: '',
      terms: '',
      remarksTemplate: '',
    })
    expect(e.id).toBe('x')
  })

  it('rejects an empty draft', () => {
    const r = InvoiceDraftSchema.safeParse({})
    expect(r.success).toBe(false)
  })
})