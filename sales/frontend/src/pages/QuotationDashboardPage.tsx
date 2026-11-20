"use client"

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Download,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Toast } from '@/components/toast'
import { deleteLead, fetchLeads, type LeadRecord } from '@/lib/leadApi'
import { PermissionGate } from '@/components/PermissionGate'
import { ActionMenu } from '@/components/ActionMenu'

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

export default function QuotationDashboardPage() {
  const navigate = useNavigate()
  const { type } = useParams<{ type?: string }>()
  const quotationType: 'rent' | 'sold' = type === 'sold' ? 'sold' : 'rent'
  const [quotations, setQuotations] = useState<LeadRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [createdBy, setCreatedBy] = useState('all')
  const [createdDate, setCreatedDate] = useState('all')
  const [expectedClosure, setExpectedClosure] = useState('all')
  const [customerName, setCustomerName] = useState('all')
  const [entriesPerPage, setEntriesPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)

  useEffect(() => {
    const loadQuotations = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchLeads({ status: 'Proposal Sent', quotationType, limit: 1000 })
        setQuotations(response.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quotations')
      } finally {
        setIsLoading(false)
      }
    }

    void loadQuotations()
  }, [quotationType])

  const filterOptions = useMemo(() => {
    const createdByOptions = getUniqueValues(quotations.map((quote) => quote.createdBy || 'System'))
    const createdDateOptions = getUniqueValues(quotations.map((quote) => formatDate(quote.createdDate)))
    const expectedClosureOptions = getUniqueValues(
      quotations.map((quote) => {
        const expectedClosure = quote.quotationDetails?.expectedClosure
        if (!expectedClosure) return undefined
        return formatDate(expectedClosure)
      })
    )
    const customerNameOptions = getUniqueValues(quotations.map((quote) => quote.companyName))
    return {
      createdByOptions,
      createdDateOptions,
      expectedClosureOptions,
      customerNameOptions,
    }
  }, [quotations])

  const filteredQuotations = useMemo(() => {
    return quotations.filter((quote) => {
      if (createdBy !== 'all' && (quote.createdBy || 'System') !== createdBy) return false
      if (createdDate !== 'all' && formatDate(quote.createdDate) !== createdDate) return false
      if (expectedClosure !== 'all') {
        const quoteDateClosure = quote.quotationDetails?.expectedClosure
        if (formatDate(quoteDateClosure) !== expectedClosure) return false
      }
      if (customerName !== 'all' && (quote.companyName || '') !== customerName) return false

      if (!searchQuery.trim()) return true
      const search = searchQuery.trim().toLowerCase()
      return [
        quote.quotationId || quote.leadId,
        quote.createdBy,
        quote.companyName,
        quote.contactPerson,
        quote.email,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search))
    })
  }, [quotations, createdBy, createdDate, expectedClosure, customerName, searchQuery])

  const pageCount = Math.max(1, Math.ceil(filteredQuotations.length / entriesPerPage))
  const pageData = filteredQuotations.slice((page - 1) * entriesPerPage, page * entriesPerPage)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [pageCount, page])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this quotation?')) return
    try {
      await deleteLead(id)
      setQuotations((prev) => prev.filter((quote) => quote._id !== id))
      setToast('Quotation deleted')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to delete quotation')
    }
  }

  const handleOpenQuotationPdf = (id: string) => {
    const pdfRoute = new URL(`/sales/quotations/view/${encodeURIComponent(id)}?openPdf=1`, window.location.origin)
    window.open(pdfRoute.toString(), '_blank', 'noopener,noreferrer')
  }

  const downloadReport = () => {
    const headers = ['Quotation ID', 'Created By', 'Customer Name', 'Contact Person', 'Products', 'Grand Total', 'Created Date', 'Expected Closure', 'Delivery']
    const rows = filteredQuotations.map((quote) => [
      quote.quotationId || quote.leadId,
      quote.createdBy || 'System',
      quote.companyName || '-',
      quote.contactPerson || '-',
      getProductNames(quote.products),
      calculateGrandTotal(quote.products),
      formatDate(quote.createdDate),
      formatDate(quote.quotationDetails?.expectedClosure),
      quote.quotationDetails?.delivery || '-',
    ])
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'quotations.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate('/sales/quotations')}
            className="mb-2 flex items-center gap-1 text-sm text-[#111827] hover:underline cursor-pointer"
          >
            ← Back to Quotation
          </button>
          <h1 className="crm-page-heading">{quotationType === 'sold' ? 'Sold Quotation Dashboard' : 'Rent Quotation Dashboard'}</h1>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }} placeholder="Search" className="w-full rounded-lg border border-[#EFECE5] bg-white py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
          </div>
          <label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#EFECE5] bg-white px-3 text-sm text-gray-700">
            <span>Show</span>
            <select value={entriesPerPage} onChange={(event) => { setEntriesPerPage(Number(event.target.value)); setPage(1) }} className="bg-transparent outline-none">
              {entriesOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="h-10 rounded-lg border border-[#EFECE5] bg-white px-3 text-sm font-medium text-gray-700 hover:bg-[#F2EFE8]">Filters</button>
          <button type="button" onClick={downloadReport} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-3 text-sm font-medium text-gray-700 transition hover:bg-[#E7E3DA]">
            <Download className="h-4 w-4" /> Download Report
          </button>
          <PermissionGate moduleName="quotations" action="create">
            <button onClick={() => navigate(`/sales/quotations/new/${quotationType}`)} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-[#111827] px-4 text-sm font-medium text-white transition hover:bg-[#1E293B]"><Plus className="h-4 w-4" /> ADD NEW</button>
          </PermissionGate>
        </div>
      </div>

      {filtersOpen ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Created By</span>
          <select
            value={createdBy}
            onChange={(event) => { setCreatedBy(event.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          >
            <option value="all">All</option>
            {filterOptions.createdByOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Created Date</span>
          <select
            value={createdDate}
            onChange={(event) => { setCreatedDate(event.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          >
            <option value="all">All</option>
            {filterOptions.createdDateOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Expected Closure</span>
          <select
            value={expectedClosure}
            onChange={(event) => { setExpectedClosure(event.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          >
            <option value="all">All</option>
            {filterOptions.expectedClosureOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer Name</span>
          <select
            value={customerName}
            onChange={(event) => { setCustomerName(event.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          >
            <option value="all">All</option>
            {filterOptions.customerNameOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div> : null}

      <div className="overflow-x-auto rounded-lg border border-[#EFECE5] bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F2EFE8] text-left text-xs uppercase tracking-wider text-gray-600">
            <tr>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Quotation ID</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Created By</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Customer Name</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Contact Person</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Products</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Grand Total</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Created Date</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Expected Closure</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading quotations…
                </td>
              </tr>
            ) : filteredQuotations.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                  No quotations found.
                </td>
              </tr>
            ) : (
              pageData.map((quote) => (
                <tr key={quote._id} className="border-t border-[#EFECE5] bg-white">
                  <td className="border-r border-[#D1D5DB] px-4 py-3 font-medium text-gray-900">{quote.quotationId || quote.leadId || quote._id}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{quote.createdBy || 'System'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{quote.companyName || '-'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{quote.contactPerson || '-'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{getProductNames(quote.products)}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{calculateGrandTotal(quote.products)}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{formatDate(quote.createdDate)}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{formatDate(quote.quotationDetails?.expectedClosure)}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{quote.quotationDetails?.delivery || '-'}</td>
                  <td className="px-4 py-3 text-gray-700"><ActionMenu moduleName="quotations" onView={() => handleOpenQuotationPdf(quote._id)} onEdit={() => navigate(`/sales/quotations/edit/${quote._id}`)} onDelete={() => handleDelete(quote._id)} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-2 text-sm text-gray-600">
        <div>{`Showing ${pageData.length} of ${filteredQuotations.length} entries`}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page <= 1}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#EFECE5] bg-white px-3 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>{page} / {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))}
            disabled={page >= pageCount}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#EFECE5] bg-white px-3 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  )
}
