import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AccountingData, emptyData, loadData, saveData } from '@/lib/accounting'

export const ACCOUNTING_COMPANIES = [
  { id: '3vikram', name: '3Vikram Technologies' },
  { id: 'synov', name: 'SYNOV IT Services' },
] as const

const COMPANY_KEY = 'crm-accounting-company-v1'
type ContextValue = { companyId: string; companyName: string; setCompanyId: (companyId: string) => void; data: AccountingData; setData: (data: AccountingData) => void }
const Context = createContext<ContextValue | null>(null)

export function AccountingProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyIdState] = useState(() => localStorage.getItem(COMPANY_KEY) || ACCOUNTING_COMPANIES[0].id)
  const [data, setDataState] = useState<AccountingData>(() => loadData(companyId))
  const setCompanyId = (nextCompanyId: string) => {
    if (!ACCOUNTING_COMPANIES.some((company) => company.id === nextCompanyId)) return
    localStorage.setItem(COMPANY_KEY, nextCompanyId)
    setCompanyIdState(nextCompanyId)
    setDataState(loadData(nextCompanyId))
  }
  const setData = (nextData: AccountingData) => {
    if (nextData.companyId !== companyId) throw new Error('Cannot save accounting data into a different company')
    setDataState(nextData)
    saveData(nextData)
  }
  useEffect(() => {
    const listener = (event: StorageEvent) => { if (event.key === `crm-accounting-data-v2:${companyId}`) setDataState(loadData(companyId)) }
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [companyId])
  const value = useMemo<ContextValue>(() => ({ companyId, companyName: ACCOUNTING_COMPANIES.find((company) => company.id === companyId)?.name ?? companyId, setCompanyId, data: data.companyId === companyId ? data : emptyData(companyId), setData }), [companyId, data])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useAccounting = () => {
  const context = useContext(Context)
  if (!context) throw new Error('AccountingProvider missing')
  return context
}
