'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { fetchReport, fetchRevenueMarginReport, type RevenueMarginOptions, type RevenueMarginRow } from '@/lib/reportApi'

const reportTitles: Record<string, string> = {
  'revenue-margin': 'Revenue & Margin',
  'top-customers': 'Top 10 Customers',
  'top-employees': 'Top 10 Employees',
  'top-products': 'Top 10 Products',
  usages: 'Usages Reports',
  usage: 'Usages Reports',
  'funnel-analysis': 'Funnel Analysis Reports',
  'team-analysis': 'Team Analysis Reports',
  'product-analysis': 'Product Analysis Reports',
}

export default function ReportDetailPage() {
  const { reportKey } = useParams<{ reportKey: string }>()
  const title = reportTitles[reportKey || ''] || 'Report'

  if (reportKey === 'revenue-margin') return <RevenueMarginReport />
  return <GenericReport reportKey={reportKey || ''} title={title} />

}

const emptyOptions: RevenueMarginOptions = { createdBy: [], createdDates: [], customerNames: [], products: [] }

function RevenueMarginReport() {
  const [rows, setRows] = useState<RevenueMarginRow[]>([])
  const [options, setOptions] = useState<RevenueMarginOptions>(emptyOptions)
  const [createdBy, setCreatedBy] = useState('all')
  const [createdDate, setCreatedDate] = useState('all')
  const [customerName, setCustomerName] = useState('all')
  const [product, setProduct] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadReport = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchRevenueMarginReport({ page, createdBy, createdDate, customerName, product })
        setRows(response.data || [])
        setOptions(response.options || emptyOptions)
        setTotalPages(response.pagination?.totalPages || 1)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load Revenue & Margin report')
        setRows([])
      } finally {
        setIsLoading(false)
      }
    }
    void loadReport()
  }, [createdBy, createdDate, customerName, page, product])

  const selectClass = 'rounded-md border border-[#D9D5CB] bg-white px-3 py-2 text-sm text-[#1F1D1A] outline-none focus:border-[#8E8778]'
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0)

  const resetPage = (setter: (value: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <Link to="/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B6657] transition hover:text-[#1F1D1A]">
        <ArrowLeft className="h-4 w-4" /> Reports
      </Link>
      <div>
        <h1 className="crm-page-heading">REVENUE &amp; MARGIN REPORTS</h1>
      </div>

      <section className="border-b border-[#E7E3DA] pb-5">
        <div className="grid gap-3 md:grid-cols-4">
          <select aria-label="Created By" className={selectClass} value={createdBy} onChange={(event) => resetPage(setCreatedBy, event.target.value)}>
            <option value="all">Created By: All</option>
            {options.createdBy.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select aria-label="Created Date" className={selectClass} value={createdDate} onChange={(event) => resetPage(setCreatedDate, event.target.value)}>
            <option value="all">Created Date: All</option>
            {options.createdDates.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select aria-label="Customer Name" className={selectClass} value={customerName} onChange={(event) => resetPage(setCustomerName, event.target.value)}>
            <option value="all">Customer Name: All</option>
            {options.customerNames.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select aria-label="Product" className={selectClass} value={product} onChange={(event) => resetPage(setProduct, event.target.value)}>
            <option value="all">Product: All</option>
            {options.products.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-[#EFECE5] bg-white">
        <table className="w-full min-w-[620px] text-left text-sm text-[#1F1D1A]">
          <thead className="bg-[#F7F5F2] text-left text-xs uppercase tracking-wide text-[#6B6657]"><tr><th className="px-4 py-3 text-left">Created By</th><th className="border-l border-[#EFECE5] px-4 py-3 text-left">Customer</th><th className="border-l border-[#EFECE5] px-4 py-3 text-left">Product</th><th className="border-l border-[#EFECE5] px-4 py-3 text-left">Quantity</th><th className="border-l border-[#EFECE5] px-4 py-3 text-left">Revenue</th><th className="border-l border-[#EFECE5] px-4 py-3 text-left">Cost</th><th className="border-l border-[#EFECE5] px-4 py-3 text-left">Profit</th><th className="border-l border-[#EFECE5] px-4 py-3 text-left">Margin %</th></tr></thead>
          <tbody className="divide-y divide-[#EFECE5]">
            {isLoading ? <tr><td colSpan={8} className="px-4 py-10 text-center text-[#6B6657]">Loading report...</td></tr> : error ? <tr><td colSpan={8} className="px-4 py-10 text-center text-red-600">{error}</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-[#6B6657]">No records found</td></tr> : rows.map((row, index) => <tr key={`${row.createdBy}-${row.product}-${index}`}><td className="px-4 py-3 text-left">{row.createdBy}</td><td className="border-l border-[#EFECE5] px-4 py-3 text-left">{row.customer || '-'}</td><td className="border-l border-[#EFECE5] px-4 py-3 text-left">{row.product || '-'}</td><td className="border-l border-[#EFECE5] px-4 py-3 text-left tabular-nums">{row.quantity || 0}</td><td className="border-l border-[#EFECE5] px-4 py-3 text-left tabular-nums">{formatCurrency(row.revenue)}</td><td className="border-l border-[#EFECE5] px-4 py-3 text-left tabular-nums">{formatCurrency(row.cost || 0)}</td><td className="border-l border-[#EFECE5] px-4 py-3 text-left tabular-nums">{formatCurrency(row.profit || 0)}</td><td className="border-l border-[#EFECE5] px-4 py-3 text-left tabular-nums">{(row.marginPercent || 0).toFixed(2)}%</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-[#6B6657]">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2"><button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-[#D9D5CB] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">Previous</button><button type="button" disabled={page >= totalPages || isLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-md border border-[#D9D5CB] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">Next</button></div>
      </div>
    </div>
  )
}

type ReportColumn = { key: string; label: string }

const reportColumns: Record<string, ReportColumn[]> = {
  'top-customers': [
    { key: 'rank', label: 'Rank' }, { key: 'customer', label: 'Customer' }, { key: 'orders', label: 'Orders' },
    { key: 'quantity', label: 'Quantity' }, { key: 'revenue', label: 'Revenue' }, { key: 'profit', label: 'Profit' }, { key: 'marginPercent', label: 'Margin %' },
  ],
  'top-employees': [
    { key: 'rank', label: 'Rank' }, { key: 'employee', label: 'Employee' }, { key: 'orders', label: 'Orders' },
    { key: 'quantity', label: 'Quantity' }, { key: 'revenue', label: 'Revenue' }, { key: 'profit', label: 'Profit' }, { key: 'marginPercent', label: 'Margin %' },
  ],
  'top-products': [
    { key: 'rank', label: 'Rank' }, { key: 'product', label: 'Product' }, { key: 'quantity', label: 'Quantity Sold' },
    { key: 'revenue', label: 'Revenue' }, { key: 'profit', label: 'Profit' }, { key: 'marginPercent', label: 'Margin %' },
  ],
  usages: [
    { key: 'employee', label: 'Employee' }, { key: 'customersCreated', label: 'Customers Created' }, { key: 'contactsCreated', label: 'Contacts Created' },
    { key: 'quotations', label: 'Quotations' }, { key: 'sales', label: 'Sales' }, { key: 'activities', label: 'Activities' },
  ],
  'funnel-analysis': [
    { key: 'stage', label: 'Stage' }, { key: 'count', label: 'Count' }, { key: 'amount', label: 'Amount' }, { key: 'conversionPercent', label: 'Conversion %' },
  ],
  'product-analysis': [
    { key: 'product', label: 'Product' }, { key: 'quantity', label: 'Quantity Sold' }, { key: 'revenue', label: 'Revenue' },
    { key: 'cost', label: 'Cost' }, { key: 'profit', label: 'Profit' }, { key: 'marginPercent', label: 'Margin %' },
  ],
}

function GenericReport({ reportKey, title }: { reportKey: string; title: string }) {
  const [rows, setRows] = useState<Array<Record<string, string | number>>>([])
  const [options, setOptions] = useState<RevenueMarginOptions>(emptyOptions)
  const [createdBy, setCreatedBy] = useState('all')
  const [createdDate, setCreatedDate] = useState('all')
  const [customerName, setCustomerName] = useState('all')
  const [product, setProduct] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchReport(reportKey, { page, createdBy, createdDate, customerName, product })
        setRows(response.data || [])
        setOptions(response.options || emptyOptions)
        setTotalPages(response.pagination?.totalPages || 1)
        setMessage(response.unavailable ? response.message || 'This report is unavailable.' : null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load report')
        setRows([])
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [createdBy, createdDate, customerName, page, product, reportKey])

  const selectClass = 'rounded-md border border-[#D9D5CB] bg-white px-3 py-2 text-sm text-[#1F1D1A] outline-none focus:border-[#8E8778]'
  const columns = reportColumns[reportKey] || []
  const formatValue = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') return '-'
    if (['revenue', 'cost', 'profit', 'amount'].includes(key)) return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0)
    if (['marginPercent', 'conversionPercent'].includes(key)) return `${Number(value || 0).toFixed(2)}%`
    return String(value)
  }
  const setFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1) }

  return (
    <div className="space-y-6">
      <Link to="/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B6657] transition hover:text-[#1F1D1A]"><ArrowLeft className="h-4 w-4" /> Reports</Link>
      <div><h1 className="crm-page-heading">{title.toUpperCase()}</h1></div>
      <section className="border-b border-[#E7E3DA] pb-5"><div className="grid gap-3 md:grid-cols-4">
        <select aria-label="Created By" className={selectClass} value={createdBy} onChange={(event) => setFilter(setCreatedBy, event.target.value)}><option value="all">Created By: All</option>{options.createdBy.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Created Date" className={selectClass} value={createdDate} onChange={(event) => setFilter(setCreatedDate, event.target.value)}><option value="all">Created Date: All</option>{options.createdDates.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Customer Name" className={selectClass} value={customerName} onChange={(event) => setFilter(setCustomerName, event.target.value)}><option value="all">Customer Name: All</option>{options.customerNames.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Product" className={selectClass} value={product} onChange={(event) => setFilter(setProduct, event.target.value)}><option value="all">Product: All</option>{options.products.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      </div></section>
      {message ? <section className="rounded-lg border border-[#EFECE5] bg-white p-8 text-sm text-[#6B6657]">{message}</section> : <>
        <div className="overflow-x-auto rounded-lg border border-[#EFECE5] bg-white"><table className="w-full min-w-[760px] text-left text-sm text-[#1F1D1A]"><thead className="bg-[#F7F5F2] text-xs uppercase tracking-wide text-[#6B6657]"><tr>{columns.map((column) => <th key={column.key} className="border-r border-[#EFECE5] px-4 py-3 text-left">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-[#EFECE5]">{isLoading ? <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-[#6B6657]">Loading report...</td></tr> : error ? <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-red-600">{error}</td></tr> : rows.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-[#6B6657]">No records found</td></tr> : rows.map((row, index) => <tr key={`${reportKey}-${index}`}>{columns.map((column) => <td key={column.key} className="border-r border-[#EFECE5] px-4 py-3 text-left tabular-nums">{formatValue(column.key, row[column.key])}</td>)}</tr>)}</tbody></table></div>
        <div className="flex items-center justify-between text-sm text-[#6B6657]"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-[#D9D5CB] px-3 py-2 disabled:opacity-50">Previous</button><button type="button" disabled={page >= totalPages || isLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-md border border-[#D9D5CB] px-3 py-2 disabled:opacity-50">Next</button></div></div>
      </>}
    </div>
  )
}
