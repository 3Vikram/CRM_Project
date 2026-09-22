import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useCompanies } from '@/lib/queries/accounting'

const COMPANY_KEY = 'crm-accounting-company-v1'
const FALLBACK_COMPANY_ID = '3vikram'

type ContextValue = { companyId: string; companyName: string; setCompanyId: (companyId: string) => void; companiesLoading: boolean }
const Context = createContext<ContextValue | null>(null)

export function AccountingProvider({ children }: { children: React.ReactNode }) {
  const { data: companies, isLoading } = useCompanies()
  const [companyId, setCompanyIdState] = useState(() => localStorage.getItem(COMPANY_KEY) || FALLBACK_COMPANY_ID)

  // If the saved company id isn't in the list once it loads (e.g. it was
  // removed, or nothing was saved yet), fall back to the first company.
  useEffect(() => {
    if (companies?.length && !companies.some((c) => c.id === companyId)) {
      setCompanyIdState(companies[0].id)
    }
  }, [companies, companyId])

  const setCompanyId = (nextCompanyId: string) => {
    localStorage.setItem(COMPANY_KEY, nextCompanyId)
    setCompanyIdState(nextCompanyId)
  }

  const value = useMemo<ContextValue>(() => ({
    companyId,
    companyName: companies?.find((c) => c.id === companyId)?.legalName ?? companyId,
    setCompanyId,
    companiesLoading: isLoading,
  }), [companyId, companies, isLoading])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useAccounting = () => {
  const context = useContext(Context)
  if (!context) throw new Error('AccountingProvider missing')
  return context
}
