'use client'

import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { Toast } from '@/components/toast'
import { SearchableSelect } from '@/components/SearchableSelect'
import { createOPF, fetchOPFById, updateOPF, type OPFRecord } from '@/lib/opfApi'
import { fetchLeads, type LeadRecord } from '@/lib/leadApi'
import { fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi'
import { fetchSuppliers, type SupplierRecord } from '@/lib/supplierApi'

const taxOptions = ['--Select--', 'CGST + SGST 5%', 'IGST 5%', 'CGST + SGST 12%', 'IGST 12%', 'CGST + SGST 18%', 'IGST 18%', 'CGST + SGST 28%', 'IGST 28%', 'EGST 0%']
const currencyOptions = ['Rupee ₹', 'Dollar $', 'Euro €', 'Pound £']
const amcOptions = ['Yes', 'No']
const paymentTermsOptions = ['--Select--', 'As per MSA', '100% Advance', '50% Advance and 50% After Delivery', '30 Days', '45 Days', '60 Days', '90 Days', 'Custom']

const FormField = ({ label, required, error, children, className }: any) => (
  <div className={className || ''}>
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </label>
  </div>
)

export default function OPFGenerateFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditLoading, setIsEditLoading] = useState(isEditMode)
  const [toast, setToast] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])

  // Section 1: Quotation Details
  const [quotationNumber, setQuotationNumber] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [contactPerson, setContactPerson] = useState('')

  // Section 2: Supplier/Product Details
  const [supplierName, setSupplierName] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRecord | null>(null)
  const [supplierContactPerson, setSupplierContactPerson] = useState('')
  const [product, setProduct] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [vendorPrice, setVendorPrice] = useState('')
  const [tax, setTax] = useState('')
  const [partNo, setPartNo] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Section 3: Service/Purchase/End User Details
  const [serviceName, setServiceName] = useState('')
  const [serviceCost, setServiceCost] = useState('')
  const [serviceTax, setServiceTax] = useState('')
  const [freightName, setFreightName] = useState('')
  const [freightCost, setFreightCost] = useState('')
  const [freightTax, setFreightTax] = useState('')
  const [wht, setWht] = useState('')
  const [conversionRate, setConversionRate] = useState('1')
  const [vendorCurrency, setVendorCurrency] = useState('Rupee ₹')
  const [eta, setEta] = useState('')
  const [customerPONo, setCustomerPONo] = useState('')
  const [customerPODate, setCustomerPODate] = useState('')
  const [amc, setAmc] = useState('')
  const [amcRenewalDate, setAmcRenewalDate] = useState('')
  const [notes, setNotes] = useState('')
  const [customerPaymentTerms, setCustomerPaymentTerms] = useState('')
  const [supplierPaymentTerms, setSupplierPaymentTerms] = useState('')
  const [enduserName, setEnduserName] = useState('')
  const [enduserEmail, setEnduserEmail] = useState('')
  const [enduserContact, setEnduserContact] = useState('')
  const [enduserAddress, setEnduserAddress] = useState('')
  const [billToAddress, setBillToAddress] = useState('')
  const [shipToAddress, setShipToAddress] = useState('')
  const [customerPOFile, setCustomerPOFile] = useState<File | null>(null)
  const [existingCustomerPOFile, setExistingCustomerPOFile] = useState<OPFRecord['customerPOFile']>(null)
  const [existingUploadedDocuments, setExistingUploadedDocuments] = useState<NonNullable<OPFRecord['uploadedDocuments']>>([])

  // Section 4: Documents (array of files)
  const [uploadedDocuments, setUploadedDocuments] = useState<(File | null)[]>([null])

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [leadsRes, customersRes, suppliersRes] = await Promise.all([
          fetchLeads({ status: 'Proposal Sent', limit: 1000 }),
          fetchCustomers({ limit: 1000 }),
          fetchSuppliers({ limit: 1000 }),
        ])
        setLeads(leadsRes.data || [])
        setCustomers(customersRes.data || [])
        setSuppliers(suppliersRes.data || [])
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load data')
      }
    }
    void loadData()
  }, [])

  useEffect(() => {
    if (!id) {
      setIsEditLoading(false)
      return
    }

    const loadOPF = async () => {
      try {
        const opf = await fetchOPFById(id)
        if (!opf) throw new Error('OPF not found')

        const dateValue = (value?: string | null) => value ? value.split('T')[0] : ''
        setQuotationNumber(opf.quotationNumber || '')
        setCustomerName(opf.customerName || '')
        setContactPerson(opf.contactPerson || '')
        setSupplierName(opf.supplierName || '')
        setSupplierContactPerson(opf.supplierContactPerson || '')
        setProduct(opf.product || '')
        setDescription(opf.description || '')
        setQuantity(opf.quantity === undefined ? '' : String(opf.quantity))
        setUnitPrice(opf.unitPrice === undefined ? '' : String(opf.unitPrice))
        setVendorPrice(opf.vendorPrice === undefined ? '' : String(opf.vendorPrice))
        setTax(opf.tax || '')
        setPartNo(opf.partNo || '')
        setStartDate(dateValue(opf.startDate))
        setEndDate(dateValue(opf.endDate))
        setServiceName(opf.serviceName || '')
        setServiceCost(opf.serviceCost === undefined ? '' : String(opf.serviceCost))
        setServiceTax(opf.serviceTax === undefined ? '' : String(opf.serviceTax))
        setFreightName(opf.freightName || '')
        setFreightCost(opf.freightCost === undefined ? '' : String(opf.freightCost))
        setFreightTax(opf.freightTax === undefined ? '' : String(opf.freightTax))
        setWht(opf.wht === undefined ? '' : String(opf.wht))
        setConversionRate(opf.conversionRate === undefined ? '1' : String(opf.conversionRate))
        setVendorCurrency(opf.vendorCurrency || 'Rupee ₹')
        setEta(dateValue(opf.eta))
        setCustomerPONo(opf.customerPONo || '')
        setCustomerPODate(dateValue(opf.customerPODate))
        setAmc(opf.amc || '')
        setAmcRenewalDate(dateValue(opf.amcRenewalDate))
        setNotes(opf.notes || '')
        setCustomerPaymentTerms(opf.customerPaymentTerms || '')
        setSupplierPaymentTerms(opf.supplierPaymentTerms || '')
        setEnduserName(opf.enduserName || '')
        setEnduserEmail(opf.enduserEmail || '')
        setEnduserContact(opf.enduserContact || '')
        setEnduserAddress(opf.enduserAddress || '')
        setBillToAddress(opf.billToAddress || '')
        setShipToAddress(opf.shipToAddress || '')
        setExistingCustomerPOFile(opf.customerPOFile || null)
        setExistingUploadedDocuments(opf.uploadedDocuments || [])
        setUploadedDocuments([null])
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load OPF')
      } finally {
        setIsEditLoading(false)
      }
    }

    void loadOPF()
  }, [id])

  useEffect(() => {
    if (quotationNumber) setSelectedLead(leads.find((lead) => lead.quotationId === quotationNumber) || null)
    if (supplierName) setSelectedSupplier(suppliers.find((supplier) => supplier.supplierName === supplierName) || null)
  }, [leads, suppliers, quotationNumber, supplierName])

  // Get unique product names from all data sources
  const productOptions = useMemo(() => {
    const products = new Set<string>()
    leads.forEach(lead => {
      lead.products?.forEach(p => {
        if (p.productName) products.add(p.productName)
      })
    })
    suppliers.forEach(s => {
      if (s.product) products.add(s.product)
    })
    return Array.from(products).sort()
  }, [leads, suppliers])

  // Handle quotation selection and auto-fill
  const handleQuotationChange = (value: string) => {
    const quotationId = value
    const lead = leads.find(l => l.quotationId === quotationId && l.quotationId)

    console.log('Selected Quotation ID:', quotationId)
    console.log('Selected Lead:', lead)

    if (lead) {
      setSelectedLead(lead)
      setQuotationNumber(lead.quotationId || '')
      setCustomerName(lead.companyName || '')
      setContactPerson(lead.contactPerson || '')

      // Auto-fill product and description if available
      if (lead.products && lead.products.length > 0) {
        const firstProduct = lead.products[0]
        console.log('First Product:', firstProduct)

        if (firstProduct.productName) setProduct(firstProduct.productName)
        // Use productDescription field from the quotation
        if (firstProduct.productDescription) {
          setDescription(firstProduct.productDescription)
          console.log('Auto-filled description:', firstProduct.productDescription)
        }
        if (firstProduct.quantity) setQuantity(String(firstProduct.quantity))
        if (firstProduct.unitPrice) setUnitPrice(String(firstProduct.unitPrice))
      }

      console.log('Auto-filled customer, contact person, and description')
    } else {
      setSelectedLead(null)
      setQuotationNumber('')
      setCustomerName('')
      setContactPerson('')
      setProduct('')
      setDescription('')
    }
  }

  // Handle supplier selection and auto-fill contact
  const handleSupplierChange = (value: string) => {
    const supplier = suppliers.find(s => s.supplierName === value)

    if (supplier) {
      setSelectedSupplier(supplier)
      setSupplierName(supplier.supplierName || '')
      setSupplierContactPerson(supplier.contactName || '')
    } else {
      setSelectedSupplier(null)
      setSupplierName('')
      setSupplierContactPerson('')
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!quotationNumber.trim()) newErrors.quotationNumber = 'Quotation No is required'
    if (!customerName.trim()) newErrors.customerName = 'Customer Name is required'
    if (!supplierName.trim()) newErrors.supplierName = 'Supplier Name is required'
    if (!supplierContactPerson.trim()) newErrors.supplierContactPerson = 'Supplier Contact Person is required'
    if (!product.trim()) newErrors.product = 'Product is required'
    if (!description.trim()) newErrors.description = 'Description is required'
    if (!quantity || Number(quantity) <= 0) newErrors.quantity = 'Quantity is required and must be > 0'
    if (!unitPrice || Number(unitPrice) < 0) newErrors.unitPrice = 'Unit Price is required'
    if (!vendorPrice || Number(vendorPrice) < 0) newErrors.vendorPrice = 'Vendor Price is required'
    if (!tax) newErrors.tax = 'Tax is required'
    if (!startDate) newErrors.startDate = 'Start Date is required'
    if (!endDate) newErrors.endDate = 'End Date is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) {
      setToast('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()

      // Add all fields
      formData.append('quotationNumber', quotationNumber)
      formData.append('quotationId', quotationNumber) // Store the actual quotation ID
      console.log('Submitting OPF with quotationNumber:', quotationNumber, 'quotationId:', quotationNumber)
      formData.append('customerName', customerName)
      const selectedCustomer = customers.find((customer) =>
        (customer.companyName || customer.customerName || '').trim().toLowerCase() === customerName.trim().toLowerCase()
      )
      if (selectedCustomer?._id) formData.append('customerId', selectedCustomer._id)
      formData.append('contactPerson', contactPerson)
      formData.append('supplierName', supplierName)
      formData.append('supplierContactPerson', supplierContactPerson)
      formData.append('product', product)
      formData.append('description', description)
      formData.append('quantity', quantity)
      formData.append('unitPrice', unitPrice)
      formData.append('vendorPrice', vendorPrice)
      formData.append('tax', tax)
      formData.append('partNo', partNo)
      formData.append('startDate', startDate)
      formData.append('endDate', endDate)
      formData.append('serviceName', serviceName)
      formData.append('serviceCost', serviceCost)
      formData.append('serviceTax', serviceTax)
      formData.append('freightName', freightName)
      formData.append('freightCost', freightCost)
      formData.append('freightTax', freightTax)
      formData.append('wht', wht)
      formData.append('conversionRate', conversionRate)
      formData.append('vendorCurrency', vendorCurrency)
      formData.append('eta', eta)
      formData.append('customerPONo', customerPONo)
      formData.append('customerPODate', customerPODate)
      formData.append('amc', amc)
      formData.append('amcRenewalDate', amcRenewalDate)
      formData.append('notes', notes)
      formData.append('customerPaymentTerms', customerPaymentTerms)
      formData.append('supplierPaymentTerms', supplierPaymentTerms)
      formData.append('enduserName', enduserName)
      formData.append('enduserEmail', enduserEmail)
      formData.append('enduserContact', enduserContact)
      formData.append('enduserAddress', enduserAddress)
      formData.append('billToAddress', billToAddress)
      formData.append('shipToAddress', shipToAddress)
      if (!isEditMode) formData.append('createdBy', window.localStorage.getItem('userName') || 'Admin')
      if (customerPOFile) formData.append('customerPOFile', customerPOFile)

      // Append all uploaded documents
      uploadedDocuments.forEach((doc, index) => {
        if (doc) {
          formData.append(`uploadedDocuments`, doc)
        }
      })

      const wasEdit = isEditMode && Boolean(id)
      const response = wasEdit && id ? await updateOPF(id, formData) : await createOPF(formData)
      const savedOPFId = response?.data?._id || id
      if (!savedOPFId) throw new Error('OPF was saved, but its ID was not returned')
      navigate(`/sales/opf/${savedOPFId}`, {
        state: wasEdit ? { message: 'OPF updated successfully' } : undefined,
      })
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Failed to create OPF')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setQuotationNumber('')
    setSelectedLead(null)
    setCustomerName('')
    setContactPerson('')
    setSupplierName('')
    setSelectedSupplier(null)
    setSupplierContactPerson('')
    setProduct('')
    setDescription('')
    setQuantity('')
    setUnitPrice('')
    setVendorPrice('')
    setTax('')
    setPartNo('')
    setStartDate('')
    setEndDate('')
    setServiceName('')
    setServiceCost('')
    setServiceTax('')
    setFreightName('')
    setFreightCost('')
    setFreightTax('')
    setWht('')
    setConversionRate('1')
    setVendorCurrency('Rupee ₹')
    setEta('')
    setCustomerPONo('')
    setCustomerPODate('')
    setAmc('')
    setAmcRenewalDate('')
    setNotes('')
    setCustomerPaymentTerms('')
    setSupplierPaymentTerms('')
    setEnduserName('')
    setEnduserEmail('')
    setEnduserContact('')
    setEnduserAddress('')
    setBillToAddress('')
    setShipToAddress('')
    setCustomerPOFile(null)
    setUploadedDocuments([null])
    setErrors({})
  }

  const handleAddDocumentRow = () => {
    setUploadedDocuments([...uploadedDocuments, null])
  }

  const handleDocumentChange = (index: number, file: File | null) => {
    const newDocuments = [...uploadedDocuments]
    newDocuments[index] = file
    setUploadedDocuments(newDocuments)
  }

  if (isEditLoading) return <div className="py-8 text-center text-gray-500">Loading OPF form...</div>

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/sales/opf')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to OPF
      </button>

      <div>
        <h1 className="crm-page-heading">Generate OPF</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: QUOTATION DETAILS */}
        <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
          <div className="grid gap-4 grid-cols-3">
            <FormField label="Quotation No" required error={errors.quotationNumber}>
              <SearchableSelect
                value={quotationNumber}
                onChange={handleQuotationChange}
                options={leads
                  .filter(lead => lead.quotationId)
                  .map(lead => lead.quotationId)}
                placeholder="Select Quotation"
                error={errors.quotationNumber}
              />
            </FormField>

            <FormField label="Customer Name" required error={errors.customerName}>
              <input
                type="text"
                value={customerName}
                readOnly
                className="w-full rounded-lg border border-[#EFECE5] bg-gray-100 px-3 py-2.5 text-sm"
              />
            </FormField>

            <FormField label="Contact Person">
              <input
                type="text"
                value={contactPerson}
                readOnly
                className="w-full rounded-lg border border-[#EFECE5] bg-gray-100 px-3 py-2.5 text-sm"
              />
            </FormField>
          </div>
        </div>

        <div className="border-b border-gray-300"></div>

        {/* SECTION 2: SUPPLIER/PRODUCT DETAILS */}
        <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
          <div className="grid gap-4 grid-cols-3">
            <FormField label="Supplier Name" required error={errors.supplierName}>
              <SearchableSelect
                value={supplierName}
                onChange={handleSupplierChange}
                options={suppliers.map(supplier => supplier.supplierName)}
                placeholder="Select Supplier"
                error={errors.supplierName}
              />
            </FormField>

            <FormField label="Supplier Contact Person" required error={errors.supplierContactPerson}>
              <input
                type="text"
                value={supplierContactPerson}
                onChange={(e) => setSupplierContactPerson(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                  errors.supplierContactPerson ? 'border-red-500' : 'border-[#EFECE5]'
                } bg-white focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`}
              />
            </FormField>

            <FormField label="Product" required error={errors.product}>
              <SearchableSelect
                value={product}
                onChange={(e) => setProduct(e)}
                options={productOptions}
                placeholder="Select or search product"
                error={errors.product}
              />
            </FormField>

            <FormField label="Description" required error={errors.description}>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                  errors.description ? 'border-red-500' : 'border-[#EFECE5]'
                } bg-white focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`}
              />
            </FormField>

            <FormField label="Quantity" required error={errors.quantity}>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                step="0.01"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                  errors.quantity ? 'border-red-500' : 'border-[#EFECE5]'
                } bg-white focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`}
              />
            </FormField>

            <FormField label="Unit Price" required error={errors.unitPrice}>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                step="0.01"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                  errors.unitPrice ? 'border-red-500' : 'border-[#EFECE5]'
                } bg-white focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`}
              />
            </FormField>

            <FormField label="Vendor Price" required error={errors.vendorPrice}>
              <input
                type="number"
                value={vendorPrice}
                onChange={(e) => setVendorPrice(e.target.value)}
                step="0.01"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                  errors.vendorPrice ? 'border-red-500' : 'border-[#EFECE5]'
                } bg-white focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`}
              />
            </FormField>

            <FormField label="Tax" required error={errors.tax}>
              <SearchableSelect
                value={tax}
                onChange={setTax}
                options={taxOptions.filter(option => option !== '--Select--')}
                placeholder="Select tax option"
                error={errors.tax}
              />
            </FormField>

            <FormField label="Part No">
              <input
                type="text"
                value={partNo}
                onChange={(e) => setPartNo(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Start Date" required error={errors.startDate}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                  errors.startDate ? 'border-red-500' : 'border-[#EFECE5]'
                } bg-white focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`}
              />
            </FormField>

            <FormField label="End Date" required error={errors.endDate}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                  errors.endDate ? 'border-red-500' : 'border-[#EFECE5]'
                } bg-white focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`}
              />
            </FormField>
          </div>
        </div>

        <div className="border-b border-gray-300"></div>

        {/* SECTION 3: SERVICE/PURCHASE/END USER DETAILS */}
        <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
          <div className="grid gap-4 grid-cols-3">
            <FormField label="Service Name">
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Service Cost">
              <input
                type="number"
                value={serviceCost}
                onChange={(e) => setServiceCost(e.target.value)}
                step="0.01"
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Service Tax (%)">
              <input
                type="number"
                value={serviceTax}
                onChange={(e) => setServiceTax(e.target.value)}
                step="0.01"
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Freight Name">
              <input
                type="text"
                value={freightName}
                onChange={(e) => setFreightName(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Freight Cost">
              <input
                type="number"
                value={freightCost}
                onChange={(e) => setFreightCost(e.target.value)}
                step="0.01"
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Freight Tax (%)">
              <input
                type="number"
                value={freightTax}
                onChange={(e) => setFreightTax(e.target.value)}
                step="0.01"
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="WHT (%)">
              <input
                type="number"
                value={wht}
                onChange={(e) => setWht(e.target.value)}
                step="0.01"
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Conversion Rate">
              <input
                type="number"
                value={conversionRate}
                onChange={(e) => setConversionRate(e.target.value)}
                step="0.01"
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Vendor Currency">
              <select
                value={vendorCurrency}
                onChange={(e) => setVendorCurrency(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {currencyOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>

            <FormField label="ETA">
              <input
                type="date"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Customer PO No">
              <input
                type="text"
                value={customerPONo}
                onChange={(e) => setCustomerPONo(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Customer PO Date">
              <input
                type="date"
                value={customerPODate}
                onChange={(e) => setCustomerPODate(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Customer PO File">
              <input
                type="file"
                onChange={(e) => setCustomerPOFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm"
              />
              {existingCustomerPOFile?.fileName && !customerPOFile && (
                <p className="mt-1 text-xs text-slate-500">Saved file: {existingCustomerPOFile.fileName}</p>
              )}
            </FormField>

            <FormField label="AMC">
              <select
                value={amc}
                onChange={(e) => {
                  setAmc(e.target.value)
                  // Clear AMC Renewal Date if AMC is set to "No"
                  if (e.target.value !== 'Yes') {
                    setAmcRenewalDate('')
                  }
                }}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="">Select</option>
                {amcOptions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </FormField>

            {amc === 'Yes' && (
              <FormField label="AMC Renewal Date" required>
                <input
                  type="date"
                  value={amcRenewalDate}
                  onChange={(e) => setAmcRenewalDate(e.target.value)}
                  className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                />
              </FormField>
            )}

            <FormField label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Customer Payment Terms">
              <select
                value={customerPaymentTerms}
                onChange={(e) => setCustomerPaymentTerms(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {paymentTermsOptions.map((t, index) => (
                  <option key={t} value={index === 0 ? '' : t}>{t}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Supplier Payment Terms">
              <select
                value={supplierPaymentTerms}
                onChange={(e) => setSupplierPaymentTerms(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {paymentTermsOptions.map((t, index) => (
                  <option key={t} value={index === 0 ? '' : t}>{t}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Enduser Name">
              <input
                type="text"
                value={enduserName}
                onChange={(e) => setEnduserName(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Enduser Email">
              <input
                type="email"
                value={enduserEmail}
                onChange={(e) => setEnduserEmail(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Enduser Contact">
              <input
                type="text"
                value={enduserContact}
                onChange={(e) => setEnduserContact(e.target.value)}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Enduser Address">
              <textarea
                value={enduserAddress}
                onChange={(e) => setEnduserAddress(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Bill To Address">
              <textarea
                value={billToAddress}
                onChange={(e) => setBillToAddress(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>

            <FormField label="Ship To Address">
              <textarea
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </FormField>
          </div>
        </div>

        <div className="border-b border-gray-300"></div>

        {/* DOCUMENT UPLOADS */}
        <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
          <div className="space-y-3">
            {existingUploadedDocuments.length > 0 && (
              <p className="text-xs text-slate-500">
                Saved documents: {existingUploadedDocuments.map((document) => document.fileName).filter(Boolean).join(', ')}
              </p>
            )}
            {uploadedDocuments.map((doc, index) => (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Document</label>
                  <input
                    type="file"
                    onChange={(e) => handleDocumentChange(index, e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddDocumentRow}
                  className="inline-flex items-center justify-center rounded-lg bg-green-600 p-2.5 text-white hover:bg-green-700 transition"
                  title="Add Document"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-b border-gray-300"></div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B] disabled:opacity-50"
          >
            Submit
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="rounded-lg border border-[#EFECE5] bg-white px-6 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[#F2EFE8]"
          >
            Reset
          </button>
        </div>
      </form>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  )
}
