'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Plus, Save, Trash2, RotateCcw, User, Package, Eye, Pencil } from 'lucide-react'
import { Toast } from '@/components/toast'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import DeliveryChallanPreview, { type DeliveryChallanDocument } from './DeliveryChallanPreview'

type ProductOption = {
  id: string
  productName: string
  description: string
  price: number
  gst: string | number
  hsnSac?: string
}

type CustomerOption = {
  id: string
  name: string
  contact?: string
}

type ProductRow = {
  id: string
  productId: string
  productName: string
  description: string
  serialNumber: string
  hsnSac: string
  quantity: string
  uom: string
  unitPrice: string
  tax: string
  isFromOpf: boolean
}

type DeliveryChallanForm = {
  opfNo: string
  customerName: string
  contactPerson: string
  poNo: string
  poDate: string
  accountManager: string
  despatchDocumentNo: string
  dcType: string
  validityInDays: string
  deliveryInDays: string
  expectedClosure: string
  currency: string
  dispatchedThrough: string
  destination: string
  returnDate: string
  deliveryNote: string
  status: string
}

type DashboardRow = {
  id: string
  dcNo: string
  createdBy: string
  customerName: string
  contactPerson: string
  product: string
  dcDate: string
  status: string
}

type DeliveryChallanRecord = {
  id?: string
  _id?: string
  challanNumber?: string
  createdBy?: string
  customerName?: string
  contactPerson?: string
  status?: string
  createdAt?: string
  opfNo?: string
  accountManager?: string
  poNo?: string
  poDate?: string
  despatchDocumentNo?: string
  dcType?: string
  validityInDays?: number | null
  deliveryInDays?: number | null
  expectedClosure?: string
  currency?: string
  dispatchedThrough?: string
  destination?: string
  returnDate?: string
  deliveryNote?: string
  items?: Array<{
    productId?: string
    productName?: string
    description?: string
    hsnSac?: string
    quantity?: number
    uom?: string
    unitPrice?: number
    tax?: number
  }>
}

type SalesOPFRecord = {
  _id: string
  opfNo?: string
}

type SalesOPFDetails = SalesOPFRecord & {
  customerName?: string
  contactPerson?: string
  customerPONo?: string
  customerPODate?: string
  product?: string
  description?: string
  quantity?: number | string
  unitPrice?: number | string
  tax?: string
  serialNumber?: string
  products?: Array<{
    product?: string
    productName?: string
    description?: string
    productDescription?: string
    serialNumber?: string
    quantity?: number | string
    unitPrice?: number | string
    tax?: string | number
  }>
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
      // Ignore malformed Sales auth data, matching the Sales auth helper.
    }
  }

  return {}
}

const makeRowId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const createEmptyRow = (): ProductRow => ({
  id: makeRowId(),
  productId: '',
  productName: '',
  description: '',
  serialNumber: '',
  hsnSac: '',
  quantity: '',
  uom: '',
  unitPrice: '',
  tax: '',
  isFromOpf: false,
})

const emptyForm = (): DeliveryChallanForm => ({
  opfNo: '',
  customerName: '',
  contactPerson: '',
  accountManager: '',
  poNo: '',
  poDate: '',
  despatchDocumentNo: '',
  dcType: '',
  validityInDays: '',
  deliveryInDays: '',
  expectedClosure: '',
  currency: '',
  dispatchedThrough: '',
  destination: '',
  returnDate: '',
  deliveryNote: '',
  status: 'Open',
})

const mapChallanToDashboardRow = (challan: DeliveryChallanRecord): DashboardRow => ({
  id: String(challan.id || challan._id || ''),
  dcNo: challan.challanNumber || '—',
  createdBy: challan.createdBy || '—',
  customerName: challan.customerName || '—',
  contactPerson: challan.contactPerson || '—',
  product: (Array.isArray(challan.items) ? challan.items : [])
    .map((item: { productName?: string }) => item.productName)
    .filter(Boolean)
    .join(', ') || '—',
  dcDate: challan.createdAt ? new Date(challan.createdAt).toISOString().slice(0, 10) : '—',
  status: challan.status || '—',
})

export default function DCTrackingPage() {
  const opfFetchSequence = useRef(0)
  const [opfOptions, setOpfOptions] = useState<SalesOPFRecord[]>([])
  const [opfLoadStatus, setOpfLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [opfCustomerNameLocked, setOpfCustomerNameLocked] = useState(false)
  const [opfContactPersonLocked, setOpfContactPersonLocked] = useState(false)
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [rows, setRows] = useState<ProductRow[]>([createEmptyRow()])
  const [dcRows, setDcRows] = useState<DashboardRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDcId, setEditingDcId] = useState<string | null>(null)
  const [form, setForm] = useState<DeliveryChallanForm>(emptyForm)
  const [dispatchName, setDispatchName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [previewChallan, setPreviewChallan] = useState<DeliveryChallanDocument | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  useEffect(() => {
    const fetchOPFs = async () => {
      try {
        const records: SalesOPFRecord[] = []
        let page = 1
        let totalPages = 1

        do {
          const response = await fetch(`${SALES_API_URL}/opf?page=${page}&limit=100`, {
            headers: getSalesAuthHeaders(),
          })
          const result = await response.json()
          if (!response.ok || result.success !== true || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Unable to fetch OPF numbers from Sales')
          }

          records.push(...result.data.filter(
            (record: SalesOPFRecord) => record?._id && record.opfNo
          ))
          totalPages = Number(result.pagination?.totalPages) || 1
          page += 1
        } while (page <= totalPages)

        setOpfOptions(records)
        setOpfLoadStatus('loaded')
      } catch (error) {
        console.error('Unable to fetch OPF numbers from Sales:', error)
        setOpfLoadStatus('error')
        setToastType('error')
        setToastMessage(error instanceof Error ? error.message : 'Unable to fetch OPF numbers from Sales')
      }
    }

    const fetchDeliveryChallans = async () => {
      try {
        const response = await fetch(`${API_URL}/api/delivery-challans`)
        if (!response.ok) throw new Error('Unable to fetch delivery challans')
        const data = await response.json() as DeliveryChallanRecord[]
        if (!Array.isArray(data)) throw new Error('Invalid delivery challan response')
        setDcRows(data.map(mapChallanToDashboardRow))
      } catch (error) {
        setToastType('error')
        setToastMessage(error instanceof Error ? error.message : 'Unable to fetch delivery challans')
      } finally {
        setIsLoading(false)
      }
    }

    const fetchCustomerOptions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/delivery-challans/customers`)
        if (!response.ok) {
          throw new Error('Unable to fetch customer list')
        }
        const data = await response.json()
        setCustomerOptions(Array.isArray(data) ? data : [])
      } catch {
        setCustomerOptions([])
      }
    }

    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/api/products`)
        if (!response.ok) {
          throw new Error('Unable to fetch products')
        }
        const data = await response.json()
        setProductOptions(Array.isArray(data) ? data : [])
      } catch {
        setProductOptions([])
      }
    }

    void fetchOPFs()
    void fetchCustomerOptions()
    void fetchProducts()
    void fetchDeliveryChallans()
  }, [])

  const contactSuggestions = useMemo(() => {
    const matchedCustomer = customerOptions.find((customer) => customer.name === form.customerName)
    const specificSuggestions = matchedCustomer?.contact ? [matchedCustomer.contact] : []
    return specificSuggestions
  }, [customerOptions, form.customerName])

  const filteredRows = dcRows.filter((row) => {
    return !statusFilter || row.status === statusFilter
  })

  const downloadReport = async () => {
    try {
      await downloadExcelReport({
        fileName: 'Delivery_Challan_Report.xlsx',
        sheetName: 'Delivery Challans',
        headers: ['DC No', 'Created By', 'Customer Name', 'Contact Person', 'Product', 'DC Date', 'Status'],
        rows: filteredRows.map((row) => [
          row.dcNo,
          row.createdBy,
          row.customerName,
          row.contactPerson,
          row.product,
          row.dcDate === '—' ? '' : new Date(row.dcDate),
          row.status === '—' ? '' : row.status,
        ]),
        textColumns: [0],
        dateColumns: [5],
        wrapColumns: [2, 3, 4],
      })
    } catch (error) {
      setToastType('error')
      setToastMessage(error instanceof Error ? error.message : 'Unable to download delivery challan report')
    }
  }

  const updateFormValue = (field: keyof DeliveryChallanForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const renderTextField = (
    label: string,
    field: keyof DeliveryChallanForm,
    type: 'text' | 'date' | 'number' = 'text'
  ) => (
    <div key={field}>
      <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor={field}>
        {label}
      </label>
      <input
        id={field}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '1' : undefined}
        type={type}
        value={form[field]}
        onChange={(event) => updateFormValue(field, event.target.value)}
        className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
      />
    </div>
  )

  const updateRow = (id: string, field: keyof ProductRow, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row

        let nextRow = { ...row, [field]: value }

        if (field === 'productId') {
          const selectedProduct = productOptions.find((product) => product.id === value)
          if (selectedProduct) {
            nextRow = {
              ...nextRow,
              productName: selectedProduct.productName,
              description: selectedProduct.description || '',
              hsnSac: selectedProduct.hsnSac || '',
              unitPrice: String(selectedProduct.price || ''),
              tax: String(Number.parseFloat(String(selectedProduct.gst || '')) || ''),
            }
          } else {
            nextRow = {
              ...nextRow,
              productName: '',
              description: '',
              hsnSac: '',
              unitPrice: '',
              tax: '',
            }
          }
        }

        return nextRow
      })
    )
  }

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()])
  }

  const removeRow = (id: string) => {
    setRows((prev) => {
      if (prev.length === 1) {
        return [createEmptyRow()]
      }
      return prev.filter((row) => row.id !== id)
    })
  }

  const openPreview = async (row: DashboardRow) => {
    setIsPreviewLoading(true)
    setToastMessage('')
    try {
      const response = await fetch(`${API_URL}/api/delivery-challans/${encodeURIComponent(row.id)}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to load delivery challan')
      setPreviewChallan(data as DeliveryChallanDocument)
    } catch (error) {
      setToastType('error')
      setToastMessage(error instanceof Error ? error.message : 'Unable to load delivery challan')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const deleteChallan = async (row: DashboardRow) => {
    if (!window.confirm(`Delete delivery challan ${row.dcNo}? This action cannot be undone.`)) return
    try {
      const response = await fetch(`${API_URL}/api/delivery-challans/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to delete delivery challan')

      setDcRows((prev) => prev.filter((challan) => challan.id !== row.id))
      const listResponse = await fetch(`${API_URL}/api/delivery-challans`)
      const challans = await listResponse.json().catch(() => [])
      if (!listResponse.ok || !Array.isArray(challans)) {
        throw new Error('Delivery challan was deleted, but the dashboard could not be refreshed.')
      }
      setDcRows(challans.map(mapChallanToDashboardRow))
      setToastType('success')
      setToastMessage(`Delivery challan ${row.dcNo} deleted successfully.`)
    } catch (error) {
      setToastType('error')
      setToastMessage(error instanceof Error ? error.message : 'Unable to delete delivery challan')
    }
  }

  const resetForm = () => {
    setForm(emptyForm())
    setDispatchName('')
    setRows([createEmptyRow()])
    setEditingDcId(null)
    setOpfCustomerNameLocked(false)
    setOpfContactPersonLocked(false)
  }

  const openGenerateForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditForm = (row: DashboardRow) => {
    setEditingDcId(row.id)
    setDispatchName('')
    setOpfCustomerNameLocked(false)
    setOpfContactPersonLocked(false)
    setForm({
      ...emptyForm(),
      customerName: row.customerName === '—' ? '' : row.customerName,
      contactPerson: row.contactPerson === '—' ? '' : row.contactPerson,
      status: row.status,
    })
    void fetch(`${API_URL}/api/delivery-challans/${encodeURIComponent(row.id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load delivery challan')
        const challan = await response.json() as DeliveryChallanRecord
        setForm({
          opfNo: challan.opfNo || '',
          customerName: challan.customerName || '',
          contactPerson: challan.contactPerson || '',
          accountManager: challan.accountManager || '',
          poNo: challan.poNo || '',
          poDate: challan.poDate ? String(challan.poDate).slice(0, 10) : '',
          despatchDocumentNo: challan.despatchDocumentNo || '',
          dcType: challan.dcType || '',
          validityInDays: challan.validityInDays == null ? '' : String(challan.validityInDays),
          deliveryInDays: challan.deliveryInDays == null ? '' : String(challan.deliveryInDays),
          expectedClosure: challan.expectedClosure ? String(challan.expectedClosure).slice(0, 10) : '',
          currency: challan.currency || '',
          dispatchedThrough: challan.dispatchedThrough || '',
          destination: challan.destination || '',
          returnDate: challan.returnDate ? String(challan.returnDate).slice(0, 10) : '',
          deliveryNote: challan.deliveryNote || '',
          status: challan.status === 'Close' ? 'Close' : 'Open',
        })
        setRows(
          (Array.isArray(challan.items) ? challan.items : []).map((item) => ({
            id: makeRowId(),
            productId: item.productId || '',
            productName: item.productName || '',
            description: item.description || '',
            serialNumber: '',
            hsnSac: item.hsnSac || '',
            quantity: String(item.quantity ?? ''),
            uom: item.uom || '',
            unitPrice: String(item.unitPrice ?? ''),
            tax: String(item.tax ?? ''),
            isFromOpf: false,
          }))
        )
      })
      .catch((error) => {
        setToastType('error')
        setToastMessage(error instanceof Error ? error.message : 'Unable to load delivery challan')
      })
    setShowForm(true)
  }

  const handleOpfChange = async (opfId: string) => {
    const fetchSequence = ++opfFetchSequence.current
    const selectedOpf = opfOptions.find((opf) => opf._id === opfId)
    setForm((prev) => ({
      ...prev,
      opfNo: selectedOpf?.opfNo || opfId,
      customerName: '',
      contactPerson: '',
      poNo: '',
      poDate: '',
    }))
    setRows([createEmptyRow()])
    setOpfCustomerNameLocked(Boolean(opfId))
    setOpfContactPersonLocked(Boolean(opfId))
    if (!selectedOpf) return

    try {
      const response = await fetch(`${SALES_API_URL}/opf/${encodeURIComponent(selectedOpf._id)}`, {
        headers: getSalesAuthHeaders(),
      })
      const result = await response.json()
      if (!response.ok || result.success !== true || !result.data) {
        throw new Error(result.message || 'Unable to fetch the selected OPF details from Sales')
      }

      if (fetchSequence !== opfFetchSequence.current) return

      const opf = result.data as SalesOPFDetails
      const customerName = opf.customerName?.trim() || ''
      const contactPerson = opf.contactPerson?.trim() || ''
      setForm((prev) => ({
        ...prev,
        customerName,
        contactPerson,
        poNo: opf.customerPONo?.trim() || '',
        poDate: opf.customerPODate ? String(opf.customerPODate).slice(0, 10) : '',
      }))
      const opfProducts = Array.isArray(opf.products) && opf.products.length > 0
        ? opf.products
        : [opf]
      setRows(opfProducts.map((product) => {
        const productName = (product.productName || product.product || '').trim()
        const taxValue = String(product.tax || '').match(/\d+(?:\.\d+)?/)?.[0] || ''
        return {
          ...createEmptyRow(),
          productId: productOptions.find(
            (option) => option.productName.trim().toLowerCase() === productName.toLowerCase()
          )?.id || '',
          productName,
          description: (product.description || product.productDescription || '').trim(),
          serialNumber: product.serialNumber?.trim() || '',
          quantity: product.quantity == null ? '' : String(product.quantity),
          unitPrice: product.unitPrice == null ? '' : String(product.unitPrice),
          tax: taxValue,
          isFromOpf: true,
        }
      }))

      if (!customerName || !contactPerson) {
        setToastType('info')
        setToastMessage('The selected OPF is missing customer or contact information.')
      }
    } catch (error) {
      if (fetchSequence !== opfFetchSequence.current) return
      console.error('Unable to fetch selected OPF details from Sales:', error)
      setToastType('error')
      setToastMessage(error instanceof Error ? error.message : 'Unable to fetch the selected OPF details from Sales')
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.customerName.trim()) {
      setToastType('error')
      setToastMessage('Customer name is required.')
      return
    }

    const validRows = rows.filter((row) => row.productId || row.productName.trim())
    if (!validRows.length) {
      setToastType('error')
      setToastMessage('Add at least one product row.')
      return
    }

    for (const row of validRows) {
      if (!row.productName.trim()) {
        setToastType('error')
        setToastMessage('Please select a product for each row.')
        return
      }
      if (!row.quantity || Number(row.quantity) <= 0) {
        setToastType('error')
        setToastMessage('Quantity must be greater than 0 for each product.')
        return
      }
    }

    try {
      setIsSubmitting(true)
      const payload = {
        opfNo: form.opfNo,
        customerName: form.customerName,
        contactPerson: form.contactPerson,
        accountManager: form.accountManager,
        poNo: form.poNo,
        poDate: form.poDate || null,
        despatchDocumentNo: form.despatchDocumentNo,
        dcType: form.dcType,
        validityInDays: form.validityInDays ? Number(form.validityInDays) : null,
        deliveryInDays: form.deliveryInDays ? Number(form.deliveryInDays) : null,
        expectedClosure: form.expectedClosure || null,
        currency: form.currency,
        dispatchedThrough: form.dispatchedThrough,
        destination: form.destination,
        returnDate: form.returnDate || null,
        deliveryNote: form.deliveryNote,
        status: form.status,
        items: validRows.map((row) => ({
          productId: row.productId,
          productName: row.productName,
          description: row.description,
          hsnSac: row.hsnSac,
          quantity: Number(row.quantity),
          uom: row.uom,
          unitPrice: Number(row.unitPrice || 0),
          tax: Number(row.tax || 0),
        })),
      }

      const response = await fetch(
        `${API_URL}/api/delivery-challans${editingDcId ? `/${encodeURIComponent(editingDcId)}` : ''}`,
        {
        method: editingDcId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        }
      )

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Unable to save delivery challan')
      }

      const savedRow = mapChallanToDashboardRow(data)

      setDcRows((prev) => {
        if (editingDcId) {
          return prev.map((row) => (row.id === editingDcId ? savedRow : row))
        }
        return [savedRow, ...prev]
      })

      setToastType('success')
      setToastMessage(`Delivery challan ${savedRow.dcNo} saved successfully.`)
      setShowForm(false)
      resetForm()
    } catch (error) {
      setToastType('error')
      setToastMessage(error instanceof Error ? error.message : 'Unable to save delivery challan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
            Delivery Challan
          </h1>
        </div>
        <button
          type="button"
          onClick={openGenerateForm}
          className="inline-flex items-center gap-2 rounded-xl bg-[#06283D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B3A53]"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E7E3DA] bg-white p-4 shadow-sm">
        <label className="w-full text-sm font-medium text-gray-700 sm:w-56">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
          >
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Close">Close</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void downloadReport()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F33] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#06283D]"
        >
          <Download className="h-4 w-4" />
          Download Report
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E7E3DA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#0B1F33] bg-[#0B1F33]">
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">DC No</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">Created By</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">Customer Name</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">Contact Person</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">Product</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">DC Date</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={8}>
                    Loading delivery challans...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={8}>
                    No delivery challans found.
                  </td>
                </tr>
              ) : filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-[#F3EFE8] last:border-b-0 hover:bg-[#FAF8F4]">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.dcNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.createdBy}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.customerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.contactPerson}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.product}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.dcDate}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.status === 'Open'
                        ? 'bg-amber-100 text-amber-800'
                        : row.status === 'Close'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openPreview(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D9D3C7] bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-[#F7F5F0]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D9D3C7] bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-[#F7F5F0]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteChallan(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderForm = () => (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="mb-0 text-3xl font-serif font-bold text-gray-900 sm:text-4xl">
            Delivery Challan
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(false)
            resetForm()
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-[#F7F5F0]"
        >
          <RotateCcw className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-[#E7E3DA] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-gray-600">
            <User className="h-4 w-4" />
            Delivery Challan Details
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="opfNo">
                OPF No
              </label>
              <select
                id="opfNo"
                value={opfOptions.find((opf) => opf.opfNo === form.opfNo)?._id || form.opfNo}
                onChange={(event) => void handleOpfChange(event.target.value)}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              >
                <option value="">Select OPF No</option>
                {form.opfNo && !opfOptions.some((opf) => opf.opfNo === form.opfNo) && (
                  <option value={form.opfNo}>{form.opfNo}</option>
                )}
                {opfOptions.map((opf) => (
                  <option key={opf._id} value={opf._id}>
                    {opf.opfNo}
                  </option>
                ))}
                {opfLoadStatus === 'loading' && <option disabled>Loading OPF numbers...</option>}
                {opfLoadStatus === 'loaded' && opfOptions.length === 0 && (
                  <option disabled>No OPF numbers available</option>
                )}
                {opfLoadStatus === 'error' && <option disabled>Unable to load OPF numbers</option>}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="customerName">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <select
                id="customerName"
                required
                disabled={Boolean(form.opfNo) || opfCustomerNameLocked}
                value={form.customerName}
                onChange={(event) => updateFormValue('customerName', event.target.value)}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              >
                <option value="">Select customer</option>
                {form.customerName && !customerOptions.some((customer) => customer.name === form.customerName) && (
                  <option value={form.customerName}>{form.customerName}</option>
                )}
                {customerOptions.map((customer) => (
                  <option key={customer.id || customer.name} value={customer.name}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="contactPerson">
                Contact Person
              </label>
              <input
                id="contactPerson"
                list="contact-person-options"
                disabled={Boolean(form.opfNo) || opfContactPersonLocked}
                value={form.contactPerson}
                onChange={(event) => updateFormValue('contactPerson', event.target.value)}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              />
              <datalist id="contact-person-options">
                {contactSuggestions.map((contact) => (
                  <option key={contact} value={contact} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="poNo">
                PO No
              </label>
              <input
                id="poNo"
                readOnly={Boolean(form.opfNo)}
                value={form.poNo}
                onChange={(event) => updateFormValue('poNo', event.target.value)}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="poDate">
                PO Closure Date
              </label>
              <input
                id="poDate"
                type="date"
                readOnly
                value={form.poDate}
                className="w-full rounded-xl border border-[#D9D3C7] bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="dcType">
                DC Type
              </label>
              <select
                id="dcType"
                value={form.dcType}
                onChange={(event) => updateFormValue('dcType', event.target.value)}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              >
                <option value="">Select DC Type</option>
                <option value="Returnable">Returnable</option>
                <option value="Non Returnable">Non Returnable</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="dispatchedThrough">
                Despatched Through
              </label>
              <select
                id="dispatchedThrough"
                value={form.dispatchedThrough}
                onChange={(event) => {
                  setDispatchName('')
                  updateFormValue('dispatchedThrough', event.target.value)
                }}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              >
                <option value="">Select Despatched Through</option>
                <option value="Person">Person</option>
                <option value="Courier">Courier</option>
              </select>
            </div>
            {form.dispatchedThrough && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="dispatchName">
                  {form.dispatchedThrough === 'Person' ? 'Person Name' : 'Courier Name'}
                </label>
                <input
                  id="dispatchName"
                  type="text"
                  value={dispatchName}
                  onChange={(event) => setDispatchName(event.target.value)}
                  className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                value={form.status}
                onChange={(event) => updateFormValue('status', event.target.value)}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              >
                <option value="Open">Open</option>
                <option value="Close">Close</option>
              </select>
            </div>
            <div className="sm:col-span-2 xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="deliveryNote">
                Delivery Note
              </label>
              <textarea
                id="deliveryNote"
                rows={3}
                value={form.deliveryNote}
                onChange={(event) => updateFormValue('deliveryNote', event.target.value)}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E3DA] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-gray-600">
              <Package className="h-4 w-4" />
              Product Details
            </div>
            <button
              type="button"
              onClick={addRow}
              aria-label="Add product row"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-white shadow-sm transition hover:bg-green-700"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {rows.map((row, index) => (
              <div key={row.id} className="rounded-xl border border-[#EEE9E2] bg-[#F9F7F3] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Product {index + 1}
                  </span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Product <span className="text-red-500">*</span>
                    </label>
                    {row.isFromOpf ? (
                      <input
                        value={row.productName}
                        onChange={(event) => updateRow(row.id, 'productName', event.target.value)}
                        className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
                      />
                    ) : (
                      <select
                        value={row.productId}
                        onChange={(event) => updateRow(row.id, 'productId', event.target.value)}
                        className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
                      >
                        <option value="">Select product</option>
                        {productOptions.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.productName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <input
                      value={row.description}
                      onChange={(event) => updateRow(row.id, 'description', event.target.value)}
                      placeholder="Description"
                      className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Serial Number
                    </label>
                    <input
                      value={row.serialNumber}
                      onChange={(event) => updateRow(row.id, 'serialNumber', event.target.value)}
                      placeholder="Serial Number"
                      className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.id, 'quantity', event.target.value)}
                      readOnly={row.isFromOpf}
                      placeholder="0"
                      className={`w-full rounded-xl border border-[#D9D3C7] px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 ${row.isFromOpf ? 'bg-gray-50' : 'bg-white focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]'}`}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Unit Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitPrice}
                      onChange={(event) => updateRow(row.id, 'unitPrice', event.target.value)}
                      readOnly={row.isFromOpf}
                      placeholder="0.00"
                      className={`w-full rounded-xl border border-[#D9D3C7] px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 ${row.isFromOpf ? 'bg-gray-50' : 'bg-white focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]'}`}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Tax
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.tax}
                      onChange={(event) => updateRow(row.id, 'tax', event.target.value)}
                      readOnly={row.isFromOpf}
                      placeholder="0"
                      className={`w-full rounded-xl border border-[#D9D3C7] px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 ${row.isFromOpf ? 'bg-gray-50' : 'bg-white focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]'}`}
                    />
                  </div>
                  <div className="flex items-end pb-0.5">
                    <button
                      type="button"
                      aria-label="Add another product row"
                      onClick={addRow}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm transition hover:bg-green-700"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-[#E7E3DA] bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-end">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-[#F7F5F0]"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#06283D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B3A53] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving...
                </span>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Submit
                </>
              )}
            </button>
          </div>
        </div>
      </form>

    </div>
  )

  return (
    <div className="space-y-6">
      {previewChallan ? (
        <DeliveryChallanPreview challan={previewChallan} onBack={() => setPreviewChallan(null)} />
      ) : showForm ? (
        renderForm()
      ) : (
        renderDashboard()
      )}
      {isPreviewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="status">
          <div className="rounded-xl bg-white px-5 py-4 text-sm font-medium text-gray-700 shadow-lg">
            Loading Delivery Challan...
          </div>
        </div>
      )}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          duration={3000}
          onClose={() => setToastMessage('')}
        />
      )}
    </div>
  )
}
