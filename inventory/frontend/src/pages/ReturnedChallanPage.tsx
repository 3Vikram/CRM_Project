import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Download, Eye, FilePlus2, Pencil, Printer, RotateCcw, Trash2 } from 'lucide-react'
import { Toast } from '@/components/toast'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import { COMPANY_PROFILE } from '@/lib/companyProfile'

type ProductOption = {
  id: string
  productName: string
  description?: string
  hsnSac?: string
  price?: number
  gst?: string | number
  uom?: string
}

type CustomerOption = {
  id: string
  name: string
  contactPersons?: string[]
}

type SalesCustomerRecord = {
  _id: string
  companyName?: string
  customerName?: string
  contacts?: Array<{ name?: string }>
}

type ReturnedChallanItem = {
  productId: string
  productName: string
  description: string
  hsnSac: string
  quantity: number
  uom: string
  serialNumber: string
  unitPrice: number
  taxLabel: string
  taxRate?: number
}

type ReturnedChallan = {
  id: string
  rcNumber: string
  createdBy: string
  customerName: string
  contactPerson: string
  rcDate: string
  collectingPerson: 'Person' | 'Courier'
  collectingName: string
  termsOfDelivery: string
  purpose: string
  remarks: string
  status: 'Open' | 'Close'
  items: ReturnedChallanItem[]
}

type ItemForm = {
  key: string
  productId: string
  productName: string
  description: string
  hsnSac: string
  quantity: string
  uom: string
  serialNumber: string
  unitPrice: string
  taxLabel: string
}

type FormValues = {
  customerName: string
  contactPerson: string
  rcDate: string
  collectingPerson: 'Person' | 'Courier'
  collectingName: string
  termsOfDelivery: string
  purpose: string
  remarks: string
  status: 'Open' | 'Close'
}

const API_URL = import.meta.env.VITE_API_URL || ''
const SALES_API_URL = '/api'

const getSalesAuthHeaders = (): Record<string, string> => {
  for (const key of ['synov_employee_auth', 'synov_admin_auth']) {
    const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key)
    if (!value) continue

    try {
      const auth = JSON.parse(value) as { token?: string }
      if (auth.token) return { Authorization: `Bearer ${auth.token}` }
    } catch {
      // Ignore malformed auth data, as the Sales auth helper does.
    }
  }

  return {}
}

const makeKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const newItem = (): ItemForm => ({
  key: makeKey(),
  productId: '',
  productName: '',
  description: '',
  hsnSac: '',
  quantity: '',
  uom: '',
  serialNumber: '',
  unitPrice: '',
  taxLabel: '',
})
const newForm = (): FormValues => ({
  customerName: '',
  contactPerson: '',
  rcDate: today(),
  collectingPerson: 'Person',
  collectingName: '',
  termsOfDelivery: '',
  purpose: '',
  remarks: '',
  status: 'Open',
})
const dateDisplay = (value: string) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const inputClass =
  'w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]'

export default function ReturnedChallanPage() {
  const [records, setRecords] = useState<ReturnedChallan[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerLoadStatus, setCustomerLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [mode, setMode] = useState<'dashboard' | 'form' | 'document'>('dashboard')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<ReturnedChallan | null>(null)
  const [form, setForm] = useState<FormValues>(newForm)
  const [contactPersonAutoFilled, setContactPersonAutoFilled] = useState(false)
  const [items, setItems] = useState<ItemForm[]>([newItem()])
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')
  const documentRef = useRef<HTMLElement | null>(null)
  const pageSize = 10

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastType(type)
    setToastMessage(message)
  }

  const loadRecords = async () => {
    const response = await fetch(`${API_URL}/api/returned-challans`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Unable to load returned challans')
    if (!Array.isArray(data)) throw new Error('Invalid returned challan response')
    setRecords(data as ReturnedChallan[])
  }

  useEffect(() => {
    let cancelled = false
    const loadInitialData = async () => {
      try {
        const [recordsResponse, productsResponse] = await Promise.all([
          fetch(`${API_URL}/api/returned-challans`),
          fetch(`${API_URL}/api/products`),
        ])
        const [recordsData, productsData] = await Promise.all([
          recordsResponse.json().catch(() => ({})),
          productsResponse.json().catch(() => ({})),
        ])
        if (!recordsResponse.ok) throw new Error(recordsData.error || 'Unable to load returned challans')
        if (!productsResponse.ok) throw new Error(productsData.error || 'Unable to load products')
        if (!Array.isArray(recordsData) || !Array.isArray(productsData)) {
          throw new Error('The server returned invalid Returned Challan data')
        }
        if (cancelled) return
        setRecords(recordsData)
        setProducts(productsData)

        const salesCustomers: CustomerOption[] = []
        let currentPage = 1
        let totalPages = 1
        do {
          const response = await fetch(`${SALES_API_URL}/customers?page=${currentPage}&limit=100`, {
            headers: getSalesAuthHeaders(),
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok || result.success !== true || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Unable to load customers from Sales')
          }

          salesCustomers.push(...result.data
            .filter((customer: SalesCustomerRecord) => customer?._id)
            .map((customer: SalesCustomerRecord) => ({
              id: customer._id,
              name: customer.companyName || customer.customerName || 'Untitled Customer',
              contactPersons: (customer.contacts || [])
                .map((contact) => contact.name?.trim())
                .filter((name): name is string => Boolean(name)),
            })))
          totalPages = Number(result.pagination?.totalPages) || 1
          currentPage += 1
        } while (currentPage <= totalPages)

        if (cancelled) return
        setCustomers(salesCustomers)
        setCustomerLoadStatus('loaded')
      } catch (error) {
        if (!cancelled) {
          setCustomerLoadStatus('error')
          notify(error instanceof Error ? error.message : 'Unable to load Returned Challan data', 'error')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadInitialData()
    return () => {
      cancelled = true
    }
  }, [])

  const taxOptions = useMemo(
    () => [...new Set(products.map((product) => String(product.gst || '').trim()).filter(Boolean))].sort(),
    [products]
  )
  const customerContacts = customers.find((customer) => customer.name === form.customerName)?.contactPersons || []

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const dateMatch = !dateFilter || String(record.rcDate).slice(0, 10) === dateFilter
      const statusMatch = !statusFilter || record.status === statusFilter
      return dateMatch && statusMatch
    })
  }, [records, dateFilter, statusFilter])
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const visibleRecords = filteredRecords.slice(page * pageSize, (page + 1) * pageSize)
  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1))
  }, [page, pageCount])

  const beginNew = () => {
    setEditingId(null)
    setForm(newForm())
    setContactPersonAutoFilled(false)
    setItems([newItem()])
    setMode('form')
  }

  const resetForm = () => {
    setForm(newForm())
    setContactPersonAutoFilled(false)
    setItems([newItem()])
  }

  const updateItem = (key: string, field: keyof ItemForm, value: string) => {
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item
        if (field !== 'productId') return { ...item, [field]: value }
        const selected = products.find((product) => product.id === value)
        if (!selected) return { ...newItem(), key }
        return {
          ...item,
          productId: value,
          productName: selected.productName || '',
          description: selected.description || '',
          hsnSac: selected.hsnSac || '',
          uom: selected.uom || '',
          unitPrice: selected.price == null ? '' : String(selected.price),
          taxLabel: selected.gst == null ? '' : String(selected.gst),
        }
      })
    )
  }

  const openEdit = async (record: ReturnedChallan) => {
    try {
      const response = await fetch(`${API_URL}/api/returned-challans/${encodeURIComponent(record.id)}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to load returned challan')
      const saved = data as ReturnedChallan
      setEditingId(saved.id)
      setContactPersonAutoFilled(false)
      setForm({
        customerName: saved.customerName || '',
        contactPerson: saved.contactPerson || '',
        rcDate: String(saved.rcDate || '').slice(0, 10),
        collectingPerson: saved.collectingPerson,
        collectingName: saved.collectingName || '',
        termsOfDelivery: saved.termsOfDelivery || '',
        purpose: saved.purpose || '',
        remarks: saved.remarks || '',
        status: saved.status === 'Close' ? 'Close' : 'Open',
      })
      setItems(
        (saved.items || []).map((item) => ({
          key: makeKey(),
          productId: item.productId || '',
          productName: item.productName || '',
          description: item.description || '',
          hsnSac: item.hsnSac || '',
          quantity: String(item.quantity ?? ''),
          uom: item.uom || '',
          serialNumber: item.serialNumber || '',
          unitPrice: String(item.unitPrice ?? ''),
          taxLabel: item.taxLabel || '',
        }))
      )
      setMode('form')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load returned challan', 'error')
    }
  }

  const openView = async (record: ReturnedChallan) => {
    try {
      const response = await fetch(`${API_URL}/api/returned-challans/${encodeURIComponent(record.id)}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to load returned challan')
      setSelectedRecord(data as ReturnedChallan)
      setMode('document')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load returned challan', 'error')
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.customerName.trim()) return notify('Customer Name is required.', 'error')
    if (!form.rcDate) return notify('RC Date is required.', 'error')
    if (!form.collectingName.trim()) return notify(`${form.collectingPerson} name is required.`, 'error')
    if (!items.length || items.some((item) => !item.productId || !item.quantity || Number(item.quantity) <= 0)) {
      return notify('Select a product and enter a quantity greater than zero for every row.', 'error')
    }
    if (items.some((item) => !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0)) {
      return notify('Enter a valid non-negative unit price for every product.', 'error')
    }
    const payload = {
      ...form,
      items: items.map((item) => ({
        productId: item.productId,
        description: item.description,
        hsnSac: item.hsnSac,
        quantity: Number(item.quantity),
        uom: item.uom,
        serialNumber: item.serialNumber,
        unitPrice: Number(item.unitPrice),
        taxLabel: item.taxLabel,
      })),
    }
    try {
      setIsSaving(true)
      const response = await fetch(
        `${API_URL}/api/returned-challans${editingId ? `/${encodeURIComponent(editingId)}` : ''}`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to save returned challan')
      await loadRecords()
      notify(`Returned Challan ${data.rcNumber} saved successfully.`)
      setMode('dashboard')
      setEditingId(null)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to save returned challan', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteRecord = async (record: ReturnedChallan) => {
    if (!window.confirm(`Delete Returned Challan ${record.rcNumber}? This action cannot be undone.`)) return
    try {
      const response = await fetch(`${API_URL}/api/returned-challans/${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to delete returned challan')
      await loadRecords()
      notify(`Returned Challan ${record.rcNumber} deleted.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to delete returned challan', 'error')
    }
  }

  const downloadReport = async () => {
    try {
      await downloadExcelReport({
        fileName: 'Returned_Challan_Report.xlsx',
        sheetName: 'Returned Challans',
        headers: ['RC No', 'Created By', 'Customer Name', 'Contact Person', 'Product', 'RC Type', 'RC Date', 'Status'],
        rows: filteredRecords.map((record) => [
          record.rcNumber,
          record.createdBy,
          record.customerName,
          record.contactPerson,
          record.items.map((item) => item.productName).join(', '),
          record.collectingPerson,
          new Date(record.rcDate),
          record.status,
        ]),
        textColumns: [0],
        dateColumns: [6],
        wrapColumns: [2, 3, 4],
      })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to download Returned Challan report', 'error')
    }
  }

  const downloadPdf = async () => {
    if (!documentRef.current || !selectedRecord) return
    try {
      setIsDownloading(true)
      const html2pdf = (await import('html2pdf.js')).default
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `${selectedRecord.rcNumber}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(documentRef.current)
        .save()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to download Returned Challan PDF', 'error')
    } finally {
      setIsDownloading(false)
    }
  }

  const dashboard = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 font-serif text-4xl font-bold text-gray-900">Returned Challan</h1>
        </div>
        <button type="button" onClick={beginNew} className="inline-flex items-center gap-2 rounded-xl bg-[#06283D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0B3A53]">
          <FilePlus2 className="h-4 w-4" /> Generate New
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E7E3DA] bg-white p-4 shadow-sm">
        <label className="w-full text-sm font-medium text-gray-700 sm:w-56">
          RC Date
          <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(0) }} className={`${inputClass} mt-2`} />
        </label>
        <label className="w-full text-sm font-medium text-gray-700 sm:w-56">
          Status
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0) }} className={`${inputClass} mt-2`}>
            <option value="">All Statuses</option><option value="Open">Open</option><option value="Close">Close</option>
          </select>
        </label>
        <button type="button" onClick={() => void downloadReport()} className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F33] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#06283D]">
          <Download className="h-4 w-4" /> Download Report
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E7E3DA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full">
            <thead><tr className="border-b border-[#0B1F33] bg-[#0B1F33]">
              {['RC No', 'Created By', 'Customer Name', 'Contact Person', 'Product', 'RC Type', 'RC Date', 'Status', 'Action'].map((heading) => (
                <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">{heading}</th>
              ))}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">Loading returned challans…</td></tr> :
                visibleRecords.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">No returned challans found.</td></tr> :
                  visibleRecords.map((record) => (
                    <tr key={record.id} className="border-b border-[#F3EFE8] last:border-0 hover:bg-[#FAF8F4]">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{record.rcNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.createdBy || 'System'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.contactPerson || '—'}</td>
                      <td className="max-w-[220px] px-4 py-3 text-sm text-gray-700">{record.items.map((item) => item.productName).join(', ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.collectingPerson}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{dateDisplay(record.rcDate)}</td>
                      <td className="px-4 py-3 text-sm"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === 'Open' ? 'bg-amber-100 text-amber-800' : record.status === 'Close' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{record.status || '—'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => void openView(record)} title="View" className="rounded-lg border border-[#D9D3C7] p-2 text-gray-700 hover:bg-[#F7F5F0]"><Eye className="h-4 w-4" /></button>
                          <button type="button" onClick={() => void openEdit(record)} title="Edit" className="rounded-lg border border-[#D9D3C7] p-2 text-gray-700 hover:bg-[#F7F5F0]"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => void deleteRecord(record)} title="Delete" className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EBE6DF] px-4 py-3 text-sm text-gray-600">
          <span>{filteredRecords.length ? `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filteredRecords.length)} of ${filteredRecords.length}` : '0 records'}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-lg border border-[#D9D3C7] px-3 py-1.5 disabled:opacity-40">Previous</button>
            <span>Page {page + 1} of {pageCount}</span>
            <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} className="rounded-lg border border-[#D9D3C7] px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  )

  const formPage = (
    <form onSubmit={(event) => void submit(event)} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Returned Challan</p>
          <h1 className="font-serif text-4xl font-bold text-gray-900">{editingId ? 'Edit Returned Challan' : 'Generate Returned Challan'}</h1>
        </div>
        <button type="button" onClick={() => { setMode('dashboard'); setEditingId(null) }} className="inline-flex items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#F7F5F0]"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</button>
      </div>

      <section className="rounded-2xl border border-[#E7E3DA] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gray-600">Main Details</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">Customer Name <span className="text-red-500">*</span>
            <select required value={customers.find((customer) => customer.name === form.customerName)?.id || ''} onChange={(event) => {
              const selectedCustomer = customers.find((customer) => customer.id === event.target.value)
              const contactPerson = selectedCustomer?.contactPersons?.[0] || ''
              setContactPersonAutoFilled(Boolean(contactPerson))
              setForm((current) => ({
                ...current,
                customerName: selectedCustomer?.name || '',
                contactPerson,
              }))
            }} className={`${inputClass} mt-2`}>
              <option value="">Select customer</option>
              {customerLoadStatus === 'loading' && <option disabled>Loading customers…</option>}
              {customerLoadStatus === 'error' && <option disabled>Unable to load customers</option>}
              {customerLoadStatus === 'loaded' && customers.length === 0 && <option disabled>No customers available</option>}
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Contact Person
            <select disabled={contactPersonAutoFilled} value={form.contactPerson} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} className={`${inputClass} mt-2`}>
              <option value="">Select contact person</option>
              {[...new Set([...customerContacts, ...(form.contactPerson ? [form.contactPerson] : [])])].map((contact) => <option key={contact} value={contact}>{contact}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">RC Date <span className="text-red-500">*</span>
            <input required type="date" value={form.rcDate} onChange={(event) => setForm((current) => ({ ...current, rcDate: event.target.value }))} className={`${inputClass} mt-2`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Collecting Person <span className="text-red-500">*</span>
            <select value={form.collectingPerson} onChange={(event) => setForm((current) => ({ ...current, collectingPerson: event.target.value as FormValues['collectingPerson'], collectingName: '' }))} className={`${inputClass} mt-2`}>
              <option value="Person">Person</option><option value="Courier">Courier</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">{form.collectingPerson} <span className="text-red-500">*</span>
            <input required value={form.collectingName} onChange={(event) => setForm((current) => ({ ...current, collectingName: event.target.value }))} placeholder={form.collectingPerson === 'Person' ? 'Enter Person Name' : 'Enter Courier Name'} className={`${inputClass} mt-2`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Status
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FormValues['status'] }))} className={`${inputClass} mt-2`}>
              <option value="Open">Open</option><option value="Close">Close</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E7E3DA] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-600">Product Details</h2>
          <button type="button" onClick={() => setItems((current) => [...current, newItem()])} aria-label="Add product row" className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-xl font-bold text-white shadow-sm hover:bg-green-700">+</button>
        </div>
        <div className="space-y-4">
          {items.map((item, index) => {
            const availableTaxes = [...new Set([...taxOptions, ...(item.taxLabel ? [item.taxLabel] : [])])]
            return (
              <div key={item.key} className="rounded-xl border border-[#EEE9E2] bg-[#F9F7F3] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Product {index + 1}</span>
                  {items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="text-sm font-medium text-gray-700">Product <span className="text-red-500">*</span>
                    <select required value={item.productId} onChange={(event) => updateItem(item.key, 'productId', event.target.value)} className={`${inputClass} mt-2`}>
                      <option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.productName}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">Description
                    <input value={item.description} onChange={(event) => updateItem(item.key, 'description', event.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Quantity <span className="text-red-500">*</span>
                    <input required min="0.01" step="any" type="number" value={item.quantity} onChange={(event) => updateItem(item.key, 'quantity', event.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Serial No
                    <input value={item.serialNumber} onChange={(event) => updateItem(item.key, 'serialNumber', event.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Unit Price
                    <input min="0" step="any" type="number" value={item.unitPrice} onChange={(event) => updateItem(item.key, 'unitPrice', event.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Tax
                    <select value={item.taxLabel} onChange={(event) => updateItem(item.key, 'taxLabel', event.target.value)} className={`${inputClass} mt-2`}>
                      <option value="">Select product tax</option>{availableTaxes.map((tax) => <option key={tax} value={tax}>{tax}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E7E3DA] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gray-600">Additional Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">Terms of Delivery
            <textarea rows={3} value={form.termsOfDelivery} onChange={(event) => setForm((current) => ({ ...current, termsOfDelivery: event.target.value }))} className={`${inputClass} mt-2`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Purpose
            <input value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} className={`${inputClass} mt-2`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Remarks
            <input value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} className={`${inputClass} mt-2`} />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#F7F5F0]"><RotateCcw className="h-4 w-4" /> Reset</button>
        <button disabled={isSaving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#06283D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3A53] disabled:opacity-60">{isSaving ? 'Saving…' : 'Submit'}</button>
      </div>
    </form>
  )

  const documentPage = selectedRecord ? (
    <div className="space-y-5">
      <div className="rc-controls flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setMode('dashboard')} className="inline-flex items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#F7F5F0]"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</button>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"><Printer className="h-4 w-4" /> Print</button>
          <button disabled={isDownloading} type="button" onClick={() => void downloadPdf()} className="inline-flex items-center gap-2 rounded-xl bg-[#06283D] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Download className="h-4 w-4" /> {isDownloading ? 'Preparing…' : 'Download PDF'}</button>
        </div>
      </div>
      <style>{`
        .rc-document { width: 100%; max-width: 190mm; margin: auto; padding: 7mm; background: #fff; color: #17212b; font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; line-height: 1.35; }
        .rc-document * { box-sizing: border-box; }
        .rc-header { position: relative; min-height: 24mm; padding: 0 24mm 3mm; border-bottom: 1px solid #333; text-align: center; }
        .rc-title { margin: 0 0 1mm; font-size: 18px; font-weight: 700; }
        .rc-logo { position: absolute; top: 0; right: 0; width: 20mm; height: 20mm; object-fit: contain; }
        .rc-company { font-size: 12.5px; font-weight: 700; }
        .rc-company-address { margin: 0.5mm auto; max-width: 125mm; font-size: 9.5px; }
        .rc-header > div:last-child { font-size: 9.5px; }
        .rc-details { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 3mm; border-top: 1px solid #333; border-left: 1px solid #333; }
        .rc-field { min-height: 9mm; padding: 1mm 1.5mm; border-right: 1px solid #333; border-bottom: 1px solid #333; overflow-wrap: anywhere; font-size: 9.5px; }
        .rc-field-label { display: block; margin-bottom: 0.5mm; font-size: 8.5px; font-weight: 700; text-transform: uppercase; }
        .rc-parties { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 3mm; }
        .rc-party { min-height: 23mm; padding: 1.5mm; border: 1px solid #333; border-right: 0; overflow-wrap: anywhere; font-size: 9px; }
        .rc-party:last-child { border-right: 1px solid #333; }
        .rc-party h2 { margin: 0 0 1mm; padding-bottom: 0.5mm; border-bottom: 1px solid #777; font-size: 9.5px; }
        .rc-party p { margin: 0 0 0.5mm; }
        .rc-items { width: 100%; margin-top: 3mm; border-collapse: collapse; table-layout: fixed; }
        .rc-items th, .rc-items td { padding: 1mm; border: 1px solid #333; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; font-size: 9px !important; line-height: 1.3; }
        .rc-items th { background: #f1f1f1; font-size: 9px !important; }
        .rc-items th:nth-child(1) { width: 7%; }
        .rc-items th:nth-child(2) { width: 20%; }
        .rc-items th:nth-child(3) { width: 28%; }
        .rc-items th:nth-child(4) { width: 14%; }
        .rc-items th:nth-child(5) { width: 8%; }
        .rc-items th:nth-child(6) { width: 23%; }
        .rc-terms { width: 100%; margin-top: 2mm; padding: 1.5mm; border: 1px solid #333; line-height: 1.35; font-size: 9.5px; overflow-wrap: anywhere; }
        .rc-terms-title { margin: 0 0 1mm; font-size: 10px; font-weight: 700; }
        .rc-terms-list { display: block; list-style-type: decimal; list-style-position: outside; margin: 0; padding-left: 5mm; }
        .rc-terms-list li { display: list-item; margin: 0 0 1.2mm; padding-left: 0.5mm; break-inside: avoid; page-break-inside: avoid; }
        .rc-terms-list li:last-child { margin-bottom: 0; }
        .rc-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 3mm; page-break-inside: avoid; }
        .rc-signature { min-height: 20mm; padding: 1.5mm; border: 1px solid #333; display: flex; flex-direction: column; justify-content: space-between; font-size: 9.5px; }
        .rc-signature span { align-self: flex-end; }
        .rc-generated { margin: 2mm 0 0; text-align: center; font-size: 8px; }
        @media print {
          @page { size: A4; margin: 8mm 10mm; }
          html, body, #root { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .rc-document, .rc-document * { visibility: visible !important; }
          .rc-controls { display: none !important; }
          .rc-document { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          .rc-title { font-size: 24px !important; margin-bottom: 0.5mm !important; }
          .rc-company { font-size: 15px !important; }
          .rc-company-address, .rc-header > div:last-child { font-size: 12px !important; }
          .rc-header { min-height: 22mm !important; padding-bottom: 2mm !important; }
          .rc-details { margin-top: 2mm !important; }
          .rc-field { min-height: 8mm !important; padding: 0.75mm 1mm !important; font-size: 12px !important; }
          .rc-field-label { margin-bottom: 0.25mm !important; font-size: 10.5px !important; }
          .rc-parties { margin-top: 2mm !important; }
          .rc-party { min-height: 21mm !important; padding: 1mm !important; font-size: 11.5px !important; }
          .rc-party h2 { margin-bottom: 0.5mm !important; padding-bottom: 0.25mm !important; font-size: 11px !important; }
          .rc-party p { margin-bottom: 0.25mm !important; }
          .rc-items { margin-top: 2mm !important; }
          .rc-items th { padding: 1mm !important; font-size: 11px !important; }
          .rc-items td { padding: 1mm !important; font-size: 12px !important; line-height: 1.3 !important; }
          .rc-terms { margin-top: 1.5mm !important; padding: 1.25mm !important; font-size: 11.5px !important; line-height: 1.35 !important; }
          .rc-terms-title { margin-bottom: 0.75mm !important; font-size: 12px !important; }
          .rc-terms-list { padding-left: 4mm !important; }
          .rc-terms-list li { margin-bottom: 1mm !important; padding-left: 0 !important; }
          .rc-signatures { gap: 4mm !important; margin-top: 2mm !important; }
          .rc-signature { min-height: 18mm !important; padding: 1mm !important; font-size: 11.5px !important; }
          .rc-generated { margin-top: 1.5mm !important; font-size: 10px !important; }
          .rc-items th:nth-child(1) { width: 7% !important; }
          .rc-items th:nth-child(2) { width: 23% !important; }
          .rc-items th:nth-child(3) { width: 34% !important; }
          .rc-items th:nth-child(4) { width: 10% !important; }
          .rc-items th:nth-child(5) { width: 26% !important; }
          .rc-items thead { display: table-header-group; }
          .rc-items tr, .rc-party, .rc-terms, .rc-signatures { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <article ref={documentRef} className="rc-document rounded-xl border border-[#E7E3DA] bg-white shadow-sm">
        <header className="rc-header">
          <h1 className="rc-title">Returned Challan</h1>
          <img src={COMPANY_PROFILE.logoUrl} alt={`${COMPANY_PROFILE.name} logo`} className="rc-logo" />
          <div className="rc-company">{COMPANY_PROFILE.name}</div>
          <div className="rc-company-address">{COMPANY_PROFILE.address}</div>
          <div>GST No: {COMPANY_PROFILE.gstNumber}</div>
        </header>
        <section className="rc-details" aria-label="Returned Challan details">
          {[
            ['RC No', selectedRecord.rcNumber],
            ['RC Date', dateDisplay(selectedRecord.rcDate)],
            ['Customer Name', selectedRecord.customerName],
            ['Contact Person', selectedRecord.contactPerson || '—'],
            ['RC By', selectedRecord.collectingName],
            ['Person Name', selectedRecord.collectingPerson === 'Person' ? selectedRecord.collectingName : '—'],
            ['Courier', selectedRecord.collectingPerson === 'Courier' ? selectedRecord.collectingName : '—'],
            ['Purpose', selectedRecord.purpose || '—'],
            ['Remarks', selectedRecord.remarks || '—'],
          ].map(([label, value]) => (
            <div className="rc-field" key={label}>
              <span className="rc-field-label">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </section>
        <section className="rc-parties" aria-label="Returned Challan parties">
          <div className="rc-party">
            <h2>RC By</h2>
            <p><strong>{selectedRecord.customerName}</strong></p>
            <p>Contact Person: {selectedRecord.contactPerson || '—'}</p>
          </div>
          <div className="rc-party">
            <h2>Bill To</h2>
            <p><strong>{COMPANY_PROFILE.name}</strong></p>
            <p>{COMPANY_PROFILE.address}</p>
            <p>GST No: {COMPANY_PROFILE.gstNumber}</p>
          </div>
          <div className="rc-party">
            <h2>RC For</h2>
            <p><strong>{selectedRecord.customerName}</strong></p>
            <p>Contact Person: {selectedRecord.contactPerson || '—'}</p>
            <p>{selectedRecord.collectingPerson}: {selectedRecord.collectingName}</p>
          </div>
        </section>
        <table className="rc-items">
          <thead><tr>{['Sl. No.', 'Product', 'Description', 'Qty', 'Serial No.'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>{selectedRecord.items.map((item, index) => <tr key={`${item.productId}-${index}`}>
            <td>{index + 1}</td><td>{item.productName}</td><td>{item.description || '—'}</td>
            <td>{item.quantity}</td><td>{item.serialNumber || '—'}</td>
          </tr>)}</tbody>
        </table>
        <section className="rc-terms">
          <h2 className="rc-terms-title">Terms &amp; Conditions</h2>
          <ol className="rc-terms-list">
            <li>Any damage / loss / Dent / Scratches etc or any other problem caused to the above product will be will be billed to partner. Synov IT Services Pvt Ltd decision on these matters will be final.</li>
            <li>Courier charges will be borne by the client if the pickup and delivery location is outside Bengaluru.</li>
            <li>Demo material must be returned within the agreed demo duration, which shall not exceed 7 days. Any delay beyond this period, without written approval from Synov IT Services Pvt Ltd, will result in the material being billed at its DC value. The partner agrees to make payment for the same within 7 days from the date of invoice.</li>
          </ol>
        </section>
        <div className="rc-signatures">
          <section className="rc-signature"><strong>For {COMPANY_PROFILE.name}</strong><span>Authorized Signature</span></section>
          <section className="rc-signature"><strong>For {selectedRecord.customerName}</strong><span>Authorized Signature</span></section>
        </div>
        <p className="rc-generated">* This is an electronically generated document, signature not required.</p>
      </article>
    </div>
  ) : null

  return (
    <div>
      {mode === 'dashboard' ? dashboard : mode === 'form' ? formPage : documentPage}
      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />}
    </div>
  )
}
