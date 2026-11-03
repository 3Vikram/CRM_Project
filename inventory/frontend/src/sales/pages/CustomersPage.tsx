'use client'

import { createPortal } from 'react-dom'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/sales/components/modal'
import { Toast } from '@/sales/components/toast'
import { PageFilters, type PageFilterValues } from '@/sales/components/PageFilters'
import { deleteCustomer, fetchCustomerSummary, fetchCustomers, type CustomerApiRecord, type CustomerSummary } from '@/sales/lib/customerApi'
import { PermissionGate } from '@/sales/components/PermissionGate'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import { toExcelDate } from '@/sales/lib/excelFormat'
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
  Pencil,
  Trash2,
  MoreVertical,
  BarChart3,
  Users,
  UserCheck,
  UserX,
  CalendarDays,
  Funnel,
} from 'lucide-react'

interface Customer {
  id: string
  customerId: string
  companyName: string
  customerName: string
  contactName: string
  email: string
  phone: string
  status: string
  accountType: string
  industry: string
  accountManager: string
  contacts: Array<{ name: string; email: string; phone: string }>
  approvalStatus: string
  approvedBy: string
  approvedAt: string
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
  const [summary, setSummary] = useState<CustomerSummary>({ total: 0, active: 0, inactive: 0, newThisMonth: 0 })
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
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<{ customer: Customer; top: number; left: number; width: number } | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const actionMenuRef = useRef<HTMLDivElement | null>(null)
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

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await fetchCustomerSummary())
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to load customer summary', 'error')
    }
  }, [notify])

  useEffect(() => { void loadSummary() }, [loadSummary])

  useEffect(() => {
    if (!activeMenu) return
    const closeWhenOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-customer-action-menu]')) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('pointerdown', closeWhenOutside)
    return () => document.removeEventListener('pointerdown', closeWhenOutside)
  }, [activeMenu])

  const createdByOptions = useMemo(() => Array.from(new Set(customers.map((customer) => customer.createdBy).filter((value): value is string => Boolean(value)))).sort(), [customers])
  const accountTypeOptions = useMemo(() => Array.from(new Set(customers.map((customer) => customer.accountType).filter((value): value is string => Boolean(value)))).sort(), [customers])
  const customerFilterFields = [
    { key: 'createdBy', label: 'Created By', type: 'select' as const, options: createdByOptions },
    { key: 'createdDate', label: 'Created Date', type: 'date' as const },
    { key: 'accountType', label: 'Account Type', type: 'select' as const, options: accountTypeOptions },
  ]
  const customerFilterValues = {
    createdBy: createdByFilter === 'all' ? '' : createdByFilter,
    createdDate: createdDateFilter === 'all' ? '' : createdDateFilter,
    accountType: accountTypeFilter === 'all' ? '' : accountTypeFilter,
  }
  const applyCustomerFilters = (values: PageFilterValues) => {
    setCreatedByFilter(values.createdBy || 'all')
    setCreatedDateFilter(values.createdDate || 'all')
    setAccountTypeFilter(values.accountType || 'all')
  }
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
  const handleActionMenu = useCallback((customer: Customer, button: HTMLButtonElement) => {
    if (activeMenu?.customer.id === customer.id) {
      setActiveMenu(null)
      return
    }
    const bounds = button.getBoundingClientRect()
    const menuWidth = Math.min(205, window.innerWidth - 16)
    const menuHeight = 150
    const gap = 6
    const spaceRight = window.innerWidth - bounds.right
    const left = spaceRight >= menuWidth + gap
      ? bounds.right + gap
      : Math.max(8, bounds.left - menuWidth - gap)
    const top = Math.max(8, Math.min(bounds.top, window.innerHeight - menuHeight - 8))
    setActiveMenu({
      customer,
      top,
      left: Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8)),
      width: menuWidth,
    })
  }, [activeMenu])
  const handleConvert = useCallback((action: 'activity' | 'funnel' | 'quotation', customer: Customer) => {
    setActiveMenu(null)
    const formCustomer = {
      _id: customer.id,
      companyName: customer.companyName,
      customerName: customer.companyName,
      contactPerson: customer.contactName,
      email: customer.email,
      mobile: customer.phone,
      contacts: customer.contacts,
      industry: customer.industry,
    }
    if (action === 'activity') {
      navigate('/sales/activities/new', { state: { lead: formCustomer } })
    } else if (action === 'funnel') {
      navigate('/sales/funnels/new', { state: { customer: formCustomer } })
    } else {
      navigate('/sales/quotations/new/rent', { state: { customer: formCustomer } })
    }
  }, [navigate])

  const handleDelete = useCallback(async () => {
    if (!pendingDeleteCustomer) return
    setIsDeleting(true)
    try {
      await deleteCustomer(pendingDeleteCustomer.id)
      customerCacheRef.current.clear()
      setPendingDeleteCustomer(null)
      await loadCustomers(page, pageSize, searchQuery, createdByFilter, statusFilter, accountTypeFilter, createdDateFilter)
      await loadSummary()
      notify('Customer deleted')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to delete customer', 'error')
    } finally {
      setIsDeleting(false)
    }
  }, [accountTypeFilter, createdByFilter, createdDateFilter, loadCustomers, loadSummary, page, pageSize, pendingDeleteCustomer, searchQuery, statusFilter, notify])

  const handleDownloadReport = useCallback(async () => {
    const headers = ['SL No.', 'Customer Name', 'Contact Name', 'Email', 'Phone', 'Status', 'Account Type', 'Created By', 'Created Date']
    const rows = customers.map((customer, index) => [
      index + 1,
      customer.companyName || '',
      customer.customerName || '',
      customer.email || '',
      customer.phone ? String(customer.phone) : '',
      customer.status || '',
      customer.accountType || '',
      customer.createdBy || '',
      toExcelDate(customer.createdAt),
    ])

    try {
      await downloadExcelReport({
        fileName: 'customer-report.xlsx',
        sheetName: 'Customers',
        headers,
        rows,
        textColumns: [4, 8],
        centerColumns: [0, 5, 6, 8],
        leftColumns: [1, 2, 3, 7],
        wrapColumns: [1, 2, 3, 7],
        wideColumns: [1, 3],
        columnWidths: [8, 34, 28, 34, 18, 14, 16, 22, 14],
      })
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'Unable to download customer report')
      setToastType('error')
      setShowToast(true)
    }
  }, [customers])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">Manage customer accounts and contacts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setIsAnalyticsOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-[#E8EAF0] bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <BarChart3 className="h-4 w-4 text-blue-600" /> Analytics
          </button>
          <PageFilters fields={customerFilterFields} values={customerFilterValues} onApply={applyCustomerFilters} onClear={() => applyCustomerFilters({})} />
          <button type="button" onClick={() => void handleDownloadReport()} className="inline-flex items-center gap-2 rounded-lg border border-[#E8EAF0] bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Download className="h-4 w-4" /> Download Report
          </button>
          <PermissionGate moduleName="customers" action="create">
            <button type="button" onClick={handleAddNew} className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1E293B]">
              <Plus className="h-4 w-4" /> New Customer
            </button>
          </PermissionGate>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Customer summary">
        {[
          { label: 'Total Customers', value: summary.total, icon: Users, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Active Customers', value: summary.active, icon: UserCheck, tone: 'bg-emerald-50 text-emerald-600' },
          { label: 'Inactive Customers', value: summary.inactive, icon: UserX, tone: 'bg-pink-50 text-pink-600' },
          { label: 'New Customers (This Month)', value: summary.newThisMonth, icon: CalendarDays, tone: 'bg-orange-50 text-orange-600' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="sales-summary-card flex items-center gap-3">
            <span className={`sales-summary-card-icon ${tone}`}><Icon /></span>
            <div className="min-w-0">
              <p className="sales-summary-card-value">{value}</p>
              <p className="sales-summary-card-label mt-0.5">{label}</p>
            </div>
          </article>
        ))}
      </section>

      {isAnalyticsOpen ? (
        <div className="flex flex-wrap items-center gap-5 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Customer overview</span>
          <span>Active share: {summary.total ? Math.round((summary.active / summary.total) * 100) : 0}%</span>
          <span>Inactive: {summary.inactive}</span>
          <span>Added this month: {summary.newThisMonth}</span>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-1">
            {[
              ['all', 'All Customers'],
              ['Active', 'Active'],
              ['Inactive', 'Inactive'],
              ['Cancelled', 'Cancelled'],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${statusFilter === value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search customers..." className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="sales-data-table w-full min-w-[1080px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Action', 'Customer ID', 'Customer Name', 'Created By', 'Contacts', 'Emails', 'Nature of Business', 'Status', 'Approval'].map((heading) => (
                  <th key={heading} className={`${tableCellClass} text-left text-xs font-semibold uppercase tracking-wider text-slate-500`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => <tr key={index}><td colSpan={9} className="px-6 py-4"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>)
              ) : customers.length > 0 ? (
                customers.map((customer) => (
                  <CustomerTableRow key={customer.id} customer={customer} onView={handleView} onActionMenu={handleActionMenu} />
                ))
              ) : (
                <tr><td colSpan={9} className="px-6 py-16 text-center text-sm text-slate-500">
                  <div className="flex flex-col items-center gap-2"><Building2 className="h-8 w-8 text-slate-300" /><p>No customers found.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Show</span>
            <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>10</option><option value={20}>20</option><option value={25}>25</option><option value={50}>50</option>
            </select>
            <span>entries</span><span className="ml-2">{summaryText}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous page" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-50" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
            <button type="button" aria-label="Next page" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-50" disabled={page === totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      {activeMenu ? createPortal(
        <div ref={actionMenuRef} data-customer-action-menu role="menu" className="fixed whitespace-nowrap rounded-lg border border-slate-100 bg-white py-1 shadow-lg" style={{ top: activeMenu.top, left: activeMenu.left, width: activeMenu.width }}>
          <PermissionGate moduleName="customers" action="edit">
            <button type="button" role="menuitem" onClick={() => { const customer = activeMenu.customer; setActiveMenu(null); handleEdit(customer) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] leading-4 text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5 shrink-0 text-emerald-600" />Edit</button>
          </PermissionGate>
          <PermissionGate moduleName="customers" action="delete">
            <button type="button" role="menuitem" onClick={() => { setPendingDeleteCustomer(activeMenu.customer); setActiveMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] leading-4 text-slate-700 hover:bg-slate-50"><Trash2 className="h-3.5 w-3.5 shrink-0 text-red-500" />Delete</button>
          </PermissionGate>
          <button type="button" role="menuitem" onClick={() => handleConvert('activity', activeMenu.customer)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] leading-4 text-slate-700 hover:bg-slate-50"><Activity className="h-3.5 w-3.5 shrink-0 text-slate-500" />Convert to Activity</button>
          <button type="button" role="menuitem" onClick={() => handleConvert('funnel', activeMenu.customer)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] leading-4 text-slate-700 hover:bg-slate-50"><Funnel className="h-3.5 w-3.5 shrink-0 text-slate-500" />Convert to Funnel</button>
          <button type="button" role="menuitem" onClick={() => handleConvert('quotation', activeMenu.customer)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] leading-4 text-slate-700 hover:bg-slate-50"><FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />Convert to Quotation</button>
        </div>,
        document.body,
      ) : null}

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
  const approval = customer.approval
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
    industry: customer.industry || '',
    accountManager: customer.assignedEmployees?.map((employee) => employee.employeeName).filter(Boolean).join(', ') || '',
    contacts: (customer.contacts || []).map((contact) => ({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
    })),
    approvalStatus: approval?.status || customer.approvalStatus || '',
    approvedBy: approval?.approvedBy || customer.approvedBy || '',
    approvedAt: approval?.approvedAt || customer.approvedAt || '',
    createdBy: customer.createdBy || '—',
    createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString().slice(0, 10) : '',
    notes: customer.notes || '',
    address: customer.billToAddress?.addressLine1 || '',
    location: customer.billToAddress?.city || customer.state || '',
    gst: customer.gstNumber || '',
  }
}

const CustomerTableRow = memo(function CustomerTableRow({
  customer,
  onView,
  onActionMenu,
}: {
  customer: Customer
  onView: (customer: Customer) => void
  onActionMenu: (customer: Customer, button: HTMLButtonElement) => void
}) {
  const approvalStatus = customer.approvalStatus.trim()
  const approvalTone = approvalStatus.toLowerCase() === 'approved'
    ? 'bg-emerald-50 text-emerald-700'
    : approvalStatus.toLowerCase() === 'rejected'
      ? 'bg-rose-50 text-rose-700'
      : approvalStatus.toLowerCase() === 'pending'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600'
  const contacts = customer.contacts.length
    ? customer.contacts.map(({ name, phone }) => `${name || '—'}${phone ? ` (${phone})` : ''}`)
    : [`${customer.contactName || '—'}${customer.phone ? ` (${customer.phone})` : ''}`]
  const emails = customer.contacts.map((contact) => contact.email).filter(Boolean)

  return (
    <tr className="border-b border-slate-100 bg-white transition-colors hover:bg-slate-50/70">
      <td className={`${tableCellClass} text-center`} data-customer-action-menu>
        <button type="button" onClick={(event) => onActionMenu(customer, event.currentTarget)} className="inline-flex rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label={`Actions for ${customer.companyName}`} aria-haspopup="menu">
          <MoreVertical className="h-5 w-5" />
        </button>
      </td>
      <td className={`${tableCellClass} whitespace-nowrap text-sm font-semibold`}>
        <button type="button" onClick={() => onView(customer)} className="text-blue-700 hover:underline">{customer.customerId || '—'}</button>
      </td>
      <td className={`${tableCellClass} min-w-[180px] text-sm font-medium text-slate-800`}>{customer.companyName}</td>
      <td className={`${tableCellClass} whitespace-nowrap text-sm text-slate-600`}>{customer.createdBy || '—'}</td>
      <td className={`${tableCellClass} min-w-[200px] text-sm text-slate-600`}>
        <div className="space-y-1">{contacts.map((contact, index) => <div key={`${customer.id}-contact-${index}`}>{contact}</div>)}</div>
      </td>
      <td className={`${tableCellClass} min-w-[180px] text-sm text-slate-600`}>
        <div className="space-y-1">{(emails.length ? emails : [customer.email]).map((email, index) => <div key={`${customer.id}-email-${index}`}>{email || '—'}</div>)}</div>
      </td>
      <td className={`${tableCellClass} whitespace-nowrap text-sm text-slate-600`}>{customer.industry || '—'}</td>
      <td className={tableCellClass}>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${customer.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : customer.status === 'Inactive' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
          {customer.status || '—'}
        </span>
      </td>
      <td className={`${tableCellClass} min-w-[170px]`}>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${approvalTone}`}>{approvalStatus || 'Not recorded'}</span>
        {(customer.approvedBy || customer.approvedAt) ? (
          <div className="mt-1 text-xs leading-5 text-slate-500">
            {customer.approvedBy ? <div>{customer.approvedBy}</div> : null}
            {customer.approvedAt ? <div>{formatApprovalDate(customer.approvedAt)}</div> : null}
          </div>
        ) : null}
      </td>
    </tr>
  )
})

function formatApprovalDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

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