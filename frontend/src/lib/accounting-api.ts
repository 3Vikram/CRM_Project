import type { Company, CreateMigrationJob, CreateVoucher, Ledger } from '@crm/shared'

export type AccountingSession = { accessToken: string }

export function createAccountingApi(session: AccountingSession) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/accounting${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, ...init?.headers },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? `Accounting request failed (${response.status})`)
    return body as T
  }
  return {
    companies: () => request<Company[]>('/companies'),
    ledgers: (companyId: string) => request<Ledger[]>(`/companies/${encodeURIComponent(companyId)}/ledgers`),
    createVoucher: (companyId: string, voucher: Omit<CreateVoucher, 'companyId'>) => request(`/companies/${encodeURIComponent(companyId)}/vouchers`, { method: 'POST', body: JSON.stringify(voucher) }),
    submitVoucher: (companyId: string, voucherId: string) => request(`/companies/${encodeURIComponent(companyId)}/vouchers/${voucherId}/submit`, { method: 'POST', body: '{}' }),
    trialBalance: (companyId: string, to: string) => request(`/companies/${encodeURIComponent(companyId)}/reports/trial-balance?to=${encodeURIComponent(to)}`),
    balanceSheet: (companyId: string, to: string, compareTo?: string) => request(`/companies/${encodeURIComponent(companyId)}/reports/balance-sheet?to=${encodeURIComponent(to)}${compareTo ? `&compareTo=${encodeURIComponent(compareTo)}` : ''}`),
    createMigration: (companyId: string, job: Omit<CreateMigrationJob, 'companyId'>) => request(`/companies/${encodeURIComponent(companyId)}/migrations`, { method: 'POST', body: JSON.stringify(job) }),
  }
}
