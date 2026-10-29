"use client"

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, RotateCcw, Save } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Toast } from '@/sales/components/toast'
import { fetchCustomers, type CustomerApiRecord } from '@/sales/lib/customerApi'
import { fetchEmployees, type EmployeeRecord } from '@/sales/lib/employeeApi'
import { createLead, fetchLeadById, updateLead, type LeadRecord } from '@/sales/lib/leadApi'

const stageOptions = ['New', 'Contacted', 'Follow-up', 'Interested', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Scrapped']
const probabilityOptions = ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%']
const yesNoOptions = ['Yes', 'No']
const oemOptions = ['Dell', 'HP', 'Lenovo', 'Cisco', 'Microsoft', 'Acer', 'ASUS', 'Synology', 'Fortinet', 'Other']

const initialState = {
  customerName: '',
  contactPerson: '',
  meetingDate: '',
  detailsOfRequirement: '',
  product: '',
  sbu: '',
  oem: '',
  value: '',
  revenue: '',
  marginPercent: '',
  stage: 'Proposal Sent',
  probability: '50%',
  demo: 'No',
  poc: 'No',
  expectedDateOfClosure: '',
  tagResource: '',
  remarks: '',
}

export default function FunnelFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const [form, setForm] = useState(initialState)
  const [additionalProducts, setAdditionalProducts] = useState<Array<{ product: string; value: string }>>([])
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([])
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadData = async () => {
      try {
        const [customerResponse, employeeResponse] = await Promise.all([
          fetchCustomers({ limit: 1000, fresh: true }),
          fetchEmployees({ limit: 1000, status: 'Active' }),
        ])

        setCustomers(customerResponse.data || [])
        setEmployees(employeeResponse.data || [])
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load customer and employee data')
      }
    }

    void loadData()
  }, [])

  useEffect(() => {
    if (!id) return

    const loadFunnel = async () => {
      try {
        const funnel = await fetchLeadById(id)
        if (!funnel) throw new Error('Funnel record was not found.')

        const detailsParts = (funnel.customerRequirements || '').split(' | ')
        const getDetailsValue = (label: string) => detailsParts.find((part) => part.startsWith(`${label}: `))?.slice(label.length + 2) || ''
        const legacyRemarks = (funnel.remarks || '').split(' | ')
        const getRemarkValue = (label: string) => legacyRemarks.find((part) => part.startsWith(`${label}: `))?.slice(label.length + 2) || ''
        const products = funnel.products || []
        const savedDetails = detailsParts.filter((part) => !part.startsWith('SBU: ') && !part.startsWith('OEM: ')).join(' | ')
        const savedRemarks = legacyRemarks.filter((part) => !['Tag Resource: ', 'Probability: ', 'Demo: ', 'POC: '].some((prefix) => part.startsWith(prefix))).join(' | ')

        setForm({
          ...initialState,
          customerName: funnel.companyName || '',
          contactPerson: funnel.contactPerson || '',
          meetingDate: funnel.quotationDetails?.delivery?.slice(0, 10) || '',
          detailsOfRequirement: savedDetails || funnel.customerRequirements || '',
          product: products[0]?.productName || '',
          sbu: funnel.quotationDetails?.sbu || getDetailsValue('SBU'),
          oem: funnel.quotationDetails?.oem || getDetailsValue('OEM'),
          value: String(products[0]?.unitPrice ?? funnel.quotationDetails?.value ?? ''),
          revenue: String(funnel.quotationDetails?.revenue ?? ''),
          marginPercent: String(funnel.quotationDetails?.marginPercent ?? ''),
          stage: funnel.quotationDetails?.stage || funnel.leadStatus || initialState.stage,
          probability: funnel.quotationDetails?.probability || getRemarkValue('Probability') || initialState.probability,
          demo: funnel.quotationDetails?.demo || getRemarkValue('Demo') || initialState.demo,
          poc: funnel.quotationDetails?.poc || getRemarkValue('POC') || initialState.poc,
          expectedDateOfClosure: funnel.quotationDetails?.expectedClosure?.slice(0, 10) || '',
          tagResource: funnel.quotationDetails?.tagResource || getRemarkValue('Tag Resource'),
          remarks: savedRemarks,
        })
        setAdditionalProducts(products.slice(1).map((product) => ({
          product: product.productName || '',
          value: String(product.unitPrice ?? ''),
        })))
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load funnel')
      }
    }

    void loadFunnel()
  }, [id])

  const selectedCustomer = useMemo(
    () => customers.find((customer) => {
      const candidateName = customer.companyName || customer.customerName || ''
      return candidateName.trim().toLowerCase() === form.customerName.trim().toLowerCase()
    }),
    [customers, form.customerName]
  )

  useEffect(() => {
    if (!selectedCustomer) return

    const customerContacts = selectedCustomer.contacts || []
    const primaryContact = customerContacts.find((contact) => contact.name) || customerContacts[0]
    const resolvedContact = primaryContact?.name || primaryContact?.email || selectedCustomer.email || ''

    if (resolvedContact && !form.contactPerson) {
      setForm((previous) => ({ ...previous, contactPerson: resolvedContact }))
    }
  }, [selectedCustomer, form.contactPerson])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === 'customerName' ? { contactPerson: '' } : {}),
    }))
  }

  const handleAdditionalProductChange = (index: number, field: 'product' | 'value', value: string) => {
    setAdditionalProducts((previous) => previous.map((product, rowIndex) => (
      rowIndex === index ? { ...product, [field]: value } : product
    )))
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!form.customerName.trim()) nextErrors.customerName = 'Customer Name is required'
    if (!form.contactPerson.trim()) nextErrors.contactPerson = 'Contact Person is required'
    if (!form.meetingDate.trim()) nextErrors.meetingDate = 'Meeting Date is required'
    if (!form.detailsOfRequirement.trim()) nextErrors.detailsOfRequirement = 'Details of Requirement is required'
    if (!form.product.trim()) nextErrors.product = 'Product is required'
    if (!form.value.trim() || Number(form.value) <= 0) nextErrors.value = 'Value is required'
    additionalProducts.forEach((product, index) => {
      if (!product.product.trim()) nextErrors[`product-${index}`] = 'Product is required'
      if (!product.value.trim() || Number(product.value) <= 0) nextErrors[`value-${index}`] = 'Value is required'
    })
    if (!form.marginPercent.trim() || Number(form.marginPercent) < 0) nextErrors.marginPercent = 'Margin (%) is required'
    if (!form.expectedDateOfClosure.trim()) nextErrors.expectedDateOfClosure = 'Expected Date of Closure is required'

    return nextErrors
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const nextErrors = validate()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      setToast('Please complete the required fields before submitting.')
      return
    }

    try {
      const productRows = [{ product: form.product, value: form.value }, ...additionalProducts]
      const normalizedValue = productRows.reduce((total, product) => total + (Number(product.value) || 0), 0)
      const normalizedRevenue = form.revenue.trim() ? Number(form.revenue) || 0 : normalizedValue
      const finalStage = form.stage || 'Proposal Sent'
      const resourceNote = form.tagResource ? `Tag Resource: ${form.tagResource}` : ''

      const payload: Partial<LeadRecord> = {
        companyName: form.customerName,
        contactPerson: form.contactPerson,
        ...(isEditing ? {} : { createdDate: new Date().toISOString(), sourceOfLead: 'Manual' }),
        leadStatus: finalStage,
        priority: 'Medium',
        customerRequirements: form.detailsOfRequirement,
        remarks: [form.remarks, resourceNote, form.probability ? `Probability: ${form.probability}` : '', form.demo ? `Demo: ${form.demo}` : '', form.poc ? `POC: ${form.poc}` : ''].filter(Boolean).join(' | '),
        products: productRows.map((product) => ({
            productName: product.product,
            productDescription: form.detailsOfRequirement,
            quantity: 1,
            unitPrice: Number(product.value) || 0,
            tax: 'CGST + SGST 18%',
          })),
        quotationDetails: {
          expectedClosure: form.expectedDateOfClosure,
          delivery: form.meetingDate,
          validity: '30',
          payment: 'As per discussion',
          note: form.detailsOfRequirement,
          subject: productRows.map((product) => product.product).join(', '),
          value: normalizedValue,
          revenue: normalizedRevenue,
          marginPercent: Number(form.marginPercent) || 0,
          sbu: form.sbu,
          oem: form.oem,
          stage: finalStage,
          probability: form.probability,
          demo: form.demo,
          poc: form.poc,
          tagResource: form.tagResource,
        },
      }

      if (id) {
        await updateLead(id, payload)
        setToast('Funnel updated successfully')
      } else {
        await createLead(payload)
        setToast('Funnel saved successfully')
      }
      navigate('/sales/funnels')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to save funnel')
    }
  }

  const resetForm = () => {
    setForm(initialState)
    setAdditionalProducts([])
    setErrors({})
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <button type="button" onClick={() => navigate('/sales/funnels')} className="inline-flex items-center gap-2 text-sm font-medium text-[#111827] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Funnel
        </button>
        <h1 className="crm-page-heading">{isEditing ? 'EDIT FUNNEL' : 'GENERATE FUNNEL'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Customer Name <span className="text-red-500">*</span></span>
              <select
                name="customerName"
                value={form.customerName}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer.companyName || customer.customerName || ''}>
                    {customer.companyName || customer.customerName || 'Unnamed Customer'}
                  </option>
                ))}
              </select>
              {errors.customerName && <span className="text-xs text-red-600">{errors.customerName}</span>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Contact Person <span className="text-red-500">*</span></span>
              <select
                name="contactPerson"
                value={form.contactPerson}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="">Select Contact Person</option>
                {(selectedCustomer?.contacts || []).filter((contact) => contact.name || contact.email).map((contact, index) => {
                  const contactName = contact.name || contact.email || ''
                  return <option key={`${contact.email || contactName}-${index}`} value={contactName}>{contactName}</option>
                })}
                {form.contactPerson && !selectedCustomer?.contacts?.some((contact) => (contact.name || contact.email) === form.contactPerson) ? (
                  <option value={form.contactPerson}>{form.contactPerson}</option>
                ) : null}
                {!selectedCustomer?.contacts?.length && selectedCustomer?.email ? (
                  <option value={selectedCustomer.email}>{selectedCustomer.email}</option>
                ) : null}
              </select>
              {errors.contactPerson && <span className="text-xs text-red-600">{errors.contactPerson}</span>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Meeting Date <span className="text-red-500">*</span></span>
              <input
                type="date"
                name="meetingDate"
                value={form.meetingDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
              {errors.meetingDate && <span className="text-xs text-red-600">{errors.meetingDate}</span>}
            </label>

            <label className="space-y-2 xl:col-span-1">
              <span className="text-sm font-semibold text-gray-700">Details of Requirement <span className="text-red-500">*</span></span>
              <input
                name="detailsOfRequirement"
                value={form.detailsOfRequirement}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
              {errors.detailsOfRequirement && <span className="text-xs text-red-600">{errors.detailsOfRequirement}</span>}
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Product <span className="text-red-500">*</span></span>
              <div className="flex items-center gap-2">
                <input
                  list="funnel-product-options"
                  name="product"
                  value={form.product}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                />
                <button
                  type="button"
                  aria-label="Add product row"
                  onClick={() => setAdditionalProducts((previous) => [...previous, { product: '', value: '' }])}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <datalist id="funnel-product-options">
                {['Laptop', 'Desktop', 'Server', 'Software', 'Networking', 'Storage', 'Cloud', 'Support'].map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              {errors.product && <span className="text-xs text-red-600">{errors.product}</span>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">SBU</span>
              <input
                name="sbu"
                value={form.sbu}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">OEM</span>
              <select
                name="oem"
                value={form.oem}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="">Select OEM</option>
                {oemOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Value <span className="text-red-500">*</span></span>
              <input
                type="number"
                min="0"
                step="0.01"
                name="value"
                value={form.value}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
              {errors.value && <span className="text-xs text-red-600">{errors.value}</span>}
            </label>
          </div>

          {additionalProducts.map((product, index) => (
            <div key={`additional-product-${index}`} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-700">Product {index + 2} <span className="text-red-500">*</span></span>
                <input
                  list="funnel-product-options"
                  value={product.product}
                  onChange={(event) => handleAdditionalProductChange(index, 'product', event.target.value)}
                  className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                />
                {errors[`product-${index}`] && <span className="text-xs text-red-600">{errors[`product-${index}`]}</span>}
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-700">Value <span className="text-red-500">*</span></span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={product.value}
                  onChange={(event) => handleAdditionalProductChange(index, 'value', event.target.value)}
                  className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
                />
                {errors[`value-${index}`] && <span className="text-xs text-red-600">{errors[`value-${index}`]}</span>}
              </label>
            </div>
          ))}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Revenue</span>
              <input
                type="number"
                min="0"
                step="0.01"
                name="revenue"
                value={form.revenue}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Margin(%) <span className="text-red-500">*</span></span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                name="marginPercent"
                value={form.marginPercent}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
              {errors.marginPercent && <span className="text-xs text-red-600">{errors.marginPercent}</span>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Stage</span>
              <select
                name="stage"
                value={form.stage}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {stageOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Probability</span>
              <select
                name="probability"
                value={form.probability}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="">Select</option>
                {probabilityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Demo</span>
              <select
                name="demo"
                value={form.demo}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="">Select</option>
                {yesNoOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">POC</span>
              <select
                name="poc"
                value={form.poc}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                <option value="">Select</option>
                {yesNoOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Expected Date of Closure <span className="text-red-500">*</span></span>
              <input
                type="date"
                name="expectedDateOfClosure"
                value={form.expectedDateOfClosure}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
              {errors.expectedDateOfClosure && <span className="text-xs text-red-600">{errors.expectedDateOfClosure}</span>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Tag a Resource</span>
              <input
                list="funnel-resource-options"
                name="tagResource"
                value={form.tagResource}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
              <datalist id="funnel-resource-options">
                {employees.map((employee) => (
                  <option key={employee._id} value={employee.email || ''} />
                ))}
              </datalist>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-700">Remarks</span>
              <textarea
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </label>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B]">
            <Save className="h-4 w-4" /> {isEditing ? 'Update' : 'Submit'}
          </button>
          <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-[#E7E3DA]">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </form>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  )
}
