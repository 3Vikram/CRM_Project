import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchOPFs, type OPFRecord } from '@/lib/opfApi'
import { fetchCustomers } from '@/lib/customerApi'
import { SearchableSelect } from '@/components/SearchableSelect'

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

const statusOptions = ['All', 'Pending', 'Quotation', 'Renewed', 'Under Review', 'Cancelled']
const dueDateOptions = ['All', 'Today', 'Tomorrow', 'This Week', 'This Month', 'This Quarter', 'This Year', 'Last Year', 'Custom Date Range']

const getRecordStatus = (opf: OPFRecord) => {
  if (opf.approvalStatus === 'Approved') return 'Renewed'
  if (opf.approvalStatus === 'Rejected') return 'Cancelled'
  if (opf.approvalStatus === 'Under Review') return 'Under Review'
  return 'Pending'
}

const isInDueDateRange = (renewalDate: string, filter: string) => {
  if (filter === 'All' || filter === 'Custom Date Range') return true
  const renewal = calendarDate(renewalDate)
  const today = calendarDate(new Date())
  const day = DAY_MS
  const currentDate = new Date()
  let start = today
  let end = today

  if (filter === 'Tomorrow') start = end = today + day
  if (filter === 'This Week') {
    const dayOfWeek = currentDate.getDay()
    start = today - dayOfWeek * day
    end = start + 6 * day
  }
  if (filter === 'This Month') {
    start = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), 1)
    end = Date.UTC(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  }
  if (filter === 'This Quarter') {
    const quarterStartMonth = Math.floor(currentDate.getMonth() / 3) * 3
    start = Date.UTC(currentDate.getFullYear(), quarterStartMonth, 1)
    end = Date.UTC(currentDate.getFullYear(), quarterStartMonth + 3, 0)
  }
  if (filter === 'This Year') {
    start = Date.UTC(currentDate.getFullYear(), 0, 1)
    end = Date.UTC(currentDate.getFullYear(), 11, 31)
  }
  if (filter === 'Last Year') {
    start = Date.UTC(currentDate.getFullYear() - 1, 0, 1)
    end = Date.UTC(currentDate.getFullYear() - 1, 11, 31)
  }

  return renewal >= start && renewal <= end
}

const formatCurrency = (value?: number | string) => {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
}

export default function RenewalsPage() {
  const navigate = useNavigate()
  const [opfs, setOpfs] = useState<RenewalOPFRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString())
  const [createdByFilter, setCreatedByFilter] = useState('All')
  const [dueDateFilter, setDueDateFilter] = useState('All')
  const [customerFilter, setCustomerFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [customerOptions, setCustomerOptions] = useState<string[]>([])

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
    const loadCustomers = async () => {
      try {
        const firstResponse = await fetchCustomers({ page: 1, limit: 100 })
        const totalPages = firstResponse.pagination?.totalPages || 1
        const remainingResponses = await Promise.all(
          Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => fetchCustomers({ page: index + 2, limit: 100 }))
        )
        const allCustomers = [firstResponse, ...remainingResponses].flatMap((response) => response.data || [])
        const names = allCustomers.map((customer) => customer.companyName || customer.customerName || '').filter(Boolean)
        setCustomerOptions(Array.from(new Set(names)).sort())
      } catch {
        setCustomerOptions([])
      }
    }

    void loadCustomers()
  }, [])

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

  const renewalRows = useMemo(() => opfs
    .filter((opf) => createdByFilter === 'All' || (opf.createdBy || 'Admin') === createdByFilter)
    .filter((opf) => customerFilter === 'All' || (opf.customerName || '') === customerFilter)
    .filter((opf) => isInDueDateRange(opf.renewalDate as string, dueDateFilter))
    .filter((opf) => statusFilter === 'All' || getRecordStatus(opf) === statusFilter)
    .map((opf) => ({ opf, days: daysUntilRenewal(opf.renewalDate as string) })), [opfs, todayKey, createdByFilter, dueDateFilter, customerFilter, statusFilter])

  const createdByOptions = useMemo(() => ['All', ...Array.from(new Set(opfs.map((opf) => opf.createdBy || 'Admin'))).sort()], [opfs])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">Renewals</h1>
          {/* <p className="text-sm text-slate-500">Renewal information from saved OPF records</p> */}
        </div>
        <button type="button" onClick={() => void loadRenewals()} className="inline-flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[#F2EFE8]">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Created By</label>
          <SearchableSelect value={createdByFilter} onChange={setCreatedByFilter} options={createdByOptions} placeholder="Created By" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Due Date</label>
          <SearchableSelect value={dueDateFilter} onChange={setDueDateFilter} options={dueDateOptions} placeholder="Due Date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Customer Name</label>
          <SearchableSelect value={customerFilter} onChange={setCustomerFilter} options={['All', ...customerOptions]} placeholder="Customer Name" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <SearchableSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="Status" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#EFECE5] bg-white shadow-sm">
        {error ? <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <table className="min-w-[1700px] text-sm">
          <thead className="bg-[#F2EFE8] text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
            <tr>
              {['OPF No', 'Created By', 'Customer Name', 'Contact Person', 'Product', 'Revenue', 'Margin', 'Created Date', 'Renewal Date', 'OD Days', 'Remarks', 'Renewal Status', 'History', 'Action'].map((heading) => <th key={heading} className="border-r border-[#D1D5DB] px-4 py-3">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={14} className="px-4 py-10 text-center text-sm text-gray-500">Loading renewals...</td></tr> : renewalRows.length === 0 ? <tr><td colSpan={14} className="px-4 py-10 text-center text-sm text-gray-500">No OPF renewals found.</td></tr> : renewalRows.map(({ opf, days }) => (
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
                <td className="max-w-[220px] border-r border-[#D1D5DB] px-4 py-3">{opf.notes || '-'}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3">{getRenewalStatus(days)}</td>
                <td className="border-r border-[#D1D5DB] px-4 py-3 text-xs text-gray-600">Created {formatDate(opf.createdDate)}<br />Updated {formatDate(opf.updatedAt)}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" onClick={() => navigate(`/sales/opf/${opf._id}`)} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="View OPF"><Eye className="h-4 w-4" /></button><button type="button" onClick={() => navigate(`/sales/opf/edit/${opf._id}`)} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="Edit OPF"><Pencil className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
