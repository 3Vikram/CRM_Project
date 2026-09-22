import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InvoiceDraft } from '@crm/shared'
import { apiFetch } from '@/lib/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}

export type SalesInvoice = {
  id: string; companyId: string; invoiceNumber: string; invoiceDate: string
  buyerName: string; buyerGstin: string | null; status: 'issued' | 'cancelled'
  computed: unknown; grandTotal: string; postedVoucherId: string | null; createdAt: string
}

// --- the single per-user autosaved working draft ---------------------------

export function useInvoiceDraft() {
  return useQuery({
    queryKey: ['invoice-draft'],
    queryFn: () => req<{ draft: InvoiceDraft | null }>('/invoice-draft'),
    staleTime: Infinity, // only ever loaded once on mount; the client is the source of truth after that
  })
}

export function useSaveInvoiceDraft() {
  return useMutation({ mutationFn: (draft: InvoiceDraft) => req<void>('/invoice-draft', { method: 'PUT', body: JSON.stringify(draft) }) })
}

export function useClearInvoiceDraft() {
  return useMutation({ mutationFn: () => req<void>('/invoice-draft', { method: 'DELETE' }) })
}

// --- issued invoices ---------------------------------------------------------

export function useSalesInvoices(companyId?: string) {
  return useQuery({
    queryKey: ['sales-invoices', companyId],
    queryFn: () => req<SalesInvoice[]>(`/invoices${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''}`),
  })
}

export function useIssueSalesInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: InvoiceDraft) => req<SalesInvoice>('/invoices', { method: 'POST', body: JSON.stringify(draft) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-invoices'] }),
  })
}

export function useCancelSalesInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => req<SalesInvoice>(`/invoices/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-invoices'] }),
  })
}
