'use client'

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  FileText,
  Receipt,
  BookOpen,
  Landmark,
  BookText,
  BarChart3,
  Scale,
  FileBarChart,
  LogOut,
  UploadCloud,
} from 'lucide-react'
import { useAccounting } from './accounts/accounting-context'
import { useCompanies, useImportBrowserData } from '@/lib/queries/accounting'
import { useAuth } from '@/lib/auth'

const LEGACY_KEY_PREFIX = 'crm-accounting-data-v2:'

/**
 * One-time upload of the pre-migration browser localStorage accounting data
 * for the selected company. Only shows up when that key still exists and
 * hasn't already been imported (the key is renamed, not deleted, on
 * success — re-running the import is also safe: the server skips whatever
 * it already imported).
 */
function ImportBrowserDataButton({ companyId }: { companyId: string }) {
  const [legacyKey, setLegacyKey] = useState<string | null>(null)
  const importData = useImportBrowserData(companyId)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    setResult(null)
    const key = `${LEGACY_KEY_PREFIX}${companyId}`
    setLegacyKey(localStorage.getItem(key) ? key : null)
  }, [companyId])

  if (!legacyKey) return null

  const runImport = async () => {
    try {
      const raw = localStorage.getItem(legacyKey)
      if (!raw) return
      const data = JSON.parse(raw)
      const res = await importData.mutateAsync(data)
      const total = Object.values(res.counts).reduce((sum, c) => sum + c.created, 0)
      localStorage.setItem(`${legacyKey}:imported-${new Date().toISOString().slice(0, 10)}`, raw)
      localStorage.removeItem(legacyKey)
      setLegacyKey(null)
      setResult(`Imported ${total} record(s).`)
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div className="border-b border-[#E7E3DA] px-4 py-3">
      <button
        onClick={runImport}
        disabled={importData.isPending}
        className="flex w-full items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      >
        <UploadCloud className="w-4 h-4" />
        {importData.isPending ? 'Importing…' : 'Import browser data'}
      </button>
      {result && <p className="mt-1 text-[11px] text-gray-600">{result}</p>}
    </div>
  )
}

export function AccountsSidebar() {
  const { pathname } = useLocation()
  const { companyId, setCompanyId } = useAccounting()
  const { data: companies } = useCompanies()
  const { user, logout } = useAuth()

  const menuItems = [
    { href: '/accounts/sale-invoice', label: 'Sale Invoice', icon: FileText },
    { href: '/accounts/purchase-invoice', label: 'Purchase Invoice', icon: Receipt },
    { href: '/accounts/journal-register', label: 'Journal Register', icon: BookOpen },
    { href: '/accounts/bank-payments', label: 'Bank Payments', icon: Landmark },
    { href: '/accounts/ledger', label: 'Ledger', icon: BookText },
    { href: '/accounts/profit-loss', label: 'P & L', icon: BarChart3 },
    { href: '/accounts/balance-sheet', label: 'Balance Sheet', icon: Scale },
    { href: '/accounts/reports', label: 'Reports', icon: FileBarChart },
  ]

  return (
    <div className="w-56 bg-[#F0EEE7] border-r border-[#E7E3DA] flex flex-col h-screen fixed left-0 top-0">
      {/* Logo Section */}
      <div className="p-6 border-b border-[#E7E3DA]">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">3V</span>
          </div>
          <div>
            <div className="font-serif font-bold text-gray-900">3Vikram</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Accounts · Finance</div>
          </div>
        </Link>
      </div>

      <div className="border-b border-[#E7E3DA] px-4 py-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500" htmlFor="accounts-company">Company books</label>
        <select id="accounts-company" className="mt-1 w-full rounded-md border border-[#D9D4C8] bg-white px-2 py-1.5 text-xs font-medium text-gray-800" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
          {companies?.map((company) => <option key={company.id} value={company.id}>{company.legalName}</option>)}
        </select>
      </div>

      <ImportBrowserDataButton companyId={companyId} />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-6">
          <div className="text-xs font-semibold text-gray-400 uppercase px-3 mb-4 tracking-wider">
            Workspace
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Signed-in user */}
      <div className="border-t border-[#E7E3DA] p-4">
        {user && <div className="mb-2 truncate text-xs text-gray-600" title={user.email}>{user.name} · {user.role}</div>}
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-black/5 hover:text-gray-900"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
