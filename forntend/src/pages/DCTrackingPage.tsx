'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2, RotateCcw, Truck, User, Package, FileText, Eye, Pencil } from 'lucide-react'
import { Toast } from '@/components/toast'

type ProductOption = {
  id: string
  productName: string
  description: string
  price: number
  gst: number
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
  quantity: string
  unitPrice: string
  tax: string
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const makeRowId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const createEmptyRow = (): ProductRow => ({
  id: makeRowId(),
  productId: '',
  productName: '',
  description: '',
  quantity: '',
  unitPrice: '',
  tax: '',
})

const customerContacts: Record<string, string[]> = {
  'Nimbus Analytics': ['Ritka Sharma'],
  'Coral Media Labs': ['Arjun Menon'],
  'Fernwood Studios': ['Priya Iyer'],
  'Orbit Consulting': ['Kabir Ahuja'],
  'Saffron Retail Group': ['Deepa Rao'],
  'Meridian Fintech': ['Rohan Kapoor'],
}

const dashboardSeed: DashboardRow[] = [
  {
    id: 'dc-1001',
    dcNo: 'DC-2025-1001',
    createdBy: 'Admin',
    customerName: 'Coral Media Labs',
    contactPerson: 'Arjun Menon',
    product: 'HP Z2 Workstation',
    dcDate: '2025-08-12',
    status: 'Pending',
  },
  {
    id: 'dc-1002',
    dcNo: 'DC-2025-1002',
    createdBy: 'Operations',
    customerName: 'Nimbus Analytics',
    contactPerson: 'Ritka Sharma',
    product: 'Dell OptiPlex 7010',
    dcDate: '2025-08-10',
    status: 'Dispatched',
  },
  {
    id: 'dc-1003',
    dcNo: 'DC-2025-1003',
    createdBy: 'Admin',
    customerName: 'Fernwood Studios',
    contactPerson: 'Priya Iyer',
    product: 'Apple iMac',
    dcDate: '2025-08-08',
    status: 'Delivered',
  },
]

export default function DCTrackingPage() {
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [rows, setRows] = useState<ProductRow[]>([createEmptyRow()])
  const [dcRows, setDcRows] = useState<DashboardRow[]>(dashboardSeed)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDcId, setEditingDcId] = useState<string | null>(null)
  const [form, setForm] = useState({
    customerName: '',
    contactPerson: '',
    deliveryNote: '',
    dispatchedThrough: '',
    destination: '',
    status: 'Pending',
    signatureRequired: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  useEffect(() => {
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

    void fetchCustomerOptions()
    void fetchProducts()
  }, [])

  const contactSuggestions = useMemo(() => {
    const matchedCustomer = customerOptions.find((customer) => customer.name === form.customerName)
    const specificSuggestions = matchedCustomer?.contact ? [matchedCustomer.contact] : []
    const configuredSuggestions = form.customerName ? customerContacts[form.customerName] || [] : []
    return Array.from(new Set([...specificSuggestions, ...configuredSuggestions]))
  }, [customerOptions, form.customerName])

  const filteredRows = dcRows.filter((row) => {
    const query = searchTerm.toLowerCase().trim()
    if (!query) return true

    return [
      row.dcNo,
      row.createdBy,
      row.customerName,
      row.contactPerson,
      row.product,
      row.status,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  const updateFormValue = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

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
              unitPrice: String(selectedProduct.price || ''),
              tax: String(selectedProduct.gst || ''),
            }
          } else {
            nextRow = {
              ...nextRow,
              productName: '',
              description: '',
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

  const resetForm = () => {
    setForm({
      customerName: '',
      contactPerson: '',
      deliveryNote: '',
      dispatchedThrough: '',
      destination: '',
      status: 'Pending',
      signatureRequired: false,
    })
    setRows([createEmptyRow()])
    setEditingDcId(null)
  }

  const openGenerateForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditForm = (row: DashboardRow) => {
    setEditingDcId(row.id)
    setForm({
      customerName: row.customerName,
      contactPerson: row.contactPerson,
      deliveryNote: '',
      dispatchedThrough: '',
      destination: '',
      status: row.status,
      signatureRequired: false,
    })
    setRows([
      {
        id: makeRowId(),
        productId: '',
        productName: row.product,
        description: '',
        quantity: '1',
        unitPrice: '',
        tax: '',
      },
    ])
    setShowForm(true)
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
        customerName: form.customerName,
        contactPerson: form.contactPerson,
        deliveryNote: form.deliveryNote,
        dispatchedThrough: form.dispatchedThrough,
        destination: form.destination,
        status: form.status,
        signatureRequired: form.signatureRequired,
        items: validRows.map((row) => ({
          productId: row.productId,
          productName: row.productName,
          description: row.description,
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice || 0),
          tax: Number(row.tax || 0),
        })),
      }

      const response = await fetch(`${API_URL}/api/delivery-challans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Unable to save delivery challan')
      }

      const generatedDcNo = data.challanNumber || `DC-${new Date().getFullYear()}-${String(dcRows.length + 1).padStart(4, '0')}`
      const newRow: DashboardRow = {
        id: editingDcId || `dc-${Date.now()}`,
        dcNo: generatedDcNo,
        createdBy: 'Admin',
        customerName: form.customerName,
        contactPerson: form.contactPerson || '—',
        product: validRows.map((row) => row.productName).join(', '),
        dcDate: new Date().toISOString().slice(0, 10),
        status: form.status,
      }

      setDcRows((prev) => {
        if (editingDcId) {
          return prev.map((row) => (row.id === editingDcId ? newRow : row))
        }
        return [newRow, ...prev]
      })

      setToastType('success')
      setToastMessage(`Delivery challan ${generatedDcNo} saved successfully.`)
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">
            DC Dashboard
          </p>
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
          Generate New
        </button>
      </div>

      <div className="relative max-w-md">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search DC no, customer, status..."
          className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 pl-10 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E7E3DA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#EBE6DF] bg-[#F7F5F0]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">DC No</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">Created By</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">Customer Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">Contact Person</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">Product</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">DC Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-[#F3EFE8] last:border-b-0 hover:bg-[#FAF8F4]">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.dcNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.createdBy}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.customerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.contactPerson}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.product}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.dcDate}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.status === 'Delivered'
                        ? 'bg-green-100 text-green-700'
                        : row.status === 'Dispatched'
                          ? 'bg-blue-100 text-blue-700'
                          : row.status === 'Pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(true)
                          openEditForm(row)
                        }}
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">
            Generate Delivery Challan
          </p>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
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
            Customer Details
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <select
                value={form.customerName}
                onChange={(event) => updateFormValue('customerName', event.target.value)}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              >
                <option value="">Select customer</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id || customer.name} value={customer.name}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Contact Person
              </label>
              <input
                list="contact-person-options"
                value={form.contactPerson}
                onChange={(event) => updateFormValue('contactPerson', event.target.value)}
                placeholder="Select or enter contact person"
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              />
              <datalist id="contact-person-options">
                {contactSuggestions.map((contact) => (
                  <option key={contact} value={contact} />
                ))}
              </datalist>
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

                <div className="grid gap-4 xl:grid-cols-[1.5fr_1.3fr_0.8fr_0.8fr_0.7fr_0.2fr]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Product <span className="text-red-500">*</span>
                    </label>
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
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.id, 'quantity', event.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
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
                      placeholder="0.00"
                      className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
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
                      placeholder="0"
                      className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
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

        <div className="rounded-2xl border border-[#E7E3DA] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-gray-600">
            <FileText className="h-4 w-4" />
            Delivery Details
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Delivery Note
              </label>
              <textarea
                value={form.deliveryNote}
                onChange={(event) => updateFormValue('deliveryNote', event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
              />
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Dispatched Through
                </label>
                <input
                  value={form.dispatchedThrough}
                  onChange={(event) => updateFormValue('dispatchedThrough', event.target.value)}
                  placeholder="Courier / Transport / Hand delivery"
                  className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Destination
                </label>
                <input
                  value={form.destination}
                  onChange={(event) => updateFormValue('destination', event.target.value)}
                  placeholder="City / Branch / Address"
                  className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(event) => updateFormValue('status', event.target.value)}
                  className="w-full rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#06283D] focus:ring-2 focus:ring-[#DDE7EE]"
                >
                  <option value="Pending">Pending</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-[#E7E3DA] bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.signatureRequired}
              onChange={(event) => updateFormValue('signatureRequired', event.target.checked)}
              className="h-4 w-4 rounded border-[#C8C0AF] text-[#06283D] focus:ring-[#06283D]"
            />
            Signature Required
          </label>

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

  return (
    <div className="space-y-6">
      {showForm ? renderForm() : renderDashboard()}
    </div>
  )
}
