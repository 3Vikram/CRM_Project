'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { Toast } from '@/sales/components/toast'
import { fetchOPFById, fetchOPFs, deleteOPF, type OPFRecord } from '@/sales/lib/opfApi'
import { fetchCustomers, type CustomerApiRecord } from '@/sales/lib/customerApi'
import { PermissionGate } from '@/sales/components/PermissionGate'
import { PageFilters, type PageFilterField, type PageFilterValues } from '@/sales/components/PageFilters'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import { toExcelDate } from '@/sales/lib/excelFormat'

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

const getRenewalDate = (item: { renewalDate?: string; amcRenewalDate?: string }) => item.renewalDate || item.amcRenewalDate
const getDateFilterValue = (value?: string | null) => {
  if (!value) return ''
  const datePrefix = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (datePrefix) return datePrefix
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const fetchAllOPFs = async (params: NonNullable<Parameters<typeof fetchOPFs>[0]> = {}) => {
  const firstPage = await fetchOPFs({ ...params, page: 1, limit: 1000 })
  const records = [...(firstPage.data || [])]
  const totalPages = firstPage.pagination?.totalPages || 1
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetchOPFs({ ...params, page, limit: 1000 })
    records.push(...(response.data || []))
  }
  return records
}

const fetchAllCustomers = async () => {
  const firstPage = await fetchCustomers({ page: 1, limit: 1000 })
  const records = [...(firstPage.data || [])]
  const totalPages = firstPage.pagination?.totalPages || 1
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetchCustomers({ page, limit: 1000 })
    records.push(...(response.data || []))
  }
  return records
}

export default function OPFPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRecordId = searchParams.get('recordId')
  const [opfData, setOPFData] = useState<OPFRecord[]>([])
  const [serverFilteredOPFs, setServerFilteredOPFs] = useState<OPFRecord[] | null>(null)
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [filters, setFilters] = useState<PageFilterValues>({})
  const [entriesPerPage, setEntriesPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const filterRequestId = useRef(0)

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setCustomers(await fetchAllCustomers())
      } catch (_error) {
        setCustomers([])
      }
    }

    const loadOPFs = async () => {
      setIsLoading(true)
      try {
        const records = await fetchAllOPFs()
        if (selectedRecordId) {
          const selectedRecord = await fetchOPFById(selectedRecordId)
          if (selectedRecord && !records.some((item) => item._id === selectedRecord._id)) {
            records.unshift(selectedRecord)
          }
        }
        setOPFData(records)
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load OPF records')
      } finally {
        setIsLoading(false)
      }
    }

    void loadCustomers()
    void loadOPFs()
  }, [selectedRecordId])

  const filterOptions = useMemo(() => {
    const customerNameOptions = getUniqueValues([
      ...opfData.map((item) => item.customerName),
      ...customers.map((customer) => customer.customerName || customer.companyName),
    ])
    const productOptions = getUniqueValues(opfData.map((item) => item.product))

    return {
      customerNameOptions,
      productOptions,
    }
  }, [opfData, customers])

  const filterFields = useMemo<PageFilterField[]>(() => [
    { key: 'createdBy', label: 'Created By', type: 'select', options: getUniqueValues(opfData.map((item) => item.createdBy || 'Admin')) },
    { key: 'customerName', label: 'Customer Name', type: 'select', options: filterOptions.customerNameOptions },
    { key: 'approvalStatus', label: 'Approval Status', type: 'select', options: getUniqueValues(opfData.map((item) => item.approvalStatus || 'Pending')) },
    { key: 'product', label: 'Product', type: 'select', options: filterOptions.productOptions },
    { key: 'createdDate', label: 'Created Date', type: 'date' },
    { key: 'renewalDate', label: 'Renewal Date', type: 'date' },
  ], [opfData, filterOptions.customerNameOptions, filterOptions.productOptions])

  const applyFilters = async (values: PageFilterValues) => {
    const requestId = ++filterRequestId.current
    setFilters(values)
    setPage(1)
    if (!Object.values(values).some(Boolean)) {
      setServerFilteredOPFs(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const records = await fetchAllOPFs({
        createdBy: values.createdBy,
        createdDate: values.createdDate,
        renewalDate: values.renewalDate,
        customerName: values.customerName,
        approvalStatus: values.approvalStatus,
        product: values.product,
      })
      if (requestId === filterRequestId.current) setServerFilteredOPFs(records)
    } catch (error) {
      if (requestId === filterRequestId.current) {
        setServerFilteredOPFs(null)
        setToast(error instanceof Error ? error.message : 'Unable to apply OPF filters')
      }
    } finally {
      if (requestId === filterRequestId.current) setIsLoading(false)
    }
  }

  const filteredOPFs = useMemo(() => {
    return (serverFilteredOPFs ?? opfData).filter((item) => {
      if (selectedRecordId && item._id !== selectedRecordId && item.opfNo !== selectedRecordId) return false
      if (filters.createdBy && (item.createdBy || 'Admin') !== filters.createdBy) return false
      if (filters.createdDate && getDateFilterValue(item.createdDate) !== filters.createdDate) return false
      if (filters.renewalDate && getDateFilterValue(getRenewalDate(item)) !== filters.renewalDate) return false
      if (filters.customerName && (item.customerName || '') !== filters.customerName) return false
      if (filters.approvalStatus && (item.approvalStatus || 'Pending') !== filters.approvalStatus) return false
      if (filters.product && (item.product || '') !== filters.product) return false

      if (!searchQuery.trim()) return true

      const search = searchQuery.trim().toLowerCase()
      return [item.opfNo, item.quotationNumber, item.quotationId, item.customerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    })
  }, [opfData, serverFilteredOPFs, selectedRecordId, filters, searchQuery])

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

  const downloadReport = async () => {
    const headers = ['SL No.', 'OPF No', 'Created By', 'Quotation Number', 'Customer Name', 'Contact Person', 'Product', 'Revenue', 'Margin', 'Created Date', 'Renewal Date', 'Approval Status', 'PO File']
    const rows = filteredOPFs.map((item, index) => [
      index + 1,
      String(item.opfNo || ''),
      item.createdBy || '',
      String(item.quotationNumber || ''),
      item.customerName || '',
      item.contactPerson || '',
      item.product || '',
      Number(item.revenue) || 0,
      Number(item.margin) || 0,
      toExcelDate(item.createdDate),
      toExcelDate(getRenewalDate(item)),
      item.approvalStatus || '',
      item.poFile?.fileName || '',
    ])

    try {
      await downloadExcelReport({
        fileName: 'opf-report.xlsx',
        sheetName: 'OPF',
        headers,
        rows,
        textColumns: [1, 3, 9, 10],
        centerColumns: [0, 1, 3, 9, 10, 11],
        leftColumns: [2, 4, 5, 6, 12],
        rightColumns: [7, 8],
        currencyColumns: [7, 8],
        wrapColumns: [4, 5, 6, 12],
        wideColumns: [4, 12],
        columnWidths: [8, 16, 22, 18, 32, 24, 32, 18, 18, 14, 14, 16, 36],
      })
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to download OPF report')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">OPF</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedRecordId ? (
            <button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('recordId'); setSearchParams(next) }} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-[#F2EFE8]">
              Show all OPFs
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/sales/opf/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1E293B]"
          >
            <Plus className="h-4 w-4" /> GENERATE NEW
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#EFECE5] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }}
              placeholder="Search by quotation number"
              className="w-72 rounded-lg border border-[#EFECE5] bg-white py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>Show</span>
            <select
              value={entriesPerPage}
              onChange={(event) => { setEntriesPerPage(Number(event.target.value)); setPage(1) }}
              className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            >
              {entriesOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span>entries</span>
          </div>
          <PageFilters
            fields={filterFields}
            values={filters}
            onApply={(values) => { void applyFilters(values) }}
            onClear={() => { filterRequestId.current += 1; setFilters({}); setServerFilteredOPFs(null); setIsLoading(false); setPage(1) }}
          />
          <button
            type="button"
            onClick={downloadReport}
            className="inline-flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-[#E7E3DA]"
          >
            <Download className="h-4 w-4" /> Download Report
          </button>
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
                  <td className="border-r border-[#D1D5DB] px-4 py-3 text-gray-700">{formatDate(getRenewalDate(item))}</td>
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
                      <button type="button" onClick={() => window.open(`/sales/opf/${item._id}`, '_blank')} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="View OPF">
                        <Eye className="h-4 w-4" />
                      </button>
                      <PermissionGate moduleName="opf" action="edit"><button type="button" onClick={() => navigate(`/sales/opf/edit/${item._id}`)} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="Edit OPF"><Pencil className="h-4 w-4" /></button></PermissionGate>
                      <PermissionGate moduleName="opf" action="delete"><button type="button" onClick={() => handleDelete(item._id)} className="rounded-lg p-2 text-gray-600 hover:bg-[#F2EFE8]" aria-label="Delete OPF"><Trash2 className="h-4 w-4" /></button></PermissionGate>
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
