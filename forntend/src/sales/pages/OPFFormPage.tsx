'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Toast } from '@/components/toast'
import { createOPF, fetchOPFById, updateOPF, type OPFRecord } from '@/lib/opfApi'
import { fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi'

const approvalStatusOptions = ['Pending', 'Approved', 'Rejected', 'Under Review']

export default function OPFFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const [form, setForm] = useState({
    opfNo: '',
    createdBy: window.localStorage.getItem('userName') || 'Admin',
    quotationNumber: '',
    customerId: '',
    customerName: '',
    contactPerson: '',
    product: '',
    revenue: '',
    margin: '',
    renewalDate: '',
    approvalStatus: 'Pending',
  })

  const [poFile, setPoFile] = useState<File | null>(null)
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await fetchCustomers({ limit: 1000 })
        setCustomers(response.data || [])
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load customers')
      }
    }

    const loadOPF = async () => {
      if (!isEditMode || !id) return

      setIsLoading(true)
      try {
        const opf = await fetchOPFById(id)
        if (opf) {
          setForm({
            opfNo: opf.opfNo || '',
            createdBy: opf.createdBy || 'Admin',
            quotationNumber: opf.quotationNumber || '',
            customerId: opf.customerId || '',
            customerName: opf.customerName || '',
            contactPerson: opf.contactPerson || '',
            product: opf.product || '',
            revenue: String(opf.revenue || ''),
            margin: String(opf.margin || ''),
            renewalDate: opf.renewalDate ? opf.renewalDate.split('T')[0] : '',
            approvalStatus: opf.approvalStatus || 'Pending',
          })
        }
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load OPF')
      } finally {
        setIsLoading(false)
      }
    }

    void loadCustomers()
    void loadOPF()
  }, [id, isEditMode])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleCustomerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCustomerId = event.target.value
    const selected = customers.find((c) => c._id === selectedCustomerId)

    setForm((prev) => ({
      ...prev,
      customerId: selectedCustomerId,
      customerName: selected?.companyName || selected?.customerName || '',
      contactPerson: selected?.contacts?.[0]?.name || '',
    }))
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setPoFile(file)
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!form.quotationNumber.trim()) newErrors.quotationNumber = 'Quotation Number is required'
    if (!form.customerName.trim()) newErrors.customerName = 'Customer Name is required'
    if (!form.product.trim()) newErrors.product = 'Product is required'
    if (!form.renewalDate) newErrors.renewalDate = 'Renewal Date is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!validate()) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, String(value))
      })

      if (poFile) {
        formData.append('poFile', poFile)
      }

      if (isEditMode && id) {
        await updateOPF(id, formData)
        setToast('OPF updated successfully')
      } else {
        await createOPF(formData)
        setToast('OPF created successfully')
      }

      setTimeout(() => navigate('/sales/opf'), 500)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Failed to save OPF')
    } finally {
      setIsLoading(false)
    }
  }

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
        <h1 className="crm-page-heading">{isEditMode ? 'Edit OPF' : 'Create OPF'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">OPF Information</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Quotation Number *</span>
              <input
                type="text"
                name="quotationNumber"
                value={form.quotationNumber}
                onChange={handleChange}
                placeholder="E.g., SIQ/S/2026-27/002"
                className={`crm-input form-control ${errors.quotationNumber ? 'border-red-500' : ''}`}
              />
              {errors.quotationNumber && <p className="text-xs text-red-600">{errors.quotationNumber}</p>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Customer Name *</span>
              <select
                value={form.customerId}
                onChange={handleCustomerChange}
                className={`crm-input form-control ${errors.customerName ? 'border-red-500' : ''}`}
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.companyName || customer.customerName}
                  </option>
                ))}
              </select>
              {errors.customerName && <p className="text-xs text-red-600">{errors.customerName}</p>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Contact Person</span>
              <input
                type="text"
                name="contactPerson"
                value={form.contactPerson}
                onChange={handleChange}
                placeholder="Contact person name"
                className="crm-input form-control"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Product *</span>
              <input
                type="text"
                name="product"
                value={form.product}
                onChange={handleChange}
                placeholder="E.g., HP Z2 Workstation"
                className={`crm-input form-control ${errors.product ? 'border-red-500' : ''}`}
              />
              {errors.product && <p className="text-xs text-red-600">{errors.product}</p>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Revenue</span>
              <input
                type="number"
                name="revenue"
                value={form.revenue}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                className="crm-input form-control"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Margin</span>
              <input
                type="number"
                name="margin"
                value={form.margin}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                className="crm-input form-control"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Renewal Date *</span>
              <input
                type="date"
                name="renewalDate"
                value={form.renewalDate}
                onChange={handleChange}
                className={`crm-input form-control ${errors.renewalDate ? 'border-red-500' : ''}`}
              />
              {errors.renewalDate && <p className="text-xs text-red-600">{errors.renewalDate}</p>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Approval Status</span>
              <select
                name="approvalStatus"
                value={form.approvalStatus}
                onChange={handleChange}
                className="crm-input form-control"
              >
                {approvalStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Created By</span>
              <input
                type="text"
                value={form.createdBy}
                disabled
                className="crm-input form-control bg-gray-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">PO File</span>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="crm-input form-control"
              />
              <p className="text-xs text-gray-500">Accepted: PDF, DOC, DOCX, JPG, PNG (Max 5MB)</p>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B] disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save OPF'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales/opf')}
            className="rounded-lg border border-[#EFECE5] bg-white px-6 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[#F2EFE8]"
          >
            Cancel
          </button>
        </div>
      </form>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  )
}
