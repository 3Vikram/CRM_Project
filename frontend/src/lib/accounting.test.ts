import { describe, expect, it } from 'vitest'
import { balanceSheet, emptyData, invoiceTotals, ledgerEntries, loadData, profitLoss, saveData, validateVoucher, type PurchaseInvoice, type Voucher } from './accounting'

const invoice: PurchaseInvoice = { id: 'i', number: 'PI-1', vendor: 'Vendor', gstin: '', vendorInvoiceNumber: 'B-1', invoiceDate: '2026-01-01', dueDate: '2026-01-10', taxMode: 'intra', notes: '', status: 'posted', lines: [{ id: 'l', description: 'Rent', quantity: 2, rate: 100, gstRate: 18, account: 'Rent Expense' }] }
describe('accounting calculations', () => {
  it('calculates taxable, GST, and total', () => expect(invoiceTotals(invoice)).toMatchObject({ taxable: 200, gst: 36, total: 236, cgst: 18, sgst: 18 }))
  it('validates balanced journal entries', () => { const v: Voucher = { id: 'v', number: 'JR-1', invoiceNumber: 'INV-1', date: '2026-01-01', reference: '', narration: '', status: 'draft', lines: [{ id: '1', account: 'Rent Expense', entryType: 'debit', debit: 100, credit: 0, description: '' }, { id: '2', account: 'Cash', entryType: 'credit', debit: 0, credit: 100, description: '' }] }; expect(validateVoucher(v)).toBeNull() })
  it('derives ledger and P&L from posted invoices', () => { const data = { ...emptyData(), purchaseInvoices: [invoice] }; expect(ledgerEntries(data)).toHaveLength(3); expect(profitLoss(data).expenses).toBe(200) })
  it('isolates browser prototypes by legal entity', () => {
    localStorage.clear()
    saveData({ ...emptyData('3vikram'), purchaseInvoices: [invoice] })
    expect(loadData('3vikram').purchaseInvoices[0].companyId).toBe('3vikram')
    expect(loadData('synov').purchaseInvoices).toEqual([])
  })
  it('derives a balanced balance sheet and includes current-year profit in equity', () => {
    const data = { ...emptyData(), vouchers: [
      { id: 'opening', number: 'JV-1', date: '2026-04-01', reference: '', narration: '', status: 'posted' as const, lines: [
        { id: '1', account: 'Cash', entryType: 'debit' as const, debit: 1000, credit: 0, description: '' },
        { id: '2', account: 'Capital', entryType: 'credit' as const, debit: 0, credit: 1000, description: '' },
      ] },
      { id: 'sale', number: 'JV-2', date: '2026-05-01', reference: '', narration: '', status: 'posted' as const, lines: [
        { id: '3', account: 'Cash', entryType: 'debit' as const, debit: 250, credit: 0, description: '' },
        { id: '4', account: 'Sales Income', entryType: 'credit' as const, debit: 0, credit: 250, description: '' },
      ] },
    ] }
    expect(balanceSheet(data, '2026-05-31')).toMatchObject({ totalAssets: 1250, totalLiabilities: 0, totalEquity: 1250, currentYearProfit: 250, balanced: true })
  })
})
