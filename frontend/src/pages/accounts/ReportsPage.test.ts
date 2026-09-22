import { describe, expect, it } from 'vitest'
import { agingBuckets, groupByMonth, monthlyCashFlow, topN } from './ReportsPage'
import type { BankPayment, PurchaseInvoice } from '@/lib/queries/accounting'

function invoice(overrides: Partial<PurchaseInvoice>): PurchaseInvoice {
  return {
    id: 'i1', companyId: 'c1', number: 'PI-1', vendor: 'Acme', vendorGstin: null, vendorInvoiceNumber: 'V-1',
    invoiceDate: '2026-01-01', dueDate: null, taxMode: 'none', notes: '',
    status: 'posted', postedVoucherId: null, lines: [],
    totals: { taxable: 100, cgst: 0, sgst: 0, igst: 0, gst: 0, total: 100 }, paidAmount: 0, outstanding: 100,
    ...overrides,
  }
}
function payment(overrides: Partial<BankPayment>): BankPayment {
  return {
    id: 'p1', companyId: 'c1', number: 'BP-1', paymentDate: '2026-01-01', payee: 'Acme',
    bankLedgerId: 'l1', categoryLedgerId: null, linkedPurchaseInvoiceId: null,
    mode: 'NEFT', reference: '', amount: '100', narration: '',
    clearance: 'Cleared', status: 'posted', postedVoucherId: null,
    ...overrides,
  }
}

describe('groupByMonth', () => {
  it('buckets by the date string prefix, not a Date() object', () => {
    const result = groupByMonth([{ date: '2026-01-31', amount: 10 }, { date: '2026-01-01', amount: 5 }, { date: '2026-02-01', amount: 7 }])
    expect(result.get('2026-01')).toBe(15)
    expect(result.get('2026-02')).toBe(7)
  })
})

describe('monthlyCashFlow', () => {
  it('produces 12 months ending at asOf, with amounts in the right months', () => {
    const purchases = [invoice({ invoiceDate: '2026-01-15', totals: { taxable: 100, cgst: 0, sgst: 0, igst: 0, gst: 0, total: 100 } })]
    const payments = [payment({ paymentDate: '2026-01-15', amount: '40' })]
    const rows = monthlyCashFlow(purchases, payments, '2026-01-31')
    expect(rows).toHaveLength(12)
    expect(rows[11]).toEqual({ month: expect.any(String), purchases: 100, payments: 40 })
    expect(rows.slice(0, 11).every((r) => r.purchases === 0 && r.payments === 0)).toBe(true)
  })
})

describe('agingBuckets', () => {
  const asOf = '2026-06-30'
  it('classifies by days overdue at the bucket boundaries', () => {
    const purchases = [
      invoice({ id: 'not-due', dueDate: '2026-07-01', outstanding: 10 }),
      invoice({ id: 'due-today', dueDate: '2026-06-30', outstanding: 20 }),
      invoice({ id: 'day-30', dueDate: '2026-05-31', outstanding: 30 }), // exactly 30 days overdue
      invoice({ id: 'day-31', dueDate: '2026-05-30', outstanding: 40 }), // exactly 31 days overdue
      invoice({ id: 'day-90', dueDate: '2026-04-01', outstanding: 50 }),
      invoice({ id: 'day-91', dueDate: '2026-03-31', outstanding: 60 }),
    ]
    const buckets = Object.fromEntries(agingBuckets(purchases, asOf).map((b) => [b.bucket, b.amount]))
    expect(buckets['Not due']).toBe(30) // due-today + not-due are both <=0 days overdue
    expect(buckets['0-30 days']).toBe(30)
    expect(buckets['31-60 days']).toBe(40)
    expect(buckets['61-90 days']).toBe(50)
    expect(buckets['90+ days']).toBe(60)
  })
  it('ignores invoices with nothing outstanding', () => {
    const buckets = agingBuckets([invoice({ outstanding: 0, dueDate: '2020-01-01' })], asOf)
    expect(buckets.every((b) => b.amount === 0)).toBe(true)
  })
})

describe('topN', () => {
  it('keeps the top n by amount and rolls the rest into Others', () => {
    const items = [{ k: 'a', v: 30 }, { k: 'b', v: 10 }, { k: 'c', v: 20 }, { k: 'd', v: 5 }]
    const result = topN(items, (x) => x.k, (x) => x.v, 2)
    expect(result).toEqual([['a', 30], ['c', 20], ['Others', 15]])
  })
  it('omits Others when everything fits', () => {
    const items = [{ k: 'a', v: 30 }]
    expect(topN(items, (x) => x.k, (x) => x.v, 5)).toEqual([['a', 30]])
  })
})
