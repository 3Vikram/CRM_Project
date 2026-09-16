"use client"

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RotateCcw, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '@/components/toast'
import { fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi'
import { fetchEmployees, type EmployeeRecord } from '@/lib/employeeApi'
import { createLead } from '@/lib/leadApi'

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
  const [form, setForm] = useState(initialState)
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
    const resolvedContact = primaryContact?.name || selectedCustomer.email || ''

    if (resolvedContact && !form.contactPerson) {
      setForm((previous) => ({ ...previous, contactPerson: resolvedContact }))
    }
  }, [selectedCustomer, form.contactPerson])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!form.customerName.trim()) nextErrors.customerName = 'Customer Name is required'
    if (!form.contactPerson.trim()) nextErrors.contactPerson = 'Contact Person is required'
    if (!form.meetingDate.trim()) nextErrors.meetingDate = 'Meeting Date is required'
    if (!form.detailsOfRequirement.trim()) nextErrors.detailsOfRequirement = 'Details of Requirement is required'
    if (!form.product.trim()) nextErrors.product = 'Product is required'
    if (!form.value.trim() || Number(form.value) <= 0) nextErrors.value = 'Value is required'
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
      const normalizedValue = Number(form.value) || 0
      const normalizedRevenue = Number(form.revenue) || normalizedValue
      const finalStage = form.stage || 'Proposal Sent'
      const details = [form.detailsOfRequirement, form.sbu ? `SBU: ${form.sbu}` : '', form.oem ? `OEM: ${form.oem}` : ''].filter(Boolean).join(' | ')
      const resourceNote = form.tagResource ? `Tag Resource: ${form.tagResource}` : ''

      const payload = {
        companyName: form.customerName,
        contactPerson: form.contactPerson,
        createdBy: 'System',
        createdDate: new Date().toISOString(),
        sourceOfLead: 'Manual',
        leadStatus: finalStage === 'Proposal Sent' ? 'Proposal Sent' : 'Qualified',
        priority: 'Medium',
        customerRequirements: details,
        remarks: [form.remarks, resourceNote, form.probability ? `Probability: ${form.probability}` : '', form.demo ? `Demo: ${form.demo}` : '', form.poc ? `POC: ${form.poc}` : ''].filter(Boolean).join(' | '),
        products: [
          {
            productName: form.product,
            productDescription: details,
            quantity: 1,
            unitPrice: normalizedValue,
            tax: 'CGST + SGST 18%',
          },
        ],
        quotationDetails: {
          expectedClosure: form.expectedDateOfClosure,
          delivery: form.meetingDate,
          validity: '30',
          payment: 'As per discussion',
          note: details,
          subject: form.product,
        },
      }

      await createLead(payload)
      setToast('Funnel saved successfully')
      navigate('/sales/funnels')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to save funnel')
    }
  }

  const resetForm = () => {
    setForm(initialState)
    setErrors({})
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <button type="button" onClick={() => navigate('/sales/funnels')} className="inline-flex items-center gap-2 text-sm font-medium text-[#111827] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Funnel
        </button>
        <h1 className="crm-page-heading">GENERATE FUNNEL</h1>
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
              <input
                name="contactPerson"
                value={form.contactPerson}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
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
              <input
                list="funnel-product-options"
                name="product"
                value={form.product}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
              <datalist id="funnel-product-options">
                {customers.flatMap((customer) => customer.contacts || []).map((contact) => contact.name).filter(Boolean).map((item) => (
                  <option key={item} value={item} />
                ))}
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <option key={employee._id} value={employee.employeeName || employee.fullName || employee.email || ''} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-1">
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
            <Save className="h-4 w-4" /> Submit
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
