import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, RefreshCw } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchOPFs, type OPFRecord } from '@/sales/lib/opfApi'
import { PageFilters, type PageFilterField, type PageFilterValues } from '@/sales/components/PageFilters'

const DAY_MS = 24 * 60 * 60 * 1000
type RenewalOPFRecord = OPFRecord & { revenue?: number | string; margin?: number | string; updatedAt?: string }

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB')
}

const calendarDate = (value: Date | string) => {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const date = value instanceof Date ? value : new Date(value)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

const daysUntilRenewal = (renewalDate: string) => Math.round((calendarDate(renewalDate) - calendarDate(new Date())) / DAY_MS)

const getRenewalStatus = (days: number) => {
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due Today'
  return 'Upcoming'
}

const getRecordStatus = (opf: OPFRecord) => {
  if (opf.approvalStatus === 'Approved') return 'Renewed'
  if (opf.approvalStatus === 'Rejected') return 'Cancelled'
  if (opf.approvalStatus === 'Under Review') return 'Under Review'
  return 'Pending'
}

const isResolvedRenewal = (opf: OPFRecord) =>
  ['approved', 'rejected', 'renewed', 'cancelled', 'completed'].includes(String(opf.approvalStatus || '').toLowerCase())

const getDateFilterValue = (value?: string | null) => {
  if (!value) return ''
  const datePrefix = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (datePrefix) return datePrefix
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const formatCurrency = (value?: number | string) => {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
}

export default function RenewalsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRecordId = searchParams.get('recordId')
  const [opfs, setOpfs] = useState<RenewalOPFRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString())
  const [filters, setFilters] = useState<PageFilterValues>({})
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const loadRenewals = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const firstResponse = await fetchOPFs({ page: 1, limit: 100 })
      const totalPages = firstResponse.pagination?.totalPages || 1
      const remainingResponses = await Promise.all(
        Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => fetchOPFs({ page: index + 2, limit: 100 }))
      )
      const allOpfs = [firstResponse, ...remainingResponses].flatMap((response) => response.data || [])
      setOpfs(allOpfs.filter((opf) => Boolean(opf.renewalDate) && !Number.isNaN(new Date(opf.renewalDate as string).getTime())))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load renewals')
      setOpfs([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRenewals()
  }, [loadRenewals])

  useEffect(() => {
    const refreshOnFocus = () => { void loadRenewals() }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [loadRenewals])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextKey = new Date().toDateString()
      if (nextKey !== todayKey) setTodayKey(nextKey)
    }, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [todayKey])

  const eligibleRenewals = useMemo(() => opfs
    .map((opf) => ({ opf, days: daysUntilRenewal(opf.renewalDate as string) }))
    .filter(({ opf, days }) => selectedRecordId
      ? opf._id === selectedRecordId || opf.opfNo === selectedRecordId
      : !isResolvedRenewal(opf) && days <= 90), [opfs, selectedRecordId, todayKey])

  const filterFields = useMemo<PageFilterField[]>(() => [
    { key: 'createdBy', label: 'Created By', type: 'select', options: Array.from(new Set(eligibleRenewals.map(({ opf }) => opf.createdBy || 'Admin'))).sort() },
    { key: 'customerName', label: 'Customer Name', type: 'select', options: Array.from(new Set(eligibleRenewals.map(({ opf }) => opf.customerName).filter((value): value is string => Boolean(value)))).sort() },
    { key: 'renewalDate', label: 'Renewal Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: Array.from(new Set(eligibleRenewals.map(({ opf }) => getRecordStatus(opf)))).sort() },
    { key: 'product', label: 'Product', type: 'select', options: Array.from(new Set(eligibleRenewals.map(({ opf }) => opf.product).filter((value): value is string => Boolean(value)))).sort() },
  ], [eligibleRenewals])

  const renewalRows = useMemo(() => {
    const records = eligibleRenewals
      .filter(({ opf }) => !selectedRecordId || opf._id === selectedRecordId || opf.opfNo === selectedRecordId)
      .filter(({ opf }) => !filters.createdBy || (opf.createdBy || 'Admin') === filters.createdBy)
      .filter(({ opf }) => !filters.customerName || (opf.customerName || '') === filters.customerName)
      .filter(({ opf }) => !filters.renewalDate || getDateFilterValue(opf.renewalDate) === filters.renewalDate)
      .filter(({ opf }) => !filters.status || getRecordStatus(opf) === filters.status)
      .filter(({ opf }) => !filters.product || (opf.product || '') === filters.product)

    return records.sort((left, right) => {
      const difference = left.days - right.days
      return (sortOrder === 'asc' ? difference : -difference) || left.opf._id.localeCompare(right.opf._id)
    })
  }, [eligibleRenewals, selectedRecordId, filters, sortOrder])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">Renewals</h1>
          <p className="mt-1 text-sm text-slate-500">{eligibleRenewals.length} unresolved renewal{eligibleRenewals.length === 1 ? '' : 's'} in the 90-day window, including overdue items</p>
        </div>
        <div className="flex items-center gap-3">
          <PageFilters
            fields={filterFields}
            values={filters}
            onApply={setFilters}
            onClear={() => setFilters({})}
          />
          {selectedRecordId ? (
            <button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('recordId'); setSearchParams(next) }} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[#F2EFE8]">
              Show all renewals
            </button>
          ) : null}
          <button type="button" onClick={() => void loadRenewals()} className="inline-flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[#F2EFE8]">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#EFECE5] bg-white shadow-sm">
        {error ? <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <table className="min-w-[1540px] text-sm">
          <thead className="bg-[#F2EFE8] text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
            <tr>
              {['OPF No', 'Created By', 'Customer Name', 'Contact Person', 'Product', 'Revenue', 'Margin', 'Created Date', 'Renewal Date', 'OD Days', 'Renewal Status', 'History', 'Action'].map((heading) => (
                <th key={heading} className="border-r border-[#D1D5DB] px-4 py-3">
                  {heading === 'Renewal Date' || heading === 'OD Days' ? (
                    <button
                      type="button"
                      onClick={() => setSortOrder((current) => current === 'asc' ? 'desc' : 'asc')}
                      className="inline-flex items-center gap-1"
                      aria-label={`Sort by ${heading} ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    >
                      {heading} <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    </button>
                  ) : heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-gray-500">Loading renewals...</td></tr> : renewalRows.length === 0 ? <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-gray-500">No OPF renewals found.</td></tr> : renewalRows.map(({ opf, days }) => (
              <tr key={opf._id} className="border-t border-[#EFECE5] bg-white">
                <td className="border-r border-[#D1D5DB] px-4 py-3 font-medium text-gray-900">{opf.opfNo || '-'}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{opf.createdBy || 'Admin'}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{opf.customerName || '-'}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{opf.contactPerson || '-'}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{opf.product || '-'}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{formatCurrency(opf.revenue)}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{formatCurrency(opf.margin)}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{formatDate(opf.createdDate)}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{formatDate(opf.renewalDate)}</td>
                <td className={`border-r border-[#D1D5DB] px-4 py-3 font-semibold ${days < 0 ? 'text-red-600' : 'text-gray-900'}`}>{days}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{getRenewalStatus(days)}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3 text-xs text-gray-600">Created {formatDate(opf.createdDate)}<br />Updated {formatDate(opf.updatedAt)}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" onClick={() => window.open(`/sales/opf/${opf._id}`, '_blank')} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="View OPF"><Eye className="h-4 w-4" /></button><button type="button" onClick={() => navigate(`/sales/opf/edit/${opf._id}`)} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="Edit OPF"><Pencil className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
