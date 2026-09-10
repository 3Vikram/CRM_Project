export type AccountType = 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Equity'
export type Status = 'draft' | 'posted' | 'cancelled'
export type TaxMode = 'intra' | 'inter' | 'none'
export type Account = { name: string; type: AccountType }
export type PurchaseLine = { id: string; description: string; quantity: number; rate: number; gstRate: number; account: string }
export type PurchaseInvoice = { id: string; companyId?: string; number: string; vendor: string; gstin: string; vendorInvoiceNumber: string; invoiceDate: string; dueDate: string; taxMode: TaxMode; notes: string; lines: PurchaseLine[]; status: Status }
export type VoucherLine = { id: string; account: string; entryType: 'debit' | 'credit'; debit: number; credit: number; description: string }
export type Voucher = { id: string; companyId?: string; number: string; invoiceNumber?: string; date: string; reference: string; narration: string; lines: VoucherLine[]; status: Status }
export type BankPayment = { id: string; companyId?: string; number: string; date: string; payee: string; bankAccount: 'Cash' | 'Main Bank'; category: string; linkedInvoiceId: string; mode: string; reference: string; amount: number; narration: string; clearance: 'Pending' | 'Cleared'; status: Status }
export type AccountingData = { companyId: string; purchaseInvoices: PurchaseInvoice[]; vouchers: Voucher[]; bankPayments: BankPayment[] }
export type LedgerEntry = { date: string; source: 'Purchase Invoice' | 'Journal Register' | 'Bank Payment'; reference: string; party: string; narration: string; account: string; debit: number; credit: number }
export type BalanceSheetRow = { account: string; nature: 'Asset' | 'Liability' | 'Equity'; classification: 'Current' | 'Non-current' | 'Equity'; amount: number }
export type BalanceSheet = { asOf: string; rows: BalanceSheetRow[]; currentYearProfit: number; totalAssets: number; totalLiabilities: number; totalEquity: number; balanced: boolean }

export const STORAGE_KEY = 'crm-accounting-data-v2'
export const CHART: Account[] = [
  ['Cash','Asset'],['Main Bank','Asset'],['Accounts Receivable','Asset'],['Input GST','Asset'],['Vendor Advances','Asset'],
  ['Accounts Payable','Liability'],['Output GST','Liability'],['Accrued Expenses','Liability'],
  ['Sales Income','Income'],['Service Income','Income'],['Other Income','Income'],
  ['Purchases','Expense'],['Rent Expense','Expense'],['Salaries Expense','Expense'],['Utilities Expense','Expense'],['Travel Expense','Expense'],['Professional Fees','Expense'],['Other Expenses','Expense'],
  ['Capital','Equity'],['Retained Earnings','Equity'],
].map(([name,type]) => ({ name, type: type as AccountType }))
export const accountType = (name: string) => CHART.find(a => a.name === name)?.type
export const today = () => new Date().toISOString().slice(0, 10)
export const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
export const money = (n: number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n || 0)
export const storageKey = (companyId: string) => `${STORAGE_KEY}:${companyId}`
export const emptyData = (companyId = '3vikram'): AccountingData => ({ companyId, purchaseInvoices: [], vouchers: [], bankPayments: [] })
export function loadData(companyId = '3vikram'): AccountingData { try { const value = localStorage.getItem(storageKey(companyId)); if (!value) return emptyData(companyId); const parsed = JSON.parse(value); const owned = <T extends { companyId?: string }>(records: unknown): T[] => Array.isArray(records) ? records.filter((record) => !record.companyId || record.companyId === companyId).map((record) => ({ ...record, companyId })) : []; return { companyId, purchaseInvoices: owned<PurchaseInvoice>(parsed.purchaseInvoices), vouchers: owned<Voucher>(parsed.vouchers).map((voucher) => ({ ...voucher, invoiceNumber: voucher.invoiceNumber ?? voucher.reference ?? '', lines: Array.isArray(voucher.lines) ? voucher.lines.map(line => ({ ...line, entryType: line.entryType ?? (line.credit > 0 ? 'credit' : 'debit') })) : [] })), bankPayments: owned<BankPayment>(parsed.bankPayments) } } catch { return emptyData(companyId) } }
export const saveData = (data: AccountingData) => localStorage.setItem(storageKey(data.companyId), JSON.stringify({ ...data, purchaseInvoices: data.purchaseInvoices.map((record) => ({ ...record, companyId: data.companyId })), vouchers: data.vouchers.map((record) => ({ ...record, companyId: data.companyId })), bankPayments: data.bankPayments.map((record) => ({ ...record, companyId: data.companyId })) }))
export function invoiceTotals(invoice: Pick<PurchaseInvoice, 'lines' | 'taxMode'>) { const taxable = invoice.lines.reduce((s,l) => s + (+l.quantity || 0) * (+l.rate || 0), 0); const gst = invoice.lines.reduce((s,l) => s + ((+l.quantity || 0) * (+l.rate || 0) * (+l.gstRate || 0) / 100), 0); return { taxable, cgst: invoice.taxMode === 'intra' ? gst / 2 : 0, sgst: invoice.taxMode === 'intra' ? gst / 2 : 0, igst: invoice.taxMode === 'inter' ? gst : 0, gst: invoice.taxMode === 'none' ? 0 : gst, total: taxable + (invoice.taxMode === 'none' ? 0 : gst) } }
export const paymentsForInvoice = (data: AccountingData, invoiceId: string) => data.bankPayments.filter(p => p.status === 'posted' && p.linkedInvoiceId === invoiceId).reduce((s,p) => s+p.amount,0)
export const outstanding = (data: AccountingData, invoice: PurchaseInvoice) => Math.max(0, invoiceTotals(invoice).total - paymentsForInvoice(data, invoice.id))
export const paymentStatus = (data: AccountingData, invoice: PurchaseInvoice) => { const paid=paymentsForInvoice(data,invoice.id), total=invoiceTotals(invoice).total; return paid <= 0 ? 'Unpaid' : paid >= total-0.005 ? 'Paid' : 'Partially paid' }
export function validateInvoice(data: AccountingData, x: PurchaseInvoice) { if (!x.number.trim() || !x.vendor.trim() || !x.vendorInvoiceNumber.trim() || !x.invoiceDate) return 'Purchase invoice number, vendor, supplier invoice number and invoice date are required.'; if (x.dueDate && x.dueDate < x.invoiceDate) return 'Due date cannot be before invoice date.'; if (!x.lines.length || x.lines.some(l => !l.description.trim() || !l.account || l.quantity <= 0 || l.rate <= 0)) return 'Add at least one valid line with positive quantity and rate.'; if (data.purchaseInvoices.some(i => i.id !== x.id && i.status !== 'cancelled' && i.number.toLowerCase() === x.number.toLowerCase())) return 'An active purchase invoice with this invoice number already exists.'; if (data.purchaseInvoices.some(i => i.id !== x.id && i.status !== 'cancelled' && i.vendor.toLowerCase() === x.vendor.toLowerCase() && i.vendorInvoiceNumber.toLowerCase() === x.vendorInvoiceNumber.toLowerCase())) return 'An active invoice with this vendor and supplier invoice number already exists.'; return null }
export function validateVoucher(x: Voucher) { if (!x.number.trim() || !(x.invoiceNumber ?? '').trim() || !x.date) return 'Journal number, invoice number and journal date are required.'; if (x.lines.length < 2) return 'Add at least two journal items.'; if (x.lines.some(l => !l.account || (l.debit > 0 && l.credit > 0) || (l.debit <= 0 && l.credit <= 0))) return 'Each item needs an account, a Debit or Credit choice, and a positive amount.'; const d=x.lines.reduce((s,l)=>s+l.debit,0), c=x.lines.reduce((s,l)=>s+l.credit,0); return Math.abs(d-c) > .005 ? 'Debit and credit totals must balance.' : null }
export function ledgerEntries(data: AccountingData): LedgerEntry[] { const out: LedgerEntry[]=[]; data.purchaseInvoices.filter(i=>i.status==='posted').forEach(i=>{const t=invoiceTotals(i); i.lines.forEach(l=>out.push({date:i.invoiceDate,source:'Purchase Invoice',reference:i.number,party:i.vendor,narration:i.notes||i.vendorInvoiceNumber,account:l.account,debit:l.quantity*l.rate,credit:0})); if(t.gst) out.push({date:i.invoiceDate,source:'Purchase Invoice',reference:i.number,party:i.vendor,narration:'Input GST',account:'Input GST',debit:t.gst,credit:0}); out.push({date:i.invoiceDate,source:'Purchase Invoice',reference:i.number,party:i.vendor,narration:i.notes,account:'Accounts Payable',debit:0,credit:t.total})}); data.vouchers.filter(v=>v.status==='posted').forEach(v=>v.lines.forEach(l=>out.push({date:v.date,source:'Journal Register',reference:v.invoiceNumber||v.number,party:'',narration:l.description||v.narration,account:l.account,debit:l.debit,credit:l.credit}))); data.bankPayments.filter(p=>p.status==='posted').forEach(p=>{out.push({date:p.date,source:'Bank Payment',reference:p.number,party:p.payee,narration:p.narration,account:p.linkedInvoiceId?'Accounts Payable':p.category,debit:p.amount,credit:0});out.push({date:p.date,source:'Bank Payment',reference:p.number,party:p.payee,narration:p.narration,account:p.bankAccount,debit:0,credit:p.amount})}); return out.sort((a,b)=>a.date.localeCompare(b.date)||a.reference.localeCompare(b.reference)) }
export function trialBalance(data: AccountingData, asOf = '9999-12-31') { return CHART.map(a=>{const e=ledgerEntries(data).filter(x=>x.account===a.name&&x.date<=asOf); return {account:a.name,type:a.type,debit:e.reduce((s,x)=>s+x.debit,0),credit:e.reduce((s,x)=>s+x.credit,0)}}) }
export function profitLoss(data: AccountingData, start='', end='9999-12-31') { const rows=trialBalance(data,end).map(r=>{const period=ledgerEntries(data).filter(e=>e.account===r.account&&e.date>=start&&e.date<=end);const d=period.reduce((s,e)=>s+e.debit,0),c=period.reduce((s,e)=>s+e.credit,0);return {...r,debit:d,credit:c,value:r.type==='Income'?c-d:d-c}}).filter(r=>r.type==='Income'||r.type==='Expense');const income=rows.filter(r=>r.type==='Income').reduce((s,r)=>s+r.value,0), expenses=rows.filter(r=>r.type==='Expense').reduce((s,r)=>s+r.value,0);return {rows,income,expenses,net:income-expenses} }
export function financialYearStart(asOf: string) { const date = new Date(`${asOf}T00:00:00`); const year = date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear(); return `${year}-04-01` }
export function balanceSheet(data: AccountingData, asOf = today()): BalanceSheet {
  const classifications: Record<string, BalanceSheetRow['classification']> = {
    Cash: 'Current', 'Main Bank': 'Current', 'Accounts Receivable': 'Current', 'Input GST': 'Current', 'Vendor Advances': 'Current',
    'Accounts Payable': 'Current', 'Output GST': 'Current', 'Accrued Expenses': 'Current', Capital: 'Equity', 'Retained Earnings': 'Equity',
  }
  const rows = trialBalance(data, asOf)
    .filter((row) => row.type === 'Asset' || row.type === 'Liability' || row.type === 'Equity')
    .map((row) => ({
      account: row.account,
      nature: row.type as BalanceSheetRow['nature'],
      classification: classifications[row.account] ?? (row.type === 'Asset' || row.type === 'Liability' ? 'Non-current' : 'Equity'),
      amount: row.type === 'Asset' ? row.debit - row.credit : row.credit - row.debit,
    }))
    .filter((row) => Math.abs(row.amount) > 0.0001)
  const currentYearProfit = profitLoss(data, financialYearStart(asOf), asOf).net
  const totalAssets = rows.filter((row) => row.nature === 'Asset').reduce((sum, row) => sum + row.amount, 0)
  const totalLiabilities = rows.filter((row) => row.nature === 'Liability').reduce((sum, row) => sum + row.amount, 0)
  const totalEquity = rows.filter((row) => row.nature === 'Equity').reduce((sum, row) => sum + row.amount, 0) + currentYearProfit
  return { asOf, rows, currentYearProfit, totalAssets, totalLiabilities, totalEquity, balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.005 }
}
export function exportCsv(name:string, headers:string[], rows:(string|number)[][]) { const q=(v:string|number)=>`"${String(v??'').replaceAll('"','""')}"`; const blob=new Blob([[headers,...rows].map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href) }
