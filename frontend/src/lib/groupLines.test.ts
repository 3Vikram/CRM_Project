import { describe, it, expect } from 'vitest'
import {
  groupIdentical,
  flattenLines,
  prorateReturned,
  daysBetween,
} from './groupLines'
import type { LineItem } from '@crm/shared'

function row(i: number, make: string, model: string, price: number, extra: Partial<LineItem> = {}): LineItem {
  return {
    rowRef: i,
    make,
    model,
    serial: `S${i}`,
    configuration: `cfg${i}`,
    price,
    quantity: 1,
    isReturned: false,
    amount: price,
    company: '3VIKRAM',
    ...extra,
  }
}

describe('groupIdentical', () => {
  it('collapses non-returned rows sharing make+model+price into one N-Pcs line', () => {
    const rows = [
      row(1, 'LENOVO', 'L14', 3650, { configuration: 'WIN11' }),
      row(2, 'LENOVO', 'L14', 3650, { configuration: 'WIN11PRO' }),
      row(3, 'DELL', '5450', 3650, { configuration: 'I5' }),
    ]
    const grouped = groupIdentical(rows)
    expect(grouped).toHaveLength(2)
    const l14 = grouped.find((g) => g.model === 'L14')!
    expect(l14.quantity).toBe(2)
    expect(l14.serial).toEqual(['S1', 'S2'])
    expect(l14.amount).toBe(7300)
    expect(l14.members).toHaveLength(2)
    // configuration drift does NOT prevent grouping
    expect(l14.members!.map((m) => m.configuration)).toEqual(['WIN11', 'WIN11PRO'])
  })

  it('never absorbs returned rows into a group', () => {
    const rows = [
      row(1, 'LENOVO', 'L14', 3650),
      row(2, 'LENOVO', 'L14', 3650, { isReturned: true, to: '2026-06-15' }),
      row(3, 'LENOVO', 'L14', 3650),
    ]
    const grouped = groupIdentical(rows)
    const nonReturned = grouped.filter((g) => !g.isReturned)
    const returned = grouped.filter((g) => g.isReturned)
    expect(nonReturned.length).toBe(1)
    expect(nonReturned[0].quantity).toBe(2)
    expect(returned).toHaveLength(1)
  })

  it('keeps a lone row as a 1-Pcs line with members preserved', () => {
    const grouped = groupIdentical([row(1, 'DELL', '5450', 3650)])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].quantity).toBe(1)
    expect(grouped[0].members).toHaveLength(1)
  })

  it('can be flattened back to one row per laptop', () => {
    const rows = [
      row(1, 'LENOVO', 'L14', 3650, { configuration: 'WIN11' }),
      row(2, 'LENOVO', 'L14', 3650, { configuration: 'WIN11PRO' }),
      row(3, 'DELL', '5450', 3650),
    ]
    const grouped = groupIdentical(rows)
    const flat = flattenLines(grouped)
    expect(flat).toHaveLength(3)
    expect(flat.every((r) => r.quantity === 1)).toBe(true)
    expect(flat.map((r) => r.configuration)).toEqual(['WIN11', 'WIN11PRO', 'cfg3'])
  })
})

describe('prorateReturned', () => {
  it('computes amount = rate * days/30 rounded to two decimals', () => {
    const r = row(4, 'LENOVO', 'L14', 3650, {
      isReturned: true,
      from: '2026-06-01',
      to: '2026-06-15',
    })
    const p = prorateReturned(r, { returnedBillingRate: 2500, billingMonthFrom: '2026-06-01' })
    const days = daysBetween('2026-06-01', '2026-06-15')
    expect(days).toBe(15)
    expect(p.amount).toBe(Math.round((2500 * 15) / 30 * 100) / 100)
  })

  it('defaults From to the billing-month start when the row has none', () => {
    const r = row(4, 'LENOVO', 'L14', 3650, { isReturned: true, to: '2026-06-10' })
    const p = prorateReturned(r, { returnedBillingRate: 2500, billingMonthFrom: '2026-06-01' })
    expect(p.from).toBe('2026-06-01')
    expect(p.to).toBe('2026-06-10')
    // 10 days inclusive → 2500 * 10 / 30 = 833.33
    expect(p.amount).toBe(833.33)
  })
})