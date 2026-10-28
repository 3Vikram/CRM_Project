'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { createContact, fetchContactById, fetchEmployeeBatchGroups, updateContact, type ContactPayload, type ContactRecord, type EmployeeBatchSummary } from '@/sales/lib/contactApi'
import { getStoredAuth } from '@/sales/lib/auth'
import { PHONE_ERROR_MESSAGE, isValidPhoneNumber, sanitizePhoneInput } from '@/sales/lib/phone'

type RequiredContactField = 'customerName' | 'contactName' | 'designation' | 'contactNumber' | 'email'
type ContactFieldErrors = Partial<Record<RequiredContactField, string>>

export default function ContactFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const [form, setForm] = useState<ContactPayload>({
    contactName: '',
    designation: '',
    mail: '',
    contactNumber: '',
    email: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({})
  const [batchOptions, setBatchOptions] = useState<EmployeeBatchSummary[]>([])
  const [batchId, setBatchId] = useState('')

  useEffect(() => {
    if (!isEditing || !id) return
    const loadContact = async () => {
      const contact = (await fetchContactById(id)) as ContactRecord | null
      if (contact) {
        setForm({
          customerId: contact.customerId || '',
          customerName: contact.customerName || '',
          contactName: contact.contactName,
          designation: contact.designation,
          mail: contact.mail || '',
          contactNumber: contact.contactNumber,
          email: contact.email,
        })
      }
    }
    void loadContact()
  }, [id, isEditing])

  useEffect(() => {
    if (isEditing) return
    const currentUserId = String(getStoredAuth()?.user?.id || '')
    void fetchEmployeeBatchGroups()
      .then((groups) => {
        const ownGroup = groups.find((group) => String(group.employeeId) === currentUserId)
        setBatchOptions(ownGroup?.batches || [])
      })
      .catch(() => setBatchOptions([]))
  }, [isEditing])

  const handleChange = (field: keyof ContactPayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value, ...(field === 'customerName' ? { customerId: '' } : {}) }))
    if (field in fieldErrors) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field as RequiredContactField]
        return next
      })
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    const nextFieldErrors: ContactFieldErrors = {}
    if (!form.customerName?.trim()) nextFieldErrors.customerName = 'Customer Name is required.'
    if (!form.contactName.trim()) nextFieldErrors.contactName = 'Contact Name is required.'
    if (!form.designation.trim()) nextFieldErrors.designation = 'Designation is required.'
    if (!form.contactNumber.trim()) nextFieldErrors.contactNumber = 'Phone Number is required.'
    if (!form.email.trim()) nextFieldErrors.email = 'Email Address is required.'

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      return
    }
    if (!isValidPhoneNumber(form.contactNumber)) {
      setFieldErrors({ contactNumber: PHONE_ERROR_MESSAGE })
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})
    try {
      const payload = { ...form, mail: form.email, ...(!isEditing && batchId ? { batchId } : {}) }
      if (isEditing && id) {
        await updateContact(id, payload)
      } else {
        await createContact(payload)
      }
      navigate('/sales/contacts')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save contact')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => navigate('/sales/contacts')} className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts List
        </button>
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <h1 className="crm-page-heading">{isEditing ? 'Edit Contact' : 'Add Contact'}</h1>
        <form onSubmit={handleSubmit} className="crm-form space-y-4">
          {submitError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Customer Name <span className="required-asterisk">*</span></span>
              <input
                value={form.customerName || ''}
                onChange={(event) => handleChange('customerName', event.target.value)}
                placeholder="Enter customer name"
                className={`crm-input ${fieldErrors.customerName ? 'crm-input-invalid' : ''}`}
                aria-invalid={Boolean(fieldErrors.customerName)}
              />
              {fieldErrors.customerName ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.customerName}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Contact Name <span className="required-asterisk">*</span></span>
              <input value={form.contactName} onChange={(event) => handleChange('contactName', event.target.value)} placeholder="Enter contact name" className={`crm-input ${fieldErrors.contactName ? 'crm-input-invalid' : ''}`} aria-invalid={Boolean(fieldErrors.contactName)} />
              {fieldErrors.contactName ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.contactName}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Designation <span className="required-asterisk">*</span></span>
              <input value={form.designation} onChange={(event) => handleChange('designation', event.target.value)} placeholder="Enter designation" className={`crm-input ${fieldErrors.designation ? 'crm-input-invalid' : ''}`} aria-invalid={Boolean(fieldErrors.designation)} />
              {fieldErrors.designation ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.designation}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Phone Number <span className="required-asterisk">*</span></span>
              <input type="tel" value={form.contactNumber} onChange={(event) => handleChange('contactNumber', sanitizePhoneInput(event.target.value))} inputMode="numeric" maxLength={10} placeholder="Enter phone number" className={`crm-input ${fieldErrors.contactNumber ? 'crm-input-invalid' : ''}`} aria-invalid={Boolean(fieldErrors.contactNumber)} />
              {fieldErrors.contactNumber ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.contactNumber}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email Address <span className="required-asterisk">*</span></span>
              <input type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="Enter email address" className={`crm-input ${fieldErrors.email ? 'crm-input-invalid' : ''}`} aria-invalid={Boolean(fieldErrors.email)} />
              {fieldErrors.email ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.email}</span> : null}
            </label>
            {!isEditing ? (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Batch</span>
                <select
                  value={batchId}
                  onChange={(event) => setBatchId(event.target.value)}
                  className="crm-input"
                >
                  <option value="">No batch</option>
                  {batchOptions.map((batch) => (
                    <option key={batch._id} value={batch._id}>{batch.name} ({batch.count} contacts)</option>
                  ))}
                </select>
                {batchOptions.length === 0 ? <span className="mt-1 block text-xs text-slate-500">No batches yet. The contact will be saved without a batch.</span> : null}
              </label>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#EFECE5] pt-4">
            <button type="button" onClick={() => navigate('/sales/contacts')} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E293B] disabled:opacity-60">{isSubmitting ? 'Submitting...' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
