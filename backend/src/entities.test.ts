import { describe, it, expect } from 'vitest'
import { ENTITIES } from './config/entities.js'

describe('entity presets', () => {
  it('exposes the two known sellers with full header fields', () => {
    const ids = ENTITIES.map((e) => e.id).sort()
    expect(ids).toEqual(['3vikram', 'synov'])

    for (const e of ENTITIES) {
      expect(e.name).toBeTruthy()
      expect(e.address).toBeTruthy()
      expect(e.gstin).toMatch(/^\d{2}[A-Z0-9]/)
      expect(e.pan).toMatch(/[A-Z]{5}\d{4}[A-Z]/)
      expect(e.stateCode).toBe('29')
      expect(e.stateName).toBe('Karnataka')
      expect(e.bank.holderName).toBeTruthy()
      expect(e.bank.ifsc).toMatch(/^[A-Z]{4}0[A-Z0-9]{6}$/)
      expect(e.invoicePrefix).toMatch(/\/$/)
    }
  })

  it('defaults e-Invoice on for 3Vikram and off for SYNOV', () => {
    const three = ENTITIES.find((e) => e.id === '3vikram')!
    const synov = ENTITIES.find((e) => e.id === 'synov')!
    expect(three.eInvoiceDefault).toBe(true)
    expect(synov.eInvoiceDefault).toBe(false)
  })
})