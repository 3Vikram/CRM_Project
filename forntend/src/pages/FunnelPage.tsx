"use client"

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react'
import { Toast } from '@/components/toast'
import { fetchCustomers } from '@/lib/customerApi'
import { deleteLead, fetchLeads, type LeadRecord } from '@/lib/leadApi'

const entriesOptions = [10, 25, 50, 100]

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB')
}

const getProductNames = (products?: any[]) => {
  if (!products || !Array.isArray(products) || products.length === 0) return '-'
  return products
    .map((p) => p.productName || '')
    .filter(Boolean)
    .join(', ')
}

const calculateGrandTotal = (products?: any[]) => {
  if (!products || !Array.isArray(products) || products.length === 0) return '-'
  const total = products.reduce((sum, p) => {
    const quantity = Number(p.quantity) || 0
    const unitPrice = Number(p.unitPrice) || 0
    return sum + quantity * unitPrice
  }, 0)
  return total === 0 ? '-' : new Intl.NumberFormat('en-IN', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(total)
}

const getUniqueValues = (items: Array<string | undefined>) =>
  Array.from(new Set(items.filter(Boolean) as string[])).sort()

const getAccountTypeByCompany = (companyName: string | undefined, customerMap: Record<string, string>) => {
  if (!companyName) return '-'
  return customerMap[companyName] || '-'
}

export default function FunnelPage() {
  const navigate = useNavigate()
  const [funnels, setFunnels] = useState<LeadRecord[]>([])
  const [customers, setCustomers] = useState<Array<{ companyName?: string; customerName?: string; accountType?: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [createdBy, setCreatedBy] = useState('all')
  const [createdDate, setCreatedDate] = useState('all')
  const [expectedClosure, setExpectedClosure] = useState('all')
  const [customerName, setCustomerName] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [accountTypeFilter, setAccountTypeFilter] = useState('all')
  const [entriesPerPage, setEntriesPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadPageData = async () => {
      setIsLoading(true)
      try {
        const [leadResponse, customerResponse] = await Promise.all([
          fetchLeads({ limit: 1000 }),
          fetchCustomers({ limit: 1000, fresh: true }),
        ])

        const funnelRecords = (leadResponse.data || []).filter((lead) => lead.quotationId || lead.leadStatus)
        setFunnels(funnelRecords)
        setCustomers(customerResponse.data || [])
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load funnel data')
      } finally {
        setIsLoading(false)
      }
    }

    void loadPageData()
  }, [])

  const customerAccountMap = useMemo(() => {
    return customers.reduce<Record<string, string>>((acc, customer) => {
      const companyName = customer.companyName || customer.customerName
      if (companyName) acc[companyName] = customer.accountType || '-'
      return acc
    }, {})
  }, [customers])

  const filterOptions = useMemo(() => {
    const createdByOptions = getUniqueValues(funnels.map((row) => row.createdBy || 'System'))
    const createdDateOptions = getUniqueValues(funnels.map((row) => formatDate(row.createdDate)))
    const expectedClosureOptions = getUniqueValues(
      funnels.map((row) => {
        const value = row.quotationDetails?.expectedClosure
        return value ? formatDate(value) : undefined
      })
    )
    const customerNameOptions = getUniqueValues(funnels.map((row) => row.companyName))
    const stageOptions = getUniqueValues(funnels.map((row) => row.leadStatus || 'New'))
    const accountTypeOptions = getUniqueValues(customers.map((customer) => customer.accountType || undefined))

    return {
      createdByOptions,
      createdDateOptions,
      expectedClosureOptions,
      customerNameOptions,
      stageOptions,
      accountTypeOptions,
    }
  }, [funnels, customers])

  const filteredFunnels = useMemo(() => {
    return funnels.filter((row) => {
      if (createdBy !== 'all' && (row.createdBy || 'System') !== createdBy) return false
      if (createdDate !== 'all' && formatDate(row.createdDate) !== createdDate) return false
      if (expectedClosure !== 'all') {
        const target = row.quotationDetails?.expectedClosure
        if (formatDate(target) !== expectedClosure) return false
      }
      if (customerName !== 'all' && (row.companyName || '') !== customerName) return false
      if (stageFilter !== 'all' && (row.leadStatus || 'New') !== stageFilter) return false
      if (accountTypeFilter !== 'all' && getAccountTypeByCompany(row.companyName, customerAccountMap) !== accountTypeFilter) return false

      if (!searchQuery.trim()) return true

      const search = searchQuery.trim().toLowerCase()
      return [
        row.quotationId || row.leadId,
        row.createdBy,
        row.companyName,
        row.contactPerson,
        row.remarks,
        row.leadStatus,
        getProductNames(row.products),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    })
  }, [funnels, createdBy, createdDate, expectedClosure, customerName, stageFilter, accountTypeFilter, searchQuery, customerAccountMap])

  const pageCount = Math.max(1, Math.ceil(filteredFunnels.length / entriesPerPage))
  const pageData = filteredFunnels.slice((page - 1) * entriesPerPage, page * entriesPerPage)

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount))
  }, [pageCount])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this funnel item?')) return
    try {
      await deleteLead(id)
      setFunnels((prev) => prev.filter((row) => row._id !== id))
      setToast('Funnel item deleted')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Failed to delete funnel item')
    }
  }

  const copyReport = async () => {
    const header = ['SL No', 'Created By', 'Funnel Id', 'Created Date', 'Company', 'Account Type', 'OEM', 'Products', 'SBU', 'Revenue', 'Bottom Line', 'Expected Closure', 'Stage', 'Remark']
    const rows = filteredFunnels.map((row, index) => [
      String(index + 1),
      row.createdBy || 'System',
      row.quotationId || row.leadId || '-',
      formatDate(row.createdDate),
      row.companyName || '-',
      getAccountTypeByCompany(row.companyName, customerAccountMap),
      row.products?.[0]?.productName || '-',
      getProductNames(row.products),
      row.quotationDetails?.serviceName || '-',
      calculateGrandTotal(row.products),
      calculateGrandTotal(row.products),
      formatDate(row.quotationDetails?.expectedClosure),
      row.leadStatus || 'New',
      row.remarks || row.quotationDetails?.note || '-',
    ])

    const text = [header, ...rows].map((line) => line.join('\t')).join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setToast('Funnel table copied to clipboard')
    } catch {
      setToast('Clipboard unavailable. Please copy manually.')
    }
  }

  const downloadReport = () => {
    const headers = ['SL No', 'Created By', 'Funnel Id', 'Created Date', 'Company', 'Account Type', 'OEM', 'Products', 'SBU', 'Revenue', 'Bottom Line', 'Expected Closure', 'Stage', 'Remark']
    const rows = filteredFunnels.map((row, index) => [
      String(index + 1),
      row.createdBy || 'System',
      row.quotationId || row.leadId || '-',
      formatDate(row.createdDate),
      row.companyName || '-',
      getAccountTypeByCompany(row.companyName, customerAccountMap),
      row.products?.[0]?.productName || '-',
      getProductNames(row.products),
      row.quotationDetails?.serviceName || '-',
      calculateGrandTotal(row.products),
      calculateGrandTotal(row.products),
      formatDate(row.quotationDetails?.expectedClosure),
      row.leadStatus || 'New',
      row.remarks || row.quotationDetails?.note || '-',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'funnel-report.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const printReport = () => window.print()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-bold text-[#111827]">Funnel Dashboard</h1>
        <button
          type="button"
          onClick={() => navigate('/sales/funnels/new')}
          className="inline-flex items-center gap-2 rounded-md bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f2937]"
        >
          <Plus className="h-4 w-4" />
          GENERATE NEW +
        </button>
      </div>

      <div className="h-px w-full bg-[#DAD4C7]" />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <label className="space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Created By</span>
          <select
            value={createdBy}
            onChange={(event) => { setCreatedBy(event.target.value); setPage(1) }}
            className="w-full rounded-md border border-[#D9D4CA] bg-white px-2.5 py-2 text-[13px] text-gray-700 outline-none focus:border-[#B9B1A0]"
          >
            <option value="all">All</option>
            {filterOptions.createdByOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Created Date</span>
          <select
            value={createdDate}
            onChange={(event) => { setCreatedDate(event.target.value); setPage(1) }}
            className="w-full rounded-md border border-[#D9D4CA] bg-white px-2.5 py-2 text-[13px] text-gray-700 outline-none focus:border-[#B9B1A0]"
          >
            <option value="all">All</option>
            {filterOptions.createdDateOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Expected Closure</span>
          <select
            value={expectedClosure}
            onChange={(event) => { setExpectedClosure(event.target.value); setPage(1) }}
            className="w-full rounded-md border border-[#D9D4CA] bg-white px-2.5 py-2 text-[13px] text-gray-700 outline-none focus:border-[#B9B1A0]"
          >
            <option value="all">All</option>
            {filterOptions.expectedClosureOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer Name</span>
          <select
            value={customerName}
            onChange={(event) => { setCustomerName(event.target.value); setPage(1) }}
            className="w-full rounded-md border border-[#D9D4CA] bg-white px-2.5 py-2 text-[13px] text-gray-700 outline-none focus:border-[#B9B1A0]"
          >
            <option value="all">All</option>
            {filterOptions.customerNameOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Stage</span>
          <select
            value={stageFilter}
            onChange={(event) => { setStageFilter(event.target.value); setPage(1) }}
            className="w-full rounded-md border border-[#D9D4CA] bg-white px-2.5 py-2 text-[13px] text-gray-700 outline-none focus:border-[#B9B1A0]"
          >
            <option value="all">All</option>
            {filterOptions.stageOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Account Type</span>
          <select
            value={accountTypeFilter}
            onChange={(event) => { setAccountTypeFilter(event.target.value); setPage(1) }}
            className="w-full rounded-md border border-[#D9D4CA] bg-white px-2.5 py-2 text-[13px] text-gray-700 outline-none focus:border-[#B9B1A0]"
          >
            <option value="all">All</option>
            {filterOptions.accountTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyReport}
            className="rounded-md border border-[#D9D4CA] bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-[#f7f4ef]"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={downloadReport}
            className="rounded-md border border-[#D9D4CA] bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-[#f7f4ef]"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={printReport}
            className="rounded-md border border-[#D9D4CA] bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-[#f7f4ef]"
          >
            Print
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium text-gray-600">Search:</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }}
              placeholder="Search"
              className="w-[220px] rounded-md border border-[#D9D4CA] bg-white py-1.5 pl-8 pr-2.5 text-[13px] text-gray-700 placeholder-gray-400 outline-none focus:border-[#B9B1A0]"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#D9D4CA] bg-white">
        <table className="min-w-[1500px] w-full border-collapse text-[12px] text-gray-700">
          <thead className="bg-[#F6F3EE] text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">SL No.</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Created By</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Funnel Id</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Created Date</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Company</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Account Type</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">OEM</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Products</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">SBU</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Revenue</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Bottom Line</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Expected Closure</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Stage</th>
              <th className="border-r border-[#D9D4CA] px-2 py-2.5">Remark</th>
              <th className="px-2 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-[13px] text-gray-500">
                  Loading funnel entries…
                </td>
              </tr>
            ) : filteredFunnels.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-[13px] text-gray-500">
                  No funnel records found.
                </td>
              </tr>
            ) : (
              pageData.map((row, index) => {
                const accountType = getAccountTypeByCompany(row.companyName, customerAccountMap)
                const revenue = calculateGrandTotal(row.products)
                const companyValue = row.companyName || '-'
                const productValue = getProductNames(row.products)

                return (
                  <tr key={row._id} className="border-t border-[#EAE3D7] align-top">
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700">{(page - 1) * entriesPerPage + index + 1}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700">{row.createdBy || 'System'}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] font-medium text-gray-900">{row.quotationId || row.leadId || '-'}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700">{formatDate(row.createdDate)}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700" style={{ maxWidth: '220px', wordBreak: 'normal', overflowWrap: 'break-word' }}>{companyValue}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700">{accountType}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700">{row.products?.[0]?.productName || '-'}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700" style={{ maxWidth: '220px', wordBreak: 'normal', overflowWrap: 'break-word' }}>{productValue}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700">{row.quotationDetails?.serviceName || '-'}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700 whitespace-nowrap">{revenue}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700 whitespace-nowrap">{revenue}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700 whitespace-nowrap">{formatDate(row.quotationDetails?.expectedClosure)}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700">{row.leadStatus || 'New'}</td>
                    <td className="border-r border-[#EAE3D7] px-2 py-2.5 text-[13px] text-gray-700" style={{ maxWidth: '240px', wordBreak: 'normal', overflowWrap: 'break-word' }}>{row.remarks || row.quotationDetails?.note || '-'}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => navigate(`/sales/quotations/view/${row._id}`)} className="rounded-md p-1.5 text-gray-600 hover:bg-[#F2EFE8]" aria-label="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => navigate(`/sales/quotations/edit/${row._id}`)} className="rounded-md p-1.5 text-gray-600 hover:bg-[#F2EFE8]" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(row._id)} className="rounded-md p-1.5 text-gray-600 hover:bg-[#F2EFE8]" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 px-1 text-[12px] text-gray-600">
        <div>{`Showing ${pageData.length} of ${filteredFunnels.length} entries`}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D9D4CA] bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>{page} / {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))}
            disabled={page >= pageCount}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D9D4CA] bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  )
}
