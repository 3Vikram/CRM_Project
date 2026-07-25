import { describe, it, expect } from 'vitest'
import { suggestTaxType } from './services/compute.js'

describe('suggestTaxType', () => {
  it('suggests CGST_SGST when seller and buyer share the same state code', () => {
    expect(suggestTaxType('29', '29', true)).toBe('CGST_SGST')
  })
  it('suggests IGST for an out-of-state buyer', () => {
    expect(suggestTaxType('29', '27', true)).toBe('IGST')
  })
  it('returns NONE when gstApplicable is false, regardless of state', () => {
    expect(suggestTaxType('29', '29', false)).toBe('NONE')
    expect(suggestTaxType('29', '27', false)).toBe('NONE')
  })
  it('falls back to CGST_SGST when either state code is missing', () => {
    expect(suggestTaxType(undefined, '29', true)).toBe('CGST_SGST')
    expect(suggestTaxType('29', '', true)).toBe('CGST_SGST')
  })
})