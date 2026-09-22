import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

// --- generic request helper ----------------------------------------------

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/accounting${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}

export function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

// --- companies / ledgers --------------------------------------------------

export type Company = { id: string; legalName: string; gstin: string | null; pan: string | null; reportingCurrency: string; booksBeginningDate: string }
export type Ledger = { id: string; companyId: string; groupId: string; code: string; name: string; nature: string; currentClassification: string; active: boolean }

export function useCompanies() {
  return useQuery({ queryKey: ['accounting', 'companies'], queryFn: () => req<Company[]>('/companies') })
}

export function useLedgers(companyId: string) {
  return useQuery({
    queryKey: ['accounting', 'ledgers', companyId],
    queryFn: () => req<Ledger[]>(`/companies/${encodeURIComponent(companyId)}/ledgers`),
    enabled: Boolean(companyId),
  })
}

// --- vouchers (journal register) ------------------------------------------

export type VoucherLine = { id: string; ledgerId: string; debit: string; credit: string; narration: string }
export type Voucher = {
  id: string; companyId: string; voucherType: string; voucherNumber: string; voucherDate: string
  status: 'draft' | 'submitted' | 'approved' | 'posted' | 'reversed'
  narration: string; externalReference: string | null; invoiceReference: string | null
  sourceType: string; sourceId: string | null; createdBy: string; createdAt: string; lines: VoucherLine[]
}
export type VoucherLineInput = { ledgerId: string; side: 'debit' | 'credit'; amount: string; narration?: string }
export type CreateVoucherInput = { voucherType: string; voucherDate: string; narration: string; externalReference?: string; invoiceReference?: string; lines: VoucherLineInput[] }

export function useVouchers(companyId: string, voucherType?: string) {
  return useQuery({
    queryKey: ['accounting', 'vouchers', companyId, voucherType],
    queryFn: () => req<Voucher[]>(`/companies/${encodeURIComponent(companyId)}/vouchers${voucherType ? `?type=${voucherType}` : ''}`),
    enabled: Boolean(companyId),
  })
}

function voucherKeys(companyId: string) { return ['accounting', 'vouchers', companyId] }

export function useCreateVoucher(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVoucherInput) => req<Voucher>(`/companies/${encodeURIComponent(companyId)}/vouchers`, {
      method: 'POST', body: JSON.stringify({ ...input, idempotencyKey: newIdempotencyKey(), sourceType: 'manual' }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: voucherKeys(companyId) }),
  })
}

export function useUpdateVoucher(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ voucherId, input }: { voucherId: string; input: CreateVoucherInput }) => req<Voucher>(`/companies/${encodeURIComponent(companyId)}/vouchers/${voucherId}`, {
      method: 'PUT', body: JSON.stringify({ ...input, idempotencyKey: newIdempotencyKey(), sourceType: 'manual' }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: voucherKeys(companyId) }),
  })
}

export function usePostVoucherDirect(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (voucherId: string) => req<Voucher>(`/companies/${encodeURIComponent(companyId)}/vouchers/${voucherId}/post-direct`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: voucherKeys(companyId) }),
  })
}

/** Cancels a draft voucher outright (delete) — it never posted, so nothing to reverse. */
export function useCancelDraftVoucher(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (voucherId: string) => req<void>(`/companies/${encodeURIComponent(companyId)}/vouchers/${voucherId}/cancel`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: voucherKeys(companyId) }),
  })
}

export function useReverseVoucher(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ voucherId, reason }: { voucherId: string; reason: string }) => req<Voucher>(`/companies/${encodeURIComponent(companyId)}/vouchers/${voucherId}/reverse`, {
      method: 'POST', body: JSON.stringify({ reason, reversalDate: new Date().toISOString().slice(0, 10), idempotencyKey: newIdempotencyKey() }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: voucherKeys(companyId) }),
  })
}

// --- purchase invoices ------------------------------------------------------

export type PurchaseInvoiceLine = { id: string; description: string; quantity: number; rate: number; gstRate: number; ledgerId: string }
export type PurchaseInvoiceTotals = { taxable: number; cgst: number; sgst: number; igst: number; gst: number; total: number }
export type PurchaseInvoice = {
  id: string; companyId: string; number: string; vendor: string; vendorGstin: string | null; vendorInvoiceNumber: string
  invoiceDate: string; dueDate: string | null; taxMode: 'intra' | 'inter' | 'none'; notes: string
  status: 'draft' | 'posted' | 'cancelled'; postedVoucherId: string | null; lines: PurchaseInvoiceLine[]
  totals: PurchaseInvoiceTotals; paidAmount: number; outstanding: number; paymentStatus?: 'Unpaid' | 'Paid' | 'Partially paid'
}
export type PurchaseInvoiceInput = {
  number: string; vendor: string; vendorGstin?: string; vendorInvoiceNumber: string; invoiceDate: string; dueDate?: string
  taxMode: 'intra' | 'inter' | 'none'; notes: string
  lines: { description: string; quantity: number; rate: number; gstRate: number; ledgerId: string }[]
}

function purchaseInvoiceKeys(companyId: string) { return ['accounting', 'purchase-invoices', companyId] }

export function usePurchaseInvoices(companyId: string) {
  return useQuery({
    queryKey: purchaseInvoiceKeys(companyId),
    queryFn: () => req<PurchaseInvoice[]>(`/companies/${encodeURIComponent(companyId)}/purchase-invoices`),
    enabled: Boolean(companyId),
  })
}

export function useCreatePurchaseInvoice(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PurchaseInvoiceInput) => req<PurchaseInvoice>(`/companies/${encodeURIComponent(companyId)}/purchase-invoices`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseInvoiceKeys(companyId) }),
  })
}

export function useUpdatePurchaseInvoice(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PurchaseInvoiceInput }) => req<PurchaseInvoice>(`/companies/${encodeURIComponent(companyId)}/purchase-invoices/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseInvoiceKeys(companyId) }),
  })
}

export function usePostPurchaseInvoice(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => req<PurchaseInvoice>(`/companies/${encodeURIComponent(companyId)}/purchase-invoices/${id}/post`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseInvoiceKeys(companyId) }),
  })
}

export function useCancelPurchaseInvoice(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => req<PurchaseInvoice>(`/companies/${encodeURIComponent(companyId)}/purchase-invoices/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseInvoiceKeys(companyId) }),
  })
}

// --- bank payments -----------------------------------------------------------

export type BankPayment = {
  id: string; companyId: string; number: string; paymentDate: string; payee: string
  bankLedgerId: string; categoryLedgerId: string | null; linkedPurchaseInvoiceId: string | null
  mode: string; reference: string; amount: string; narration: string
  clearance: 'Pending' | 'Cleared'; status: 'draft' | 'posted' | 'cancelled'; postedVoucherId: string | null
}
export type BankPaymentInput = {
  number: string; paymentDate: string; payee: string; bankLedgerId: string
  categoryLedgerId?: string; linkedPurchaseInvoiceId?: string; mode: string; reference: string
  amount: number; narration: string
}

function bankPaymentKeys(companyId: string) { return ['accounting', 'bank-payments', companyId] }

export function useBankPayments(companyId: string) {
  return useQuery({
    queryKey: bankPaymentKeys(companyId),
    queryFn: () => req<BankPayment[]>(`/companies/${encodeURIComponent(companyId)}/bank-payments`),
    enabled: Boolean(companyId),
  })
}

function invalidatePayments(qc: ReturnType<typeof useQueryClient>, companyId: string) {
  qc.invalidateQueries({ queryKey: bankPaymentKeys(companyId) })
  qc.invalidateQueries({ queryKey: purchaseInvoiceKeys(companyId) }) // outstanding/paymentStatus depend on payments
}

export function useCreateBankPayment(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BankPaymentInput) => req<BankPayment>(`/companies/${encodeURIComponent(companyId)}/bank-payments`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidatePayments(qc, companyId),
  })
}

export function useUpdateBankPayment(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BankPaymentInput }) => req<BankPayment>(`/companies/${encodeURIComponent(companyId)}/bank-payments/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => invalidatePayments(qc, companyId),
  })
}

export function usePostBankPayment(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => req<BankPayment>(`/companies/${encodeURIComponent(companyId)}/bank-payments/${id}/post`, { method: 'POST' }),
    onSuccess: () => invalidatePayments(qc, companyId),
  })
}

export function useCancelBankPayment(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => req<BankPayment>(`/companies/${encodeURIComponent(companyId)}/bank-payments/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => invalidatePayments(qc, companyId),
  })
}

export function useSetBankPaymentClearance(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, clearance }: { id: string; clearance: 'Pending' | 'Cleared' }) => req<BankPayment>(`/companies/${encodeURIComponent(companyId)}/bank-payments/${id}/clearance`, { method: 'PATCH', body: JSON.stringify({ clearance }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankPaymentKeys(companyId) }),
  })
}

// --- reports ------------------------------------------------------------------

export type TrialBalanceRow = { ledgerId: string; code: string; name: string; nature: string; currentClassification: string; scheduleIIIMap: string | null; debit: string; credit: string; balance: string }
export type TrialBalance = { companyId: string; asOf: string; rows: TrialBalanceRow[]; totals: { debit: string; credit: string; balanced: boolean } }

export function useTrialBalance(companyId: string, to: string) {
  return useQuery({
    queryKey: ['accounting', 'trial-balance', companyId, to],
    queryFn: () => req<TrialBalance>(`/companies/${encodeURIComponent(companyId)}/reports/trial-balance?to=${to}`),
    enabled: Boolean(companyId && to),
  })
}

export type LedgerReportRow = {
  voucherId: string; voucherNumber: string; voucherType: string; voucherDate: string; voucherNarration: string
  invoiceReference: string | null; externalReference: string | null
  lineNumber: number; debit: string; credit: string; narration: string; billReference: string | null
  runningBalance: string; source: string; party: string
}
export function useLedgerReport(companyId: string, ledgerId: string, from: string | undefined, to: string) {
  return useQuery({
    queryKey: ['accounting', 'ledger-report', companyId, ledgerId, from, to],
    queryFn: () => req<{ rows: LedgerReportRow[] }>(`/companies/${encodeURIComponent(companyId)}/reports/ledger/${ledgerId}?to=${to}${from ? `&from=${from}` : ''}`),
    enabled: Boolean(companyId && ledgerId && to),
  })
}

export type ProfitLossRow = { ledgerId: string; code: string; name: string; nature: 'income' | 'expense'; scheduleIIIMap: string | null; amount: string }
export type ProfitLoss = { companyId: string; from: string | null; to: string; rows: ProfitLossRow[]; totals: { income: string; expenses: string; profit: string } }
export function useProfitLoss(companyId: string, from: string | undefined, to: string) {
  return useQuery({
    queryKey: ['accounting', 'profit-loss', companyId, from, to],
    queryFn: () => req<ProfitLoss>(`/companies/${encodeURIComponent(companyId)}/reports/profit-loss?to=${to}${from ? `&from=${from}` : ''}`),
    enabled: Boolean(companyId && to),
  })
}

export type BalanceSheetRow = { ledgerId: string; code: string; name: string; nature: 'asset' | 'liability' | 'equity'; currentClassification: string; scheduleIIIMap: string | null; amount: string }
export type BalanceSheetSnapshot = { asOf: string; rows: BalanceSheetRow[]; currentYearProfit: string; totals: { assets: string; liabilities: string; equity: string; balanced: boolean } }
export type BalanceSheet = { companyId: string; current: BalanceSheetSnapshot; previous: BalanceSheetSnapshot | null }
export function useBalanceSheet(companyId: string, to: string, compareTo?: string) {
  return useQuery({
    queryKey: ['accounting', 'balance-sheet', companyId, to, compareTo],
    queryFn: () => req<BalanceSheet>(`/companies/${encodeURIComponent(companyId)}/reports/balance-sheet?to=${to}${compareTo ? `&compareTo=${compareTo}` : ''}`),
    enabled: Boolean(companyId && to),
  })
}
