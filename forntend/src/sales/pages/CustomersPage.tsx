'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/modal'
import { Toast } from '@/components/toast'
import { deleteCustomer, fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi'
import {
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Hash,
  Calendar,
  Activity,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react'

interface Customer {
  id: string
  customerId: string
  companyName: string
  customerName: string
  contactName: string
  email: string
  phone: string
  status: 'Active' | 'Inactive'
  accountType: string
  createdBy: string
  createdAt: string
  notes: string
  address: string
  location: string
  gst: string
}

const PAGE_SIZE = 20
const tableCellClass = 'px-6 py-3 border-r border-[#D1D5DB]'

export default function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [createdByFilter, setCreatedByFilter] = useState('all')
  const [createdDateFilter, setCreatedDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [accountTypeFilter, setAccountTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [pendingDeleteCustomer, setPendingDeleteCustomer] = useState<Customer | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const searchTimeoutRef = useRef<number | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')
  const customerCacheRef = useRef<Map<string, { data: Customer[]; totalPages: number; totalCount: number }>>(new Map())

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
  }, [])

  const loadCustomers = useCallback(async (
    nextPage: number,
    nextPageSize: number,
    nextSearch: string,
    nextCreatedBy: string,
    nextStatus: string,
    nextAccountType: string,
    nextDate: string,
  ) => {
    const cacheKey = JSON.stringify({
      search: nextSearch.trim(),
      page: nextPage,
      limit: nextPageSize,
      createdBy: nextCreatedBy,
      status: nextStatus,
      accountType: nextAccountType,
      createdDate: nextDate,
    })

    const cachedResponse = customerCacheRef.current.get(cacheKey)
    if (cachedResponse) {
      setCustomers(cachedResponse.data)
      setTotalPages(cachedResponse.totalPages)
      setTotalCount(cachedResponse.totalCount)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetchCustomers({
        search: nextSearch,
        page: nextPage,
        limit: nextPageSize,
        createdBy: nextCreatedBy,
        status: nextStatus,
        accountType: nextAccountType,
        createdDate: nextDate,
      })
      const nextCustomers = (response.data || []).map(mapApiCustomer)
      const nextPagination = {
        totalPages: response.pagination?.totalPages || 1,
        totalCount: response.pagination?.total || 0,
      }

      customerCacheRef.current.set(cacheKey, {
        data: nextCustomers,
        totalPages: nextPagination.totalPages,
        totalCount: nextPagination.totalCount,
      })

      setCustomers(nextCustomers)
      setTotalPages(nextPagination.totalPages)
      setTotalCount(nextPagination.totalCount)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to load customers', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, searchQuery, createdByFilter, statusFilter, accountTypeFilter, createdDateFilter, notify])

  useEffect(() => {
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = window.setTimeout(() => {
      void loadCustomers(page, pageSize, searchQuery, createdByFilter, statusFilter, accountTypeFilter, createdDateFilter)
    }, 500)

    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current)
    }
  }, [page, pageSize, searchQuery, createdByFilter, createdDateFilter, statusFilter, accountTypeFilter, loadCustomers])

  const createdByOptions = useMemo(() => Array.from(new Set(customers.map((customer) => customer.createdBy).filter(Boolean))).sort(), [customers])
  const accountTypeOptions = useMemo(() => Array.from(new Set(customers.map((customer) => customer.accountType).filter(Boolean))).sort(), [customers])
  const summaryText = useMemo(() => {
    if (totalCount === 0) return 'Showing 0 to 0 of 0 entries'
    return `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, totalCount)} of ${totalCount} entries`
  }, [page, pageSize, totalCount])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, createdByFilter, createdDateFilter, statusFilter, accountTypeFilter, pageSize])

  const handleView = useCallback((customer: Customer) => setSelectedCustomer(customer), [])
  const handleCloseModal = useCallback(() => setSelectedCustomer(null), [])

  const handleAddNew = useCallback(() => navigate('/customers/new'), [navigate])
  const handleEdit = useCallback((customer: Customer) => navigate(`/customers/edit/${customer.id}`), [navigate])

  const handleDelete = useCallback(async () => {
    if (!pendingDeleteCustomer) return
    setIsDeleting(true)
    try {
      await deleteCustomer(pendingDeleteCustomer.id)
      customerCacheRef.current.clear()
      setPendingDeleteCustomer(null)
      await loadCustomers(page, pageSize, searchQuery, createdByFilter, statusFilter, accountTypeFilter, createdDateFilter)
      notify('Customer deleted')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to delete customer', 'error')
    } finally {
      setIsDeleting(false)
    }
  }, [accountTypeFilter, createdByFilter, createdDateFilter, loadCustomers, page, pageSize, pendingDeleteCustomer, searchQuery, statusFilter, notify])

  const handleDownloadReport = useCallback(() => {
    const rows = customers.map((customer) => [
      customer.companyName,
      customer.customerName,
      customer.email,
      customer.phone,
      customer.status,
      customer.accountType,
      customer.createdBy,
      customer.createdAt,
    ])

    const csv = [
      ['Customer Name', 'Contact Name', 'Email', 'Phone', 'Status', 'Account Type', 'Created By', 'Created Date'],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'customer-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }, [customers])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">
            Customer List
          </h1>
          <p className="text-gray-600">
            {/* Manage customer accounts and contacts in one place. */}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B]"
          >
            <Plus className="h-4 w-4" />
            Add New
          </button>
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-[#E7E3DA]"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-[#EFECE5] bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Created By</span>
            <select className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" value={createdByFilter} onChange={(event) => setCreatedByFilter(event.target.value)}>
              <option value="all">All</option>
              {createdByOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Created Date</span>
            <select className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" value={createdDateFilter} onChange={(event) => setCreatedDateFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="thismonth">This Month</option>
            </select>
          </label>

          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Status</span>
            <select className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>

          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Account Type</span>
            <select className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" value={accountTypeFilter} onChange={(event) => setAccountTypeFilter(event.target.value)}>
              <option value="all">All</option>
              {accountTypeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-[#EFECE5]">
          {isLoading ? (
            <div className="space-y-2 py-8">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-[#F2EFE8]" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#EFECE5] bg-[#F2EFE8]">
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Customer ID</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Created By</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Customer Name</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Contact Name</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Contact Email</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Contact Number</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Account Type</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length > 0 ? (
                    customers.map((customer) => (
                      <CustomerTableRow
                        key={customer.id}
                        customer={customer}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={(customer) => setPendingDeleteCustomer(customer)}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-gray-500 border-r border-[#D1D5DB]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Building2 className="h-8 w-8 text-gray-300" />
                          <p>No customers found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE5] pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show</span>
            <select className="rounded border border-[#EFECE5] bg-white px-2 py-1.5 text-sm text-gray-700" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="text-sm text-gray-500">{summaryText}</div>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50"
              disabled={page === totalPages}
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={!!selectedCustomer} onClose={handleCloseModal} title={selectedCustomer?.companyName || ''}>
        {selectedCustomer && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedCustomer.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                {selectedCustomer.status}
              </span>
              <span className="text-xs text-slate-400">{selectedCustomer.accountType}</span>
            </div>

            <div className="grid gap-3">
              <DetailRow icon={<Building2 className="h-4 w-4 text-slate-400" />} label="Contact Person" value={selectedCustomer.contactName} />
              <DetailRow icon={<Mail className="h-4 w-4 text-slate-400" />} label="Email" value={selectedCustomer.email} />
              <DetailRow icon={<Phone className="h-4 w-4 text-slate-400" />} label="Phone" value={selectedCustomer.phone} />
              <DetailRow icon={<MapPin className="h-4 w-4 text-slate-400" />} label="Location" value={selectedCustomer.location} />
              <DetailRow icon={<Hash className="h-4 w-4 text-slate-400" />} label="GST" value={selectedCustomer.gst} />
              <DetailRow icon={<Activity className="h-4 w-4 text-slate-400" />} label="Status" value={selectedCustomer.status} />
              <DetailRow icon={<Calendar className="h-4 w-4 text-slate-400" />} label="Created" value={selectedCustomer.createdAt} />
              <DetailRow icon={<FileText className="h-4 w-4 text-slate-400" />} label="Notes" value={selectedCustomer.notes || '—'} />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button onClick={() => handleEdit(selectedCustomer)} className="rounded bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E293B]">
                Edit Customer
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!pendingDeleteCustomer}
        onClose={() => !isDeleting && setPendingDeleteCustomer(null)}
        title="Delete Customer"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setPendingDeleteCustomer(null)} disabled={isDeleting} className="rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => void handleDelete()} disabled={isDeleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      >
        <p className="text-sm text-gray-700">Are you sure to delete this customer?</p>
      </Modal>

      {showToast && <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />}
    </div>
  )
}

function mapApiCustomer(customer: CustomerApiRecord): Customer {
  const primaryContact = customer.contacts?.[0]
  return {
    id: customer._id,
    customerId: customer.customerId || '',
    companyName: customer.companyName || customer.customerName || 'Untitled Customer',
    customerName: customer.customerName || customer.companyName || 'Untitled Customer',
    contactName: primaryContact?.name || customer.customerName || '',
    email: primaryContact?.email || customer.email || '',
    phone: primaryContact?.phone || customer.phone || '',
    status: customer.status || 'Active',
    accountType: customer.accountType || 'Individual',
    createdBy: customer.createdBy || 'Admin',
    createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString().slice(0, 10) : '',
    notes: customer.notes || '',
    address: customer.billToAddress?.addressLine1 || '',
    location: customer.billToAddress?.city || customer.state || '',
    gst: customer.gstNumber || '',
  }
}

function matchesCreatedDate(createdAt: string, filter: string) {
  if (!createdAt || filter === 'all') return true

  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return true

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(startOfToday)
  yesterday.setDate(yesterday.getDate() - 1)
  const last7Days = new Date(startOfToday)
  last7Days.setDate(last7Days.getDate() - 6)
  const last30Days = new Date(startOfToday)
  last30Days.setDate(last30Days.getDate() - 29)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  switch (filter) {
    case 'today':
      return date >= startOfToday
    case 'yesterday':
      return date >= yesterday && date < startOfToday
    case 'last7days':
      return date >= last7Days
    case 'last30days':
      return date >= last30Days
    case 'thismonth':
      return date >= startOfMonth
    default:
      return true
  }
}

const CustomerTableRow = memo(function CustomerTableRow({
  customer,
  onView,
  onEdit,
  onDelete,
}: {
  customer: Customer
  onView: (customer: Customer) => void
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
}) {
  return (
    <tr className="border-b border-[#F2EFE8] transition-colors hover:bg-[#F2EFE8]">
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm font-semibold text-gray-900`}>{customer.customerId}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{customer.createdBy || 'Admin'}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{customer.companyName}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{customer.contactName}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{customer.email}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{customer.phone}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{customer.accountType}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')}`}>
        <div className="flex gap-2">
          <button onClick={() => onView(customer)} className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]" title="View">
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onEdit(customer)} className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(customer)} className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
})

const DetailRow = memo(function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-slate-600">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <p className="mt-1 text-sm text-slate-800">{value}</p>
      </div>
    </div>
  )
})