'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Toast } from '@/components/toast'
import { fetchOPFs, deleteOPF, type OPFRecord } from '@/lib/opfApi'
import { fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi'

const entriesOptions = [10, 25, 50, 100]

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB')
}

const formatCurrency = (value?: number | string) => {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || numeric === 0) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numeric)
}

const getUniqueValues = (items: Array<string | undefined>) =>
  Array.from(new Set(items.filter(Boolean) as string[])).sort()

export default function OPFPage() {
  const navigate = useNavigate()
  const [opfData, setOPFData] = useState<OPFRecord[]>([])
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [createdBy, setCreatedBy] = useState('all')
  const [createdDate, setCreatedDate] = useState('all')
  const [renewalDate, setRenewalDate] = useState('all')
  const [customerName, setCustomerName] = useState('all')
  const [approvalStatus, setApprovalStatus] = useState('all')
  const [product, setProduct] = useState('all')
  const [entriesPerPage, setEntriesPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await fetchCustomers({ limit: 1000 })
        setCustomers(response.data || [])
      } catch (_error) {
        setCustomers([])
      }
    }

    const loadOPFs = async () => {
      setIsLoading(true)
      try {
        const response = await fetchOPFs({ limit: 1000 })
        setOPFData(response.data || [])
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load OPF records')
      } finally {
        setIsLoading(false)
      }
    }

    void loadCustomers()
    void loadOPFs()
  }, [])

  const filterOptions = useMemo(() => {
    const createdByOptions = getUniqueValues(opfData.map((item) => item.createdBy))
    const createdDateOptions = getUniqueValues(opfData.map((item) => formatDate(item.createdDate)))
    const renewalDateOptions = getUniqueValues(opfData.map((item) => formatDate(item.renewalDate)))
    const customerNameOptions = getUniqueValues([
      ...opfData.map((item) => item.customerName),
      ...customers.map((customer) => customer.customerName || customer.companyName),
    ])
    const approvalStatusOptions = getUniqueValues(opfData.map((item) => item.approvalStatus))
    const productOptions = getUniqueValues(opfData.map((item) => item.product))

    return {
      createdByOptions,
      createdDateOptions,
      renewalDateOptions,
      customerNameOptions,
      approvalStatusOptions,
      productOptions,
    }
  }, [opfData, customers])

  const filteredOPFs = useMemo(() => {
    return opfData.filter((item) => {
      if (createdBy !== 'all' && (item.createdBy || 'Admin') !== createdBy) return false
      if (createdDate !== 'all' && formatDate(item.createdDate) !== createdDate) return false
      if (renewalDate !== 'all' && formatDate(item.renewalDate) !== renewalDate) return false
      if (customerName !== 'all' && (item.customerName || '') !== customerName) return false
      if (approvalStatus !== 'all' && (item.approvalStatus || 'Pending') !== approvalStatus) return false
      if (product !== 'all' && (item.product || '') !== product) return false

      if (!searchQuery.trim()) return true

      const search = searchQuery.trim().toLowerCase()
      return [item.opfNo, item.quotationNumber, item.quotationId, item.customerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    })
  }, [opfData, createdBy, createdDate, renewalDate, customerName, approvalStatus, product, searchQuery])

  const pageCount = Math.max(1, Math.ceil(filteredOPFs.length / entriesPerPage))
  const pageData = filteredOPFs.slice((page - 1) * entriesPerPage, page * entriesPerPage)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this OPF record?')) return
    try {
      await deleteOPF(id)
      setOPFData((prev) => prev.filter((item) => item._id !== id))
      setToast('OPF deleted successfully')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Failed to delete OPF')
    }
  }

  const downloadReport = () => {
    const headers = ['OPF No', 'Created By', 'Quotation Number', 'Customer Name', 'Contact Person', 'Product', 'Revenue', 'Margin', 'Created Date', 'Renewal Date', 'Approval Status', 'PO File']
    const rows = filteredOPFs.map((item) => [
      item.opfNo || '-',
      item.createdBy || 'Admin',
      item.quotationNumber || '-',
      item.customerName || '-',
      item.contactPerson || '-',
      item.product || '-',
      String(formatCurrency(item.revenue)),
      String(formatCurrency(item.margin)),
      formatDate(item.createdDate),
      formatDate(item.renewalDate),
      item.approvalStatus || 'Pending',
      item.poFile?.fileName || '-',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'opf-report.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">OPF</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/sales/opf/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B]"
        >
          <Plus className="h-4 w-4" /> GENERATE NEW
        </button>
      </div>

      <div className="grid gap-4 grid-cols-6">
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
          <input
            type="date"
            value={createdDate === 'all' ? '' : createdDate}
            onChange={(event) => { setCreatedDate(event.target.value || 'all'); setPage(1) }}
            className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Renewal Date</span>
          <input
            type="date"
            value={renewalDate === 'all' ? '' : renewalDate}
            onChange={(event) => { setRenewalDate(event.target.value || 'all'); setPage(1) }}
            className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          />
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

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Approval Status</span>
          <select
            value={approvalStatus}
            onChange={(event) => { setApprovalStatus(event.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          >
            <option value="all">All</option>
            {filterOptions.approvalStatusOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Product</span>
          <select
            value={product}
            onChange={(event) => { setProduct(event.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          >
            <option value="all">All</option>
            {filterOptions.productOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#EFECE5] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>Show</span>
          <select
            value={entriesPerPage}
            onChange={(event) => { setEntriesPerPage(Number(event.target.value)); setPage(1) }}
            className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          >
            {entriesOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <span>entries</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={downloadReport}
            className="inline-flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-[#E7E3DA]"
          >
            <Download className="h-4 w-4" /> Download Report
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }}
              placeholder="Search by quotation number"
              className="w-72 rounded-lg border border-[#EFECE5] bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#EFECE5] bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F2EFE8] text-left text-xs uppercase tracking-wider text-gray-600">
            <tr>
              <th className="border-r border-[#D1D5DB] px-4 py-3">OPF No</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Created By</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Quotation Number</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Customer Name</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Contact Person</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Product</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Revenue</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Margin</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Created Date</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Renewal Date</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">Approval Status</th>
              <th className="border-r border-[#D1D5DB] px-4 py-3">PO File</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading OPF records…
                </td>
              </tr>
            ) : filteredOPFs.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-gray-500">
                  No OPF records found.
                </td>
              </tr>
            ) : (
              pageData.map((item) => (
                <tr key={item._id} className="border-t border-[#EFECE5] bg-white">
                  <td className="border-r border-[#D1D5DB] px-4 py-3 font-medium text-gray-900">{item.opfNo || '-'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{item.createdBy || 'Admin'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{item.quotationNumber || '-'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{item.customerName || '-'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{item.contactPerson || '-'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{item.product || '-'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{formatCurrency(item.revenue)}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{formatCurrency(item.margin)}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{formatDate(item.createdDate)}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{formatDate(item.renewalDate)}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{item.approvalStatus || 'Pending'}</td>
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">
                    {item.poFile?.filePath ? (
                      <a href={item.poFile.filePath} target="_blank" rel="noreferrer" className="text-blue-600 underline">{item.poFile.fileName || 'View PO'}</a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => navigate(`/sales/opf/${item._id}`)} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="View OPF">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => navigate(`/sales/opf/edit/${item._id}`)} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="Edit OPF">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(item._id)} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="Delete OPF">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-2 text-sm text-gray-600">
        <div>{`Showing ${pageData.length} of ${filteredOPFs.length} entries`}</div>
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
