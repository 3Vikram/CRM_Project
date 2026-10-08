'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RefreshCcw } from 'lucide-react'
import { Toast } from '@/components/toast'
import { createLead } from '@/lib/leadApi'
import { fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi'
import { clearApiCache } from '@/lib/apiCache'

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

const initialForm = {
  customerId: '',
  customerName: '',
  contactPerson: '',
  email: '',
  mobile: '',
  subject: '',
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
  const [taxDropdownOpen, setTaxDropdownOpen] = useState(false)
  const [taxSearch, setTaxSearch] = useState('')
  const [tax2DropdownOpen, setTax2DropdownOpen] = useState(false)
  const [tax2Search, setTax2Search] = useState('')
  const taxDropdownRef = useRef<HTMLDivElement | null>(null)
  const tax2DropdownRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (taxDropdownRef.current && !taxDropdownRef.current.contains(event.target as Node)) {
        setTaxDropdownOpen(false)
      }
      if (tax2DropdownRef.current && !tax2DropdownRef.current.contains(event.target as Node)) {
        setTax2DropdownOpen(false)
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
  }, [form])

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
          subject: form.subject || '',
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
          <div className="grid gap-4 md:grid-cols-3 pb-4 mb-4 border-b border-[#D1D5DB]">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Customer Name *</span>
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


            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Subject</span>
              <input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                placeholder="Quotation subject"
              />
            </label>
          </div>

          {/* Product Row 1 */}
          <div className="grid gap-4 md:grid-cols-4 pb-4 mb-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Product *</span>
              <input
                name="productName"
                value={form.productName}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.productName ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="Product name"
              />
              {errors.productName && <p className="text-xs text-red-600">{errors.productName}</p>}
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-gray-500">Description *</span>
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
              <span className="text-xs font-semibold uppercase text-gray-500">Quantity *</span>
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
              <span className="text-xs font-semibold uppercase text-gray-500">Expected Vendor Price *</span>
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
              <span className="text-xs font-semibold uppercase text-gray-500">Unit Price *</span>
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
              <span className="text-xs font-semibold uppercase text-gray-500">Tax *</span>
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
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">Product 2 *</span>
                  <input
                    name="product2Name"
                    value={form.product2Name}
                    onChange={handleChange}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.product2Name ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                    placeholder="Product name"
                  />
                  {errors.product2Name && <p className="text-xs text-red-600">{errors.product2Name}</p>}
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">Description 2 *</span>
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
                  <span className="text-xs font-semibold uppercase text-gray-500">Quantity 2 *</span>
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
                  <span className="text-xs font-semibold uppercase text-gray-500">Expected Vendor Price 2 *</span>
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
                  <span className="text-xs font-semibold uppercase text-gray-500">Unit Price 2 *</span>
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
                  <span className="text-xs font-semibold uppercase text-gray-500">Tax 2 *</span>
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
              {/* <span className="text-xs font-semibold uppercase text-gray-500">Currency *</span>
              <input
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.currency ? 'border-red-500 ring-red-100 focus:ring-red-200' : 'border-[#E5E7EB] focus:ring-[#CEC9BD]'}`}
                placeholder="Currency"
              /> */}
              <span className="text-xs font-semibold uppercase text-gray-500">
  Currency *
</span>

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
              <span className="text-xs font-semibold uppercase text-gray-500">Validity (Days) *</span>
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
              <span className="text-xs font-semibold uppercase text-gray-500">Delivery *</span>
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
              <span className="text-xs font-semibold uppercase text-gray-500">Payment *</span>
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
