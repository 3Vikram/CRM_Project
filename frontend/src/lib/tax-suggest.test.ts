import { describe, it, expect } from 'vitest'
import { suggestTaxTypeFor } from './tax-suggest'
import type { Entity, InvoiceDraft } from '@crm/shared'

const seller = (stateCode: string): Entity =>
  ({
    id: 'synov',
    name: 'SYNOV',
    shortName: 'SYNOV',
    legalName: 'x',
    address: 'x',
    stateCode,
    stateName: 'x',
    gstin: '29ABICS1686C1Z4',
    pan: 'x',
    email: '',
    contact: '',
    invoicePrefix: 'SISPL/',
    eInvoiceDefault: false,
  }) as unknown as Entity

const buyer = (stateCode: string): InvoiceDraft['buyer'] =>
  ({ name: '', address: '', gstin: '', stateName: '', stateCode })

describe('suggestTaxTypeFor', () => {
  it('suggests CGST_SGST when seller and buyer share the state code', () => {
    expect(suggestTaxTypeFor(seller('29'), buyer('29'), true)).toBe('CGST_SGST')
  })
  it('suggests IGST for an out-of-state buyer', () => {
    expect(suggestTaxTypeFor(seller('29'), buyer('27'), true)).toBe('IGST')
  })
  it('returns NONE when gstApplicable is off', () => {
    expect(suggestTaxTypeFor(seller('29'), buyer('29'), false)).toBe('NONE')
  })
  it('falls back to CGST_SGST when a state code is missing', () => {
    expect(suggestTaxTypeFor(seller('29'), buyer(''), true)).toBe('CGST_SGST')
    expect(suggestTaxTypeFor(undefined, buyer('29'), true)).toBe('CGST_SGST')
  })
})