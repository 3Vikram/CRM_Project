'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { createContact, fetchContactById, updateContact, type ContactPayload, type ContactRecord } from '@/lib/contactApi'

const phonePattern = /^\+?\d{10,15}$/
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
    if (!phonePattern.test(form.contactNumber.replace(/\s+/g, ''))) {
      setFieldErrors({ contactNumber: 'Please enter a valid mobile number.' })
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})
    try {
      const payload = { ...form, mail: form.email }
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Customer Name *</span>
              <input
                value={form.customerName || ''}
                onChange={(event) => handleChange('customerName', event.target.value)}
                placeholder="Customer Name"
                className={`w-full rounded-lg border ${fieldErrors.customerName ? 'border-red-500' : 'border-[#EFECE5]'} bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`}
              />
              {fieldErrors.customerName ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.customerName}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Contact Name *</span>
              <input value={form.contactName} onChange={(event) => handleChange('contactName', event.target.value)} placeholder="Contact Name" className={`w-full rounded-lg border ${fieldErrors.contactName ? 'border-red-500' : 'border-[#EFECE5]'} bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`} />
              {fieldErrors.contactName ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.contactName}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Designation *</span>
              <input value={form.designation} onChange={(event) => handleChange('designation', event.target.value)} placeholder="Designation" className={`w-full rounded-lg border ${fieldErrors.designation ? 'border-red-500' : 'border-[#EFECE5]'} bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`} />
              {fieldErrors.designation ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.designation}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Phone Number *</span>
              <input value={form.contactNumber} onChange={(event) => handleChange('contactNumber', event.target.value)} placeholder="Phone Number" className={`w-full rounded-lg border ${fieldErrors.contactNumber ? 'border-red-500' : 'border-[#EFECE5]'} bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`} />
              {fieldErrors.contactNumber ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.contactNumber}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email Address *</span>
              <input type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="Email Address" className={`w-full rounded-lg border ${fieldErrors.email ? 'border-red-500' : 'border-[#EFECE5]'} bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]`} />
              {fieldErrors.email ? <span className="mt-1 block text-xs text-red-500">{fieldErrors.email}</span> : null}
            </label>
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
