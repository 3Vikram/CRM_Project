import { describe, expect, it } from 'vitest'
import { assertBalanced, toMinorUnits } from './money.js'

describe('decimal accounting amounts', () => {
  it('converts decimal strings without floating-point arithmetic', () => expect(toMinorUnits('123.4567')).toBe(1234567n))
  it('accepts equal debit and credit totals', () => expect(() => assertBalanced([{ side: 'debit', amount: '0.10' }, { side: 'debit', amount: '0.20' }, { side: 'credit', amount: '0.30' }])).not.toThrow())
  it('rejects unbalanced lines', () => expect(() => assertBalanced([{ side: 'debit', amount: '10.00' }, { side: 'credit', amount: '9.99' }])).toThrow(/debits/))
})
