"use client"

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Check,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Pencil,
  X,
  FileText,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Toast } from '@/sales/components/toast'
import { ActionMenu } from '@/sales/components/ActionMenu'
import { fetchCustomers } from '@/sales/lib/customerApi'
import { deleteLead, fetchLeadById, fetchLeads, updateLead, type LeadRecord } from '@/sales/lib/leadApi'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import { toExcelDate } from '@/sales/lib/excelFormat'
import { PageFilters, type PageFilterField, type PageFilterValues } from '@/sales/components/PageFilters'
import { fetchOPFs, type OPFRecord } from '@/sales/lib/opfApi'
import { hasPermission } from '@/sales/lib/permissions'
import { clearApiCache } from '@/sales/lib/apiCache'

const entriesOptions = [10, 25, 50, 100]
const funnelStageOptions = [
  'Pitching',
  'Demo/POC',
  'Quotation',
  'Upside',
  'Commit',
  'PO Received',
  'OPF',
  'Won',
  'Lost',
  'Hold',
]

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB')
}

const getDateFilterValue = (value?: string | null) => {
  if (!value) return ''
  const datePrefix = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (datePrefix) return datePrefix
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const getProductNames = (products?: any[]) => {
  if (!products || !Array.isArray(products) || products.length === 0) return '-'
  return products
    .map((p) => p.productName || '')
    .filter(Boolean)
    .join(', ')
}

const getRevenue = (row: LeadRecord) => {
  const details = row.quotationDetails
  for (const rawValue of [details?.revenue, details?.value]) {
    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') continue
    const amount = Number(rawValue)
    if (Number.isFinite(amount)) return amount
  }
  const products = row.products || []
  if (!products.length) return null
  let total = 0
  for (const product of products) {
    if (
      product.quantity === undefined
      || product.quantity === null
      || String(product.quantity).trim() === ''
      || product.unitPrice === undefined
      || product.unitPrice === null
      || String(product.unitPrice).trim() === ''
    ) return null
    const quantity = Number(product.quantity)
    const unitPrice = Number(product.unitPrice)
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null
    total += quantity * unitPrice
  }
  return total
}

const getMargin = (row: LeadRecord) => {
  const revenue = getRevenue(row)
  const rawMarginPercent = row.quotationDetails?.marginPercent
  if (rawMarginPercent === undefined || rawMarginPercent === null || String(rawMarginPercent).trim() === '') return null
  const marginPercent = Number(rawMarginPercent)
  return revenue !== null && Number.isFinite(marginPercent) ? revenue * marginPercent / 100 : null
}

const formatCurrency = (value: number | null) => value === null
  ? '-'
  : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

const getStage = (row: LeadRecord) => row.quotationDetails?.stage || row.leadStatus || 'New'
const isFunnelRecord = (row: LeadRecord) => Boolean(
  row.quotationId
  || row.quotationDetails?.stage
  || row.timeline?.some((entry) => entry.title?.toLowerCase() === 'moved to funnel'),
) || ['Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'].includes(row.leadStatus || '')

const getPOFile = (row: LeadRecord, opfs: OPFRecord[]) => {
  const quoteNo = row.quotationId?.trim()
  if (!quoteNo) return null
  const matchingOPF = opfs.find((opf) => opf.quotationId?.trim() === quoteNo)
  return matchingOPF?.customerPOFile || matchingOPF?.poFile || null
}

const getUniqueValues = (items: Array<string | undefined>) =>
  Array.from(new Set(items.filter(Boolean) as string[])).sort()

const fetchAllLeads = async (params: NonNullable<Parameters<typeof fetchLeads>[0]> = {}) => {
  const firstPage = await fetchLeads({ ...params, page: 1, limit: 1000 })
  const records = [...firstPage.data]
  const totalPages = firstPage.pagination.totalPages || 1
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetchLeads({ ...params, page, limit: 1000 })
    records.push(...response.data)
  }
  return records
}

const fetchAllCustomers = async () => {
  const firstPage = await fetchCustomers({ page: 1, limit: 1000, fresh: true })
  const records = [...(firstPage.data || [])]
  const totalPages = firstPage.pagination?.totalPages || 1
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetchCustomers({ page, limit: 1000, fresh: true })
    records.push(...(response.data || []))
  }
  return records
}

const getAccountTypeByCompany = (companyName: string | undefined, customerMap: Record<string, string>) => {
  if (!companyName) return '-'
  return customerMap[companyName] || '-'
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: 'blue' | 'violet' | 'amber' | 'green' | 'teal' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    teal: 'bg-teal-50 text-teal-700',
  }
  return (
    <div className="flex min-h-[92px] flex-col justify-between rounded-xl border border-[#E7EAF0] bg-white p-2.5 shadow-[0_3px_12px_rgba(27,44,74,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-[#667085]">{label}</div>
        <span className={`rounded-lg p-1.5 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-[#172B4D]">{value}</div>
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const tone = stage === 'Won' ? 'bg-emerald-50 text-emerald-700'
    : ['Lost', 'Scrapped', 'Hold'].includes(stage) ? 'bg-rose-50 text-rose-700'
      : stage === 'Proposal Sent' ? 'bg-blue-50 text-blue-700'
        : 'bg-amber-50 text-amber-700'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{stage}</span>
}

export default function FunnelPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRecordId = searchParams.get('recordId')
  const [funnels, setFunnels] = useState<LeadRecord[]>([])
  const [customers, setCustomers] = useState<Array<{ companyName?: string; customerName?: string; accountType?: string }>>([])
  const [opfs, setOpfs] = useState<OPFRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [stageDraft, setStageDraft] = useState('')
  const [savingStageId, setSavingStageId] = useState<string | null>(null)
  const [filters, setFilters] = useState<PageFilterValues>({})
  const [entriesPerPage, setEntriesPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'createdDate', direction: 'desc' })

  useEffect(() => {
    const loadPageData = async () => {
      setIsLoading(true)
      try {
        const [leadRecords, customerRecords, selectedLead] = await Promise.all([
          fetchAllLeads(),
          fetchAllCustomers(),
          selectedRecordId ? fetchLeadById(selectedRecordId) : Promise.resolve(null),
        ])

        const funnelRecords = leadRecords.filter(isFunnelRecord)
        if (selectedLead && !funnelRecords.some((lead) => lead._id === selectedLead._id)) {
          funnelRecords.unshift(selectedLead)
        }
        setFunnels(funnelRecords)
        setCustomers(customerRecords)

        if (hasPermission('opf', 'view')) {
          try {
            const firstPage = await fetchOPFs({ page: 1, limit: 1000 })
            const allOPFs = [...firstPage.data]
            for (let currentPage = 2; currentPage <= firstPage.pagination.totalPages; currentPage += 1) {
              const response = await fetchOPFs({ page: currentPage, limit: 1000 })
              allOPFs.push(...response.data)
            }
            setOpfs(allOPFs)
          } catch (error) {
            setOpfs([])
            setToast(`Funnels loaded, but PO files could not be loaded: ${error instanceof Error ? error.message : 'Request failed'}`)
          }
        } else {
          setOpfs([])
        }
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load funnel data')
      } finally {
        setIsLoading(false)
      }
    }

    void loadPageData()
  }, [selectedRecordId, refreshKey])

  const customerAccountMap = useMemo(() => {
    return customers.reduce<Record<string, string>>((acc, customer) => {
      const companyName = customer.companyName || customer.customerName
      if (companyName) acc[companyName] = customer.accountType || '-'
      return acc
    }, {})
  }, [customers])

  const filterOptions = useMemo(() => {
    const createdByOptions = getUniqueValues(funnels.map((row) => row.createdBy || 'System'))
    const customerNameOptions = getUniqueValues(funnels.map((row) => row.companyName))
    const stageOptions = getUniqueValues(funnels.map(getStage))
    const sbuOptions = getUniqueValues(funnels.map((row) => row.quotationDetails?.sbu))
    const accountTypeOptions = getUniqueValues(customers.map((customer) => customer.accountType || undefined))

    return {
      createdByOptions,
      customerNameOptions,
      stageOptions,
      sbuOptions,
      accountTypeOptions,
    }
  }, [funnels, customers])

  const filterFields: PageFilterField[] = [
    { key: 'createdBy', label: 'Created By', type: 'select', options: filterOptions.createdByOptions },
    { key: 'createdDate', label: 'Created Date', type: 'date' },
    { key: 'expectedClosure', label: 'Expected Closure', type: 'date' },
    { key: 'customerName', label: 'Customer Name', type: 'select', options: filterOptions.customerNameOptions },
    { key: 'stage', label: 'Stage', type: 'select', options: filterOptions.stageOptions },
    { key: 'sbu', label: 'SBU', type: 'select', options: filterOptions.sbuOptions },
    { key: 'accountType', label: 'Account Type', type: 'select', options: filterOptions.accountTypeOptions },
  ]

  const filteredFunnels = useMemo(() => {
    return funnels.filter((row) => {
      if (selectedRecordId) return row._id === selectedRecordId || row.quotationId === selectedRecordId || row.leadId === selectedRecordId
      if (filters.createdBy && (row.createdBy || 'System') !== filters.createdBy) return false
      if (filters.createdDate && getDateFilterValue(row.createdDate) !== filters.createdDate) return false
      if (filters.expectedClosure) {
        const target = row.quotationDetails?.expectedClosure
        if (getDateFilterValue(target) !== filters.expectedClosure) return false
      }
      if (filters.customerName && (row.companyName || '') !== filters.customerName) return false
      if (filters.stage && getStage(row) !== filters.stage) return false
      if (filters.sbu && row.quotationDetails?.sbu !== filters.sbu) return false
      if (filters.accountType && getAccountTypeByCompany(row.companyName, customerAccountMap) !== filters.accountType) return false

      if (!searchQuery.trim()) return true

      const search = searchQuery.trim().toLowerCase()
      return [
        row.quotationId || row.leadId,
        row.createdBy,
        row.companyName,
        row.contactPerson,
        row.assignedTo,
        row.remarks,
        getStage(row),
        row.quotationDetails?.sbu,
        row.quotationDetails?.expectedClosure,
        row.quotationDetails?.revenue,
        row.quotationDetails?.marginPercent,
        getProductNames(row.products),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    })
  }, [funnels, selectedRecordId, filters, searchQuery, customerAccountMap])

  const sortedFunnels = useMemo(() => {
    const valueFor = (row: LeadRecord, key: string): string | number => {
      switch (key) {
        case 'funnel':
          return row.leadId || row._id
        case 'quote':
          return row.quotationId || ''
        case 'createdBy':
          return row.createdBy || ''
        case 'accountManager':
          return row.assignedTo || ''
        case 'company':
          return row.companyName || ''
        case 'contact':
          return row.contactPerson || ''
        case 'stage':
          return getStage(row)
        case 'expectedClosure':
          return getDateFilterValue(row.quotationDetails?.expectedClosure)
        case 'createdDate':
          return getDateFilterValue(row.createdDate)
        case 'revenue':
          return getRevenue(row) ?? -1
        case 'margin':
          return getMargin(row) ?? -1
        case 'products':
          return getProductNames(row.products)
        case 'sbu':
          return row.quotationDetails?.sbu || ''
        case 'demo':
          return row.quotationDetails?.demo || ''
        default:
          return ''
      }
    }

    return [...filteredFunnels].sort((left, right) => {
      const leftValue = valueFor(left, sort.key)
      const rightValue = valueFor(right, sort.key)
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [filteredFunnels, sort])

  const pageCount = Math.max(1, Math.ceil(sortedFunnels.length / entriesPerPage))
  const pageData = sortedFunnels.slice((page - 1) * entriesPerPage, page * entriesPerPage)
  const totals = useMemo(() => {
    const stages = funnels.map(getStage)
    const opfQuoteNumbers = new Set(opfs.map((opf) => opf.quotationId?.trim()).filter(Boolean))
    const opfOrWon = funnels.filter((row) => {
      const stage = getStage(row)
      const isWon = stage === 'Won' || (row.isConverted && !['Lost', 'Scrapped'].includes(stage))
      return isWon || stage === 'OPF' || opfQuoteNumbers.has(row.quotationId?.trim())
    }).length
    const lost = funnels.filter((row) => ['Lost', 'Hold'].includes(getStage(row))).length
    const revenue = funnels.reduce((sum, row) => sum + (getRevenue(row) ?? 0), 0)
    const margin = funnels.reduce((sum, row) => sum + (getMargin(row) ?? 0), 0)
    return {
      total: funnels.length,
      open: funnels.filter((row) => !['OPF', 'Won', 'Lost', 'Scrapped', 'Hold'].includes(getStage(row)) && !row.isConverted && !row.isScrapped).length,
      rfqPending: stages.filter((stage) => stage.toLowerCase().includes('rfq') || stage === 'Proposal Sent').length,
      opfOrWon,
      lost,
      revenue,
      margin,
    }
  }, [funnels, opfs])

  const toggleSort = (key: string) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const saveStage = async (row: LeadRecord) => {
    if (!stageDraft || savingStageId) return
    setSavingStageId(row._id)
    try {
      await updateLead(row._id, {
        quotationDetails: {
          ...row.quotationDetails,
          stage: stageDraft,
        },
      })
      clearApiCache()
      setEditingStageId(null)
      setStageDraft('')
      setToast('Funnel stage updated successfully')
      setRefreshKey((key) => key + 1)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to update funnel stage')
    } finally {
      setSavingStageId(null)
    }
  }

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount))
  }, [pageCount])

  useEffect(() => {
    setPage(1)
  }, [selectedRecordId])

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setIsDeleting(true)
    try {
      await deleteLead(pendingDeleteId)
      setFunnels((prev) => prev.filter((row) => row._id !== pendingDeleteId))
      setToast('Funnel item deleted')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Failed to delete funnel item')
    } finally {
      setIsDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const downloadReport = async () => {
    const headers = ['Funnel #', 'Quote No', 'Created By', 'Account Manager', 'Company', 'Contact Person', 'Stage', 'Expected Closure', 'Created Date', 'Revenue (₹)', 'Margin (₹)', 'Products', 'SBU', 'PO File', 'Demo']
    const rows = sortedFunnels.map((row) => {
      const poFile = getPOFile(row, opfs)
      return [
        String(row.leadId || row._id),
        String(row.quotationId || ''),
        row.createdBy || '',
        row.assignedTo || '',
        row.companyName || '',
        row.contactPerson || '',
        getStage(row),
        toExcelDate(row.quotationDetails?.expectedClosure),
        toExcelDate(row.createdDate),
        getRevenue(row) ?? '',
        getMargin(row) ?? '',
        getProductNames(row.products),
        row.quotationDetails?.sbu || '',
        poFile?.fileName || '',
        row.quotationDetails?.demo || '',
      ]
    })

    try {
      await downloadExcelReport({
        fileName: 'funnel-report.xlsx',
        sheetName: 'Funnel',
        headers,
        rows,
        textColumns: [0, 1, 7, 8],
        centerColumns: [0, 1, 6, 7, 8, 13, 14],
        leftColumns: [2, 3, 4, 5, 11, 12],
        rightColumns: [9, 10],
        currencyColumns: [9, 10],
        wrapColumns: [4, 5, 11, 13],
        wideColumns: [4, 11],
        columnWidths: [18, 24, 22, 22, 32, 24, 18, 18, 16, 18, 18, 40, 18, 32, 12],
      })
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to download funnel report')
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="crm-page-heading">Funnels</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[190px] flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A91A0]" />
            <input type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }} placeholder="Search funnels..." className="h-10 w-full rounded-lg border border-[#E4E8EF] bg-white pl-9 pr-3 text-sm text-[#283548] shadow-sm outline-none transition focus:border-[#9DAED0] focus:ring-2 focus:ring-[#DCE5F5]" />
          </label>
          <button type="button" onClick={() => navigate('/sales/funnels/analytics')} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#E4E8EF] bg-white px-3 text-sm font-medium text-[#344054] shadow-sm transition hover:bg-[#F7F9FC]">
            <BarChart3 className="h-4 w-4 text-[#5272AB]" /> Analytics
          </button>
          <PageFilters
            fields={filterFields}
            values={filters}
            onApply={(nextFilters) => { setFilters(nextFilters); setPage(1) }}
            onClear={() => { setFilters({}); setPage(1) }}
          />
          <button type="button" onClick={() => setViewMode((mode) => mode === 'table' ? 'kanban' : 'table')} aria-pressed={viewMode === 'kanban'} className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-medium shadow-sm transition ${viewMode === 'kanban' ? 'border-[#253B62] bg-[#253B62] text-white' : 'border-[#E4E8EF] bg-white text-[#344054] hover:bg-[#F7F9FC]'}`}>
            <LayoutGrid className="h-4 w-4" /> {viewMode === 'kanban' ? 'Table View' : 'Kanban View'}
          </button>
          <button type="button" onClick={() => void downloadReport()} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#E4E8EF] bg-white px-3 text-sm font-medium text-[#344054] shadow-sm transition hover:bg-[#F7F9FC]">
            <Download className="h-4 w-4" /> Download Report
          </button>
          <button type="button" onClick={() => { clearApiCache(); setRefreshKey((key) => key + 1) }} disabled={isLoading} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#E4E8EF] bg-white px-3 text-sm font-medium text-[#344054] shadow-sm transition hover:bg-[#F7F9FC] disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {selectedRecordId ? (
            <button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('recordId'); setSearchParams(next) }} className="inline-flex h-10 items-center rounded-lg border border-[#E4E8EF] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-[#F7F9FC]">
              Show all funnels
            </button>
          ) : null}
          <button type="button" onClick={() => navigate('/sales/funnels/new')} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-[#172B4D] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#243D66]">
            <Plus className="h-4 w-4" /> New Funnel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Funnels" value={totals.total.toLocaleString('en-IN')} icon={BriefcaseBusiness} tone="blue" />
        <SummaryCard label="Open Funnels" value={totals.open.toLocaleString('en-IN')} icon={Users} tone="violet" />
        <SummaryCard label="RFQ Pending" value={totals.rfqPending.toLocaleString('en-IN')} icon={FileText} tone="amber" />
        <div className="flex min-h-[92px] flex-col justify-between rounded-xl border border-[#E7EAF0] bg-white p-2.5 shadow-[0_3px_12px_rgba(27,44,74,0.04)]">
          <div className="flex items-start justify-between">
            <div className="text-sm font-semibold text-[#667085]">Closed Funnel</div>
            <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" /></span>
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-[#172B4D]">{(totals.opfOrWon + totals.lost).toLocaleString('en-IN')}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#667085]">
            <span>OPF / Won <strong className="ml-1 text-emerald-700">{totals.opfOrWon}</strong></span>
            <span>Hold / Lost <strong className="ml-1 text-rose-700">{totals.lost}</strong></span>
          </div>
        </div>
        <SummaryCard label="Total Revenue" value={formatCurrency(totals.revenue)} icon={CircleDollarSign} tone="green" />
      </div>
      <div className="w-full">
        <div className="flex min-h-[82px] items-center justify-between gap-4 rounded-xl border border-[#E7EAF0] bg-white px-4 py-3 shadow-[0_3px_12px_rgba(27,44,74,0.04)]">
          <div>
            <div className="text-base font-semibold text-[#667085]">Total Margin</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-[#172B4D]">{formatCurrency(totals.margin)}</div>
          </div>
          <span className="rounded-lg bg-teal-50 p-1.5 text-teal-700"><CircleDollarSign className="h-4 w-4" /></span>
        </div>
      </div>

      <div className="rounded-xl border border-[#E7EAF0] bg-white shadow-[0_4px_18px_rgba(27,44,74,0.045)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0F4] px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-[#23324A]">Funnel Records</h2>
            <p className="mt-0.5 text-xs text-[#778196]">Showing {filteredFunnels.length.toLocaleString('en-IN')} matching records</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-[#667085]">
            Show entries
            <select value={entriesPerPage} onChange={(event) => { setEntriesPerPage(Number(event.target.value)); setPage(1) }} className="h-9 rounded-lg border border-[#E1E6EE] bg-white px-2.5 text-sm text-[#344054] outline-none focus:border-[#9DAED0]">
              {entriesOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto rounded-b-xl">
            <table className="min-w-[1800px] w-full border-collapse text-left text-[12px] text-[#39465B]">
              <thead className="bg-[#F6F8FB] text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="sticky left-0 z-10 w-24 bg-[#F6F8FB] px-3 py-3">Actions</th>
                  {[
                    ['funnel', 'Funnel #'], ['quote', 'Quote No'], ['createdBy', 'Created By'], ['accountManager', 'Account Manager'],
                    ['company', 'Company'], ['contact', 'Contact Person'], ['stage', 'Stage'], ['expectedClosure', 'Expected Closure'],
                    ['createdDate', 'Created Date'], ['revenue', 'Revenue (₹)'], ['margin', 'Margin (₹)'], ['products', 'Products'],
                    ['sbu', 'SBU'], ['poFile', 'PO File'], ['demo', 'Demo'],
                  ].map(([key, label]) => (
                    <th key={key} className="whitespace-nowrap px-3 py-3">
                      {key === 'poFile'
                        ? label
                        : <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-[#29446F]">
                          {label}
                          {sort.key !== key ? <ArrowUpDown className="h-3 w-3 opacity-50" /> : sort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        </button>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={16} className="px-3 py-10 text-center text-sm text-[#778196]">Loading funnel records…</td></tr>
                ) : pageData.length === 0 ? (
                  <tr><td colSpan={16} className="px-3 py-10 text-center text-sm text-[#778196]">No funnel records found.</td></tr>
                ) : pageData.map((row) => {
                  const poFile = getPOFile(row, opfs)
                  const stage = getStage(row)
                  return (
                    <tr key={row._id} className="border-t border-[#EEF1F5] transition hover:bg-[#FAFBFD]">
                      <td className="sticky left-0 z-[1] bg-white px-3 py-2.5"><ActionMenu moduleName="funnels" onView={() => navigate(`/sales/quotations/view/${row._id}`)} onEdit={() => navigate(`/sales/funnels/edit/${row._id}`)} onDelete={() => setPendingDeleteId(row._id)} /></td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[#29446F]">{row.leadId || row._id}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.quotationId || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.createdBy || 'System'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.assignedTo || '-'}</td>
                      <td className="max-w-[220px] truncate px-3 py-2.5" title={row.companyName}>{row.companyName || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.contactPerson || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {editingStageId === row._id ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Stage for ${row.companyName || row.leadId || 'funnel'}`}
                              autoFocus
                              value={stageDraft}
                              onChange={(event) => setStageDraft(event.target.value)}
                              disabled={savingStageId === row._id}
                              className="h-8 max-w-[150px] rounded-md border border-[#D8DEE8] bg-white px-2 text-xs text-[#344054] outline-none focus:border-[#9DAED0] focus:ring-2 focus:ring-[#DCE5F5]"
                            >
                              <option value="">Select stage...</option>
                              {stageDraft && !funnelStageOptions.includes(stageDraft) ? <option value={stageDraft}>{stageDraft}</option> : null}
                              {funnelStageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                            <button
                              type="button"
                              aria-label="Save stage"
                              title="Save stage"
                              onClick={() => void saveStage(row)}
                              disabled={!stageDraft || savingStageId === row._id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Cancel stage edit"
                              title="Cancel"
                              onClick={() => { setEditingStageId(null); setStageDraft('') }}
                              disabled={savingStageId === row._id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E1E6EE] bg-white text-[#667085] transition hover:bg-[#F6F8FB] disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <StageBadge stage={stage} />
                            <button
                              type="button"
                              aria-label={`Edit stage for ${row.companyName || row.leadId || 'funnel'}`}
                              title="Edit stage"
                              onClick={() => { setEditingStageId(row._id); setStageDraft(stage) }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-[#7B8798] transition hover:bg-[#EFF3F8] hover:text-[#29446F]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDate(row.quotationDetails?.expectedClosure)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDate(row.createdDate)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium">{formatCurrency(getRevenue(row))}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatCurrency(getMargin(row))}</td>
                      <td className="max-w-[260px] truncate px-3 py-2.5" title={getProductNames(row.products)}>{getProductNames(row.products)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.quotationDetails?.sbu || '-'}</td>
                      <td className="px-3 py-2.5">{poFile?.filePath
                        ? <a href={poFile.filePath} target="_blank" rel="noreferrer" className="inline-flex max-w-[190px] items-center gap-1 truncate font-medium text-[#315D9B] hover:underline" title={poFile.fileName}><FileText className="h-3.5 w-3.5 shrink-0" />{poFile.fileName || 'Open file'}</a>
                        : '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.quotationDetails?.demo || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto p-4">
            {filterOptions.stageOptions.map((stage) => {
              const stageFunnels = sortedFunnels.filter((row) => getStage(row) === stage)
              return (
                <section key={stage} className="w-[270px] shrink-0 rounded-xl bg-[#F6F8FB] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#344054]">{stage}</h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#667085]">{stageFunnels.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageFunnels.map((row) => (
                      <button key={row._id} type="button" onClick={() => navigate(`/sales/funnels/edit/${row._id}`)} className="block w-full rounded-lg border border-[#E7EAF0] bg-white p-3 text-left shadow-sm transition hover:border-[#B9C8DF] hover:shadow">
                        <div className="truncate text-sm font-semibold text-[#263650]">{row.companyName || 'Company not recorded'}</div>
                        <div className="mt-1 truncate text-xs text-[#7A8495]">{row.quotationId || row.leadId || row._id}</div>
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-[#667085]">{row.assignedTo || 'Unassigned'}</span>
                          <span className="shrink-0 font-semibold text-[#29446F]">{formatCurrency(getRevenue(row))}</span>
                        </div>
                      </button>
                    ))}
                    {stageFunnels.length === 0 ? <p className="rounded-lg border border-dashed border-[#D8DEE8] px-3 py-5 text-center text-xs text-[#98A1B1]">No funnels in this stage</p> : null}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F4] px-4 py-3 text-xs text-[#667085] sm:px-5">
          <div>Showing {pageData.length ? (page - 1) * entriesPerPage + 1 : 0}–{Math.min(page * entriesPerPage, sortedFunnels.length)} of {sortedFunnels.length.toLocaleString('en-IN')} entries</div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous page" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page <= 1} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E1E6EE] bg-white disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-16 text-center font-medium">{page} / {pageCount}</span>
            <button type="button" aria-label="Next page" onClick={() => setPage((current) => Math.min(current + 1, pageCount))} disabled={page >= pageCount} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E1E6EE] bg-white disabled:cursor-not-allowed disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {pendingDeleteId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete funnel"
          onClick={() => { if (!isDeleting) setPendingDeleteId(null) }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Delete Funnel</h2>
            <p className="mt-2 text-sm text-gray-600">Are you sure you want to delete this funnel?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                disabled={isDeleting}
                className="rounded-lg border border-[#111827] bg-white px-5 py-2.5 text-sm font-semibold text-[#111827] hover:bg-[#F2EFE8] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={isDeleting}
                className="rounded-lg bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f2937] disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  )
}
