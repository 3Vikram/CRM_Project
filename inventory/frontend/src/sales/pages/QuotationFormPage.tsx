'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RefreshCcw } from 'lucide-react'
import { Toast } from '@/sales/components/toast'
import { createLead } from '@/sales/lib/leadApi'
import { fetchCustomers, type CustomerApiRecord } from '@/sales/lib/customerApi'
import { clearApiCache } from '@/sales/lib/apiCache'
import { getAuthHeaders } from '@/sales/lib/apiAuth'

const taxOptions = [
  '--Select--',
  'CGST + SGST 5%',
  'IGST 5%',
  'CGST + SGST 12%',
  'IGST 12%',
  'CGST + SGST 18%',
  'IGST 18%',
  'CGST + SGST 28%',
  'IGST 28%',
  'EGT 0%',
]

interface InventoryProduct {
  id?: string
  _id?: string
  productName: string
  description?: string
  defaultPrice?: number
  price?: number
  hsnSac?: string
  gst?: string
  isActive?: boolean
}

const initialForm = {
  customerId: '',
  customerName: '',
  contactPerson: '',
  email: '',
  mobile: '',
  productName: '',
  productDescription: '',
  hsnSac: '',
  quantity: '',
  expectedVendorPrice: '',
  unitPrice: '',
  tax: '',
  orOption: 'No',
  product2Name: '',
  product2Description: '',
  product2HsnSac: '',
  product2Quantity: '',
  product2ExpectedVendorPrice: '',
  product2UnitPrice: '',
  product2Tax: '',
  serviceName: '',
  serviceCost: '',
  serviceTax: '',
  freightName: '',
  freightCost: '',
  freightTax: '',
  dollarInRupee: '',
  wht: '',
  partnerMargin: '',
  currency: '',
  validity: '',
  delivery: '',
  payment: '',
  expectedClosure: '',
  note: '',
  enterpriseQuot: 'No',
  addressRequired: false,
  signatureRequired: false,
}

export default function QuotationFormPage() {
  const navigate = useNavigate()
  const { type } = useParams<{ type?: string }>()
  const quotationType: 'rent' | 'sold' = type === 'sold' ? 'sold' : 'rent'
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([])
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productLoadError, setProductLoadError] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [product2Search, setProduct2Search] = useState('')
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const [product2DropdownOpen, setProduct2DropdownOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProduct2Id, setSelectedProduct2Id] = useState('')
  const [taxDropdownOpen, setTaxDropdownOpen] = useState(false)
  const [taxSearch, setTaxSearch] = useState('')
  const [tax2DropdownOpen, setTax2DropdownOpen] = useState(false)
  const [tax2Search, setTax2Search] = useState('')
  const taxDropdownRef = useRef<HTMLDivElement | null>(null)
  const tax2DropdownRef = useRef<HTMLDivElement | null>(null)
  const productDropdownRef = useRef<HTMLDivElement | null>(null)
  const product2DropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await fetchCustomers({ limit: 100, fresh: true })
        setCustomers(response.data || [])
      } catch (error) {
        console.error('Unable to load quotation customers:', error)
        setToast('Unable to load customers')
      }
    }
    void loadCustomers()
  }, [])

  useEffect(() => {
    const loadInventoryProducts = async () => {
      setIsLoadingProducts(true)
      setProductLoadError('')
      try {
        const response = await fetch('/api/quotations/inventory-products', { headers: getAuthHeaders() })
        const result: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const errorBody = result as { error?: unknown; message?: unknown } | null
          const message = typeof errorBody?.message === 'string'
            ? errorBody.message
            : typeof errorBody?.error === 'string'
              ? errorBody.error
              : `Unable to fetch Inventory products (${response.status}).`
          throw new Error(message)
        }
        if (!Array.isArray(result)) {
          throw new Error('Inventory returned an invalid product list.')
        }
        setInventoryProducts((result as InventoryProduct[]).filter((product) => product.isActive !== false && product.productName))
      } catch (error) {
        setProductLoadError(error instanceof Error ? error.message : 'Unable to fetch Inventory products.')
        setInventoryProducts([])
      } finally {
        setIsLoadingProducts(false)
      }
    }
    void loadInventoryProducts()
  }, [])

  const getTaxRate = (taxValue: string) => {
    const match = taxValue.match(/(\d+(?:\.\d+)?)/)
    return match ? Number(match[1]) : Number.NaN
  }

  const filteredTaxOptions = useMemo(() => {
    const normalized = taxSearch.trim().toLowerCase()
    if (!normalized) return taxOptions
    return taxOptions.filter((option) => option.toLowerCase().includes(normalized))
  }, [taxSearch])

  const filteredTax2Options = useMemo(() => {
    const normalized = tax2Search.trim().toLowerCase()
    if (!normalized) return taxOptions
    return taxOptions.filter((option) => option.toLowerCase().includes(normalized))
  }, [tax2Search])

  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase()
    if (!normalized) return inventoryProducts
    return inventoryProducts.filter((product) =>
      [product.productName, product.description || '', product.hsnSac || '']
        .some((value) => value.toLowerCase().includes(normalized))
    )
  }, [inventoryProducts, productSearch])

  const filteredProducts2 = useMemo(() => {
    const normalized = product2Search.trim().toLowerCase()
    if (!normalized) return inventoryProducts
    return inventoryProducts.filter((product) =>
      [product.productName, product.description || '', product.hsnSac || '']
        .some((value) => value.toLowerCase().includes(normalized))
    )
  }, [inventoryProducts, product2Search])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (taxDropdownRef.current && !taxDropdownRef.current.contains(event.target as Node)) {
        setTaxDropdownOpen(false)
      }
      if (tax2DropdownRef.current && !tax2DropdownRef.current.contains(event.target as Node)) {
        setTax2DropdownOpen(false)
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setProductDropdownOpen(false)
        setProductSearch('')
      }
      if (product2DropdownRef.current && !product2DropdownRef.current.contains(event.target as Node)) {
        setProduct2DropdownOpen(false)
        setProduct2Search('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    // VALIDATE ONLY FIELDS MARKED WITH "*" IN THE FORM

    // Customer Details (Row 1)
    if (!form.customerName.trim()) {
      nextErrors.customerName = 'Customer Name is required'
    }

    // Product 1 Section
    if (!form.productName.trim()) {
      nextErrors.productName = 'Product is required'
    }
    if (!selectedProductId) {
      nextErrors.productName = 'Select a product from Inventory'
    }

    if (!form.productDescription.trim()) {
      nextErrors.productDescription = 'Description is required'
    }

    if (!form.quantity.trim() || Number.isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
      nextErrors.quantity = 'Quantity must be a number greater than zero'
    }

    // At least one price is required (either expectedVendorPrice or unitPrice)
    const hasExpectedVendorPrice =
      form.expectedVendorPrice.trim() &&
      !Number.isNaN(Number(form.expectedVendorPrice)) &&
      Number(form.expectedVendorPrice) > 0
    const hasUnitPrice =
      form.unitPrice.trim() && !Number.isNaN(Number(form.unitPrice)) && Number(form.unitPrice) > 0

    if (!hasExpectedVendorPrice && !hasUnitPrice) {
      nextErrors.unitPrice = 'At least one price (Unit Price or Expected Vendor Price) is required'
    }

    if (!form.tax.trim() || form.tax === '--Select--') {
      nextErrors.tax = 'Tax is required'
    }

    // Product 2 validation when Or Option = Yes
    if (form.orOption === 'Yes') {
      if (!form.product2Name.trim()) {
        nextErrors.product2Name = 'Product is required'
      }
      if (!selectedProduct2Id) {
        nextErrors.product2Name = 'Select a product from Inventory'
      }

      if (!form.product2Description.trim()) {
        nextErrors.product2Description = 'Description is required'
      }

      if (!form.product2Quantity.trim() || Number.isNaN(Number(form.product2Quantity)) || Number(form.product2Quantity) <= 0) {
        nextErrors.product2Quantity = 'Quantity must be a number greater than zero'
      }

      const hasProduct2ExpectedVendorPrice =
        form.product2ExpectedVendorPrice.trim() &&
        !Number.isNaN(Number(form.product2ExpectedVendorPrice)) &&
        Number(form.product2ExpectedVendorPrice) > 0
      const hasProduct2UnitPrice =
        form.product2UnitPrice.trim() &&
        !Number.isNaN(Number(form.product2UnitPrice)) &&
        Number(form.product2UnitPrice) > 0

      if (!hasProduct2ExpectedVendorPrice && !hasProduct2UnitPrice) {
        nextErrors.product2UnitPrice = 'At least one price (Unit Price or Expected Vendor Price) is required'
      }

      if (!form.product2Tax.trim() || form.product2Tax === '--Select--') {
        nextErrors.product2Tax = 'Tax is required'
      }
    }

    // Commercial Section - Fields marked with "*"
    if (!form.currency.trim() || form.currency === '') {
      nextErrors.currency = 'Currency is required'
    }

    if (!form.validity.trim() || Number.isNaN(Number(form.validity)) || Number(form.validity) < 0) {
      nextErrors.validity = 'Validity (Days) is required'
    }

    if (!form.delivery.trim()) {
      nextErrors.delivery = 'Delivery is required'
    }

    if (!form.payment.trim() || form.payment === '') {
      nextErrors.payment = 'Payment is required'
    }

    return nextErrors
  }, [form, selectedProductId, selectedProduct2Id])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, type, value, checked } = event.target as HTMLInputElement
    setForm((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  const handleCustomerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const customer = customers.find((item) => item._id === event.target.value)
    const contact = customer?.contacts?.[0]
    setForm((prev) => ({
      ...prev,
      customerId: customer?._id || '',
      customerName: customer?.companyName || customer?.customerName || '',
      contactPerson: contact?.name || '',
      email: contact?.email || customer?.email || '',
      mobile: contact?.phone || customer?.phone || '',
    }))
  }

  const handleProductSelect = (product: InventoryProduct, productNumber: 1 | 2) => {
    const selectedId = product.id || product._id || product.productName
    const defaultPrice = Number(product.defaultPrice)
    const unitPrice = Number(product.price)
    const productValues = {
      productName: product.productName,
      productDescription: product.description || '',
      hsnSac: product.hsnSac || '',
      expectedVendorPrice: Number.isFinite(defaultPrice) && defaultPrice > 0 ? String(defaultPrice) : '',
      unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? String(unitPrice) : '',
      tax: product.gst || '',
    }

    if (productNumber === 1) {
      setSelectedProductId(selectedId)
      setProductSearch('')
      setProductDropdownOpen(false)
      setForm((prev) => ({ ...prev, ...productValues }))
    } else {
      setSelectedProduct2Id(selectedId)
      setProduct2Search('')
      setProduct2DropdownOpen(false)
      setForm((prev) => ({
        ...prev,
        product2Name: productValues.productName,
        product2Description: productValues.productDescription,
        product2HsnSac: productValues.hsnSac,
        product2ExpectedVendorPrice: productValues.expectedVendorPrice,
        product2UnitPrice: productValues.unitPrice,
        product2Tax: productValues.tax,
      }))
    }
  }

  const handleTaxSelect = (option: string) => {
    setForm((prev) => ({ ...prev, tax: option }))
    setTaxSearch('')
    setTaxDropdownOpen(false)
  }

  const handleTax2Select = (option: string) => {
    setForm((prev) => ({ ...prev, product2Tax: option }))
    setTax2Search('')
    setTax2DropdownOpen(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validationErrors
    
    if (Object.keys(errors).length > 0) {
      // Only show validation errors for mandatory fields
      setErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      // Build products array with all available data
      const products = [
        {
          productName: form.productName,
          productDescription: form.productDescription || '',
          hsnSac: form.hsnSac || '',
          quantity: form.quantity,
          expectedVendorPrice: form.expectedVendorPrice || '',
          unitPrice: form.unitPrice || '',
          tax: form.tax || '',
        },
      ]

      // Add product 2 if Or Option = Yes
      if (form.orOption === 'Yes') {
        products.push({
          productName: form.product2Name,
          productDescription: form.product2Description || '',
          hsnSac: form.product2HsnSac || '',
          quantity: form.product2Quantity,
          expectedVendorPrice: form.product2ExpectedVendorPrice || '',
          unitPrice: form.product2UnitPrice || '',
          tax: form.product2Tax || '',
        })
      }

      // Create quotation payload with all available data
      // Email and mobile can be empty/missing - backend will handle them
      const payload = {
        companyName: form.customerName,
        customerId: form.customerId,
        contactPerson: form.contactPerson || 'Not provided',
        email: form.email || 'noemail@noemail.com', // Provide default for required field
        mobile: form.mobile || '0000000000', // Provide default for required field
        quotationType,
        leadStatus: 'Proposal Sent',
        products,
        quotationDetails: {
          serviceName: form.serviceName || '',
          serviceCost: form.serviceCost || '',
          serviceTax: form.serviceTax || '',
          freightName: form.freightName || '',
          freightCost: form.freightCost || '',
          freightTax: form.freightTax || '',
          dollarInRupee: form.dollarInRupee || '',
          wht: form.wht || '',
          partnerMargin: form.partnerMargin || '',
          currency: form.currency || '',
          validity: form.validity || '',
          delivery: form.delivery || '',
          payment: form.payment || '',
          expectedClosure: form.expectedClosure || '',
          note: form.note || '',
          enterpriseQuot: form.enterpriseQuot || 'No',
          addressRequired: form.addressRequired,
          signatureRequired: form.signatureRequired,
        },
      }

      // Call API to create quotation
      await createLead(payload)
      setErrors({})
      setToast('Quotation saved successfully')
      
      // Clear API cache to ensure fresh data loads on dashboard
      clearApiCache()

      // Navigate to dashboard after a short delay
      setTimeout(() => {
        navigate(`/sales/quotations/${quotationType}`)
      }, 1500)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save quotation'
      setToast(errorMessage)
      console.error('Submit error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setForm(initialForm)
    setErrors({})
    setToast(null)
    setSelectedProductId('')
    setSelectedProduct2Id('')
    setProductSearch('')
    setProduct2Search('')
  }

  return (
    <div className="space-y-6">
      <div>
          <button
    type="button"
    onClick={() => navigate(`/sales/quotations/${quotationType}`)}
    className="mb-3 flex items-center gap-1 text-sm text-[#111827] hover:underline cursor-pointer"
  >
    ← Back to {quotationType === 'sold' ? 'Sold' : 'Rent'} Quotations
  </button>
        <h1 className="crm-page-heading">Generate New {quotationType === 'sold' ? 'Sold' : 'Rent'} Quotation</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="space-y-0">
          {/* Customer Details Row 1 */}
          <div className="grid gap-4 md:grid-cols-2 pb-4 mb-4 border-b border-[#D1D5DB]">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Customer Name <span className="required-asterisk">*</span></span>
              <select
                name="customerId"
                value={form.customerId}
                onChange={handleCustomerChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.customerName ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.companyName || customer.customerName}</option>)}
              </select>
              {errors.customerName && <p className="text-xs text-red-600">{errors.customerName}</p>}
            </label>

            
          {/* </div> */}

          {/* Customer Details Row 2 */}
          {/* <div className="grid gap-4 md:grid-cols-3 pb-4 mb-4 border-b border-[#D1D5DB]"> */}
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Contact Person</span>
              <input
                name="contactPerson"
                value={form.contactPerson}
                readOnly
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="Contact person"
              />
            </label>
          </div>

          {/* Product Row 1 */}
          <div className="grid gap-4 md:grid-cols-4 pb-4 mb-4">
            <div ref={productDropdownRef} className="relative space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Product <span className="required-asterisk">*</span></span>
              <input
                role="combobox"
                aria-expanded={productDropdownOpen}
                aria-autocomplete="list"
                autoComplete="off"
                value={productSearch || form.productName}
                onFocus={(event) => {
                  setProductSearch('')
                  setProductDropdownOpen(true)
                  event.currentTarget.select()
                }}
                onChange={(event) => {
                  setProductSearch(event.target.value)
                  setSelectedProductId('')
                  setForm((prev) => ({ ...prev, productName: '', productDescription: '', hsnSac: '', expectedVendorPrice: '', unitPrice: '', tax: '' }))
                  setProductDropdownOpen(true)
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.productName ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder={isLoadingProducts ? 'Loading Inventory products...' : 'Search Inventory products'}
              />
              {productDropdownOpen && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
                  {isLoadingProducts ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading Inventory products...</div>
                  ) : filteredProducts.length ? filteredProducts.map((product) => (
                    <button
                      key={product.id || product._id || product.productName}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleProductSelect(product, 1)}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]"
                    >
                      {product.productName}
                    </button>
                  )) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      {productLoadError || (inventoryProducts.length ? 'No matching products found.' : 'No active Inventory products found.')}
                    </div>
                  )}
                </div>
              )}
              {errors.productName && <p className="text-xs text-red-600">{errors.productName}</p>}
              {productLoadError ? <p className="text-xs text-red-600">{productLoadError}</p> : null}
            </div>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Description <span className="required-asterisk">*</span></span>
              <textarea
                name="productDescription"
                value={form.productDescription}
                onChange={handleChange}
                rows={1}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.productDescription ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="Product description"
              />
              {errors.productDescription && <p className="text-xs text-red-600">{errors.productDescription}</p>}
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">HSN/SAC</span>
              <input
                name="hsnSac"
                value={form.hsnSac}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="HSN/SAC code"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Quantity <span className="required-asterisk">*</span></span>
              <input
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                type="number"
                min="0"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.quantity ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="0"
              />
              {errors.quantity && <p className="text-xs text-red-600">{errors.quantity}</p>}
            </label>
          </div>

          {/* Product Row 2 */}
          <div className="grid gap-4 md:grid-cols-4 pb-4 mb-4 border-b border-[#D1D5DB]">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Expected Vendor Price <span className="required-asterisk">*</span></span>
              <input
                name="expectedVendorPrice"
                value={form.expectedVendorPrice}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.expectedVendorPrice ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="0.00"
              />
              {errors.expectedVendorPrice && <p className="text-xs text-red-600">{errors.expectedVendorPrice}</p>}
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Unit Price <span className="required-asterisk">*</span></span>
              <input
                name="unitPrice"
                value={form.unitPrice}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.unitPrice ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="0.00"
              />
              {errors.unitPrice && <p className="text-xs text-red-600">{errors.unitPrice}</p>}
            </label>

            <div ref={taxDropdownRef} className="relative space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Tax <span className="required-asterisk">*</span></span>
              <input
                readOnly
                value={form.tax}
                onClick={() => setTaxDropdownOpen(true)}
                onFocus={() => setTaxDropdownOpen(true)}
                onMouseDown={(event) => event.preventDefault()}
                placeholder="--Select--"
                className={`cursor-pointer w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 ${errors.tax ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
              />
              <span className="pointer-events-none absolute right-3 top-[38px] text-gray-400">▼</span>
              {taxDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
                  <div className="border-b border-[#EFECE5] p-2">
                    <input
                      autoFocus
                      value={taxSearch}
                      onChange={(event) => setTaxSearch(event.target.value)}
                      placeholder="Search tax"
                      className="cursor-pointer w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredTaxOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleTaxSelect(option)}
                        className={`cursor-pointer block w-full px-3 py-2 text-left text-sm hover:bg-[#F2EFE8] ${form.tax === option ? 'bg-[#F2EFE8] font-medium text-gray-900' : 'text-gray-700'}`}
                      >
                        {option}
                      </button>
                    ))}
                    {filteredTaxOptions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">No tax option found.</div>
                    )}
                  </div>
                </div>
              )}
              {errors.tax && <p className="text-xs text-red-600">{errors.tax}</p>}
            </div>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Or Option</span>
              <select
                name="orOption"
                value={form.orOption}
                onChange={handleChange}
                className="cursor-pointer w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </label>
          </div>

          {/* Product 2 Section - Show when Or Option = Yes */}
          {form.orOption === 'Yes' && (
            <>
              <div className="grid gap-4 md:grid-cols-4 pb-4 mb-4">
                <div ref={product2DropdownRef} className="relative space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">Product 2 <span className="required-asterisk">*</span></span>
                  <input
                    role="combobox"
                    aria-expanded={product2DropdownOpen}
                    aria-autocomplete="list"
                    autoComplete="off"
                    value={product2Search || form.product2Name}
                    onFocus={(event) => {
                      setProduct2Search('')
                      setProduct2DropdownOpen(true)
                      event.currentTarget.select()
                    }}
                    onChange={(event) => {
                      setProduct2Search(event.target.value)
                      setSelectedProduct2Id('')
                      setForm((prev) => ({ ...prev, product2Name: '', product2Description: '', product2HsnSac: '', product2ExpectedVendorPrice: '', product2UnitPrice: '', product2Tax: '' }))
                      setProduct2DropdownOpen(true)
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.product2Name ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                    placeholder={isLoadingProducts ? 'Loading Inventory products...' : 'Search Inventory products'}
                  />
                  {product2DropdownOpen && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
                      {isLoadingProducts ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Loading Inventory products...</div>
                      ) : filteredProducts2.length ? filteredProducts2.map((product) => (
                        <button
                          key={product.id || product._id || product.productName}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleProductSelect(product, 2)}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]"
                        >
                          {product.productName}
                        </button>
                      )) : (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          {productLoadError || (inventoryProducts.length ? 'No matching products found.' : 'No active Inventory products found.')}
                        </div>
                      )}
                    </div>
                  )}
                  {errors.product2Name && <p className="text-xs text-red-600">{errors.product2Name}</p>}
                  {productLoadError ? <p className="text-xs text-red-600">{productLoadError}</p> : null}
                </div>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">Description 2 <span className="required-asterisk">*</span></span>
                  <textarea
                    name="product2Description"
                    value={form.product2Description}
                    onChange={handleChange}
                    rows={2}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.product2Description ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                    placeholder="Product description"
                  />
                  {errors.product2Description && <p className="text-xs text-red-600">{errors.product2Description}</p>}
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">HSN/SAC 2</span>
                  <input
                    name="product2HsnSac"
                    value={form.product2HsnSac}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                    placeholder="HSN/SAC code"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">Quantity 2 <span className="required-asterisk">*</span></span>
                  <input
                    name="product2Quantity"
                    value={form.product2Quantity}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.product2Quantity ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                    placeholder="0"
                  />
                  {errors.product2Quantity && <p className="text-xs text-red-600">{errors.product2Quantity}</p>}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-4 pb-4 mb-4 border-b border-[#D1D5DB]">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">Expected Vendor Price 2 <span className="required-asterisk">*</span></span>
                  <input
                    name="product2ExpectedVendorPrice"
                    value={form.product2ExpectedVendorPrice}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    step="0.01"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.product2ExpectedVendorPrice ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                    placeholder="0.00"
                  />
                  {errors.product2ExpectedVendorPrice && <p className="text-xs text-red-600">{errors.product2ExpectedVendorPrice}</p>}
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">Unit Price 2 <span className="required-asterisk">*</span></span>
                  <input
                    name="product2UnitPrice"
                    value={form.product2UnitPrice}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    step="0.01"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.product2UnitPrice ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                    placeholder="0.00"
                  />
                  {errors.product2UnitPrice && <p className="text-xs text-red-600">{errors.product2UnitPrice}</p>}
                </label>

                <div ref={tax2DropdownRef} className="relative space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">Tax 2 <span className="required-asterisk">*</span></span>
                  <input
                    readOnly
                    value={form.product2Tax}
                    onClick={() => setTax2DropdownOpen(true)}
                    onFocus={() => setTax2DropdownOpen(true)}
                    onMouseDown={(event) => event.preventDefault()}
                    placeholder="--Select--"
                    className={`cursor-pointer w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 ${errors.product2Tax ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                  />
                  <span className="pointer-events-none absolute right-3 top-[38px] text-gray-400">▼</span>
                  {tax2DropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
                      <div className="border-b border-[#EFECE5] p-2">
                        <input
                          autoFocus
                          value={tax2Search}
                          onChange={(event) => setTax2Search(event.target.value)}
                          placeholder="Search tax"
                          className="cursor-pointer w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredTax2Options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleTax2Select(option)}
                            className={`cursor-pointer block w-full px-3 py-2 text-left text-sm hover:bg-[#F2EFE8] ${form.product2Tax === option ? 'bg-[#F2EFE8] font-medium text-gray-900' : 'text-gray-700'}`}
                          >
                            {option}
                          </button>
                        ))}
                        {filteredTax2Options.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No tax option found.</div>
                        )}
                      </div>
                    </div>
                  )}
                  {errors.product2Tax && <p className="text-xs text-red-600">{errors.product2Tax}</p>}
                </div>
              </div>
            </>
          )}

          {/* Commercial Section Row 1 */}
          <div className="grid gap-4 md:grid-cols-3 pb-4 mb-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Service Name</span>
              <input
                name="serviceName"
                value={form.serviceName}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="Service name"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Service Cost</span>
              <input
                name="serviceCost"
                value={form.serviceCost}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="0.00"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Service Tax (%)</span>
              <input
                name="serviceTax"
                value={form.serviceTax}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="0"
              />
            </label>
          </div>

          {/* Commercial Section Row 2 */}
          <div className="grid gap-4 md:grid-cols-3 pb-4 mb-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Freight Name</span>
              <input
                name="freightName"
                value={form.freightName}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="Freight name"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Freight Cost</span>
              <input
                name="freightCost"
                value={form.freightCost}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="0.00"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Freight Tax (%)</span>
              <input
                name="freightTax"
                value={form.freightTax}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="0"
              />
            </label>
          </div>

          {/* Commercial Section Row 3 */}
          <div className="grid gap-4 md:grid-cols-3 pb-4 mb-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">1 Dollar In Rupee</span>
              <input
                name="dollarInRupee"
                value={form.dollarInRupee}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="0.00"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">WHT (%)</span>
              <input
                name="wht"
                value={form.wht}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="0"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Partner Margin (%)</span>
              <input
                name="partnerMargin"
                value={form.partnerMargin}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="0"
              />
            </label>
          </div>

          {/* Commercial Section Row 4 */}
          <div className="grid gap-4 md:grid-cols-4 pb-4 mb-4">
            <label className="space-y-1">
              {/* <span className="text-xs font-semibold uppercase text-gray-500">Currency <span className="required-asterisk">*</span></span>
              <input
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.currency ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="Currency"
              /> */}
              <span className="text-xs font-semibold uppercase text-gray-500">Currency <span className="required-asterisk">*</span></span>

<select
  name="currency"
  value={form.currency}
  onChange={handleChange}
  className={`cursor-pointer w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    errors.currency
      ? 'border-red-500 ring-red-100 focus:ring-red-200'
      : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'
  }`}
>
  <option value="">--Select--</option>
  <option value="Rupee ₹">Rupee ₹</option>
  <option value="Dollar $">Dollar $</option>
  <option value="Euro €">Euro €</option>
  <option value="Pound £">Pound £</option>
</select>
              {errors.currency && <p className="text-xs text-red-600">{errors.currency}</p>}
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Validity (Days) <span className="required-asterisk">*</span></span>
              <input
                name="validity"
                value={form.validity}
                onChange={handleChange}
                type="number"
                min="0"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.validity ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="0"
              />
              {errors.validity && <p className="text-xs text-red-600">{errors.validity}</p>}
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Delivery <span className="required-asterisk">*</span></span>
              <input
                name="delivery"
                value={form.delivery}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.delivery ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="Delivery"
              />
              {errors.delivery && <p className="text-xs text-red-600">{errors.delivery}</p>}
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Payment <span className="required-asterisk">*</span></span>
              {/* <input
                name="payment"
                value={form.payment}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.payment ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="Payment terms"
              /> */}
              <select
  name="payment"
  value={form.payment}
  onChange={handleChange}
  className={`cursor-pointer w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    errors.payment
      ? 'border-red-500 ring-red-100 focus:ring-red-200'
      : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'
  }`}
>
  <option value="">--Select--</option>
  <option value="As per MSA">As per MSA</option>
  <option value="100% Advance">100% Advance</option>
  <option value="50% Advance and 50% After Delivery">
    50% Advance and 50% After Delivery
  </option>
  <option value="30 Days">30 Days</option>
  <option value="45 Days">45 Days</option>
  <option value="60 Days">60 Days</option>
  <option value="90 Days">90 Days</option>
  <option value="Custom">Custom</option>
</select>
              {errors.payment && <p className="text-xs text-red-600">{errors.payment}</p>}
            </label>
          </div>

          {/* Commercial Section Row 5 */}
          <div className="grid gap-4 md:grid-cols-4 pb-4 mb-4 border-b border-[#D1D5DB]">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Expected Closure</span>
              <input
                name="expectedClosure"
                value={form.expectedClosure}
                onChange={handleChange}
                type="date"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Note</span>
              <input
                name="note"
                value={form.note}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="Additional notes"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Enterprise Quot</span>
              <select
                name="enterpriseQuot"
                value={form.enterpriseQuot}
                onChange={handleChange}
                className="cursor-pointer w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </label>
          </div>

          {/* Checkboxes Row */}
          <div className="flex flex-col gap-3 pb-4 mb-4 border-b border-[#D1D5DB]">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="addressRequired"
                checked={form.addressRequired}
                onChange={handleChange}
                className="cursor-pointer h-4 w-4 rounded border-[#E5E7EB]"
              />
              <span className="text-sm text-gray-700">Address Required in Quotation</span>
            </label>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="signatureRequired"
                checked={form.signatureRequired}
                onChange={handleChange}
                className="cursor-pointer h-4 w-4 rounded border-[#E5E7EB]"
              />
              <span className="text-sm text-gray-700">Signature Required</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E293B] disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-[#E7E3DA] disabled:bg-gray-200 disabled:cursor-not-allowed"
            >
              <RefreshCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </div>
      </form>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
