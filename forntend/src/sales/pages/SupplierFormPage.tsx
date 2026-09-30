'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { createSupplier, fetchCountriesForSuppliers, fetchProductsForSuppliers, fetchStatesForSuppliers, fetchSupplierById, updateSupplier, type SupplierPayload } from '@/lib/supplierApi'
import { ArrowLeft } from 'lucide-react'

const paymentTermsOptions = [
  'As per MSA',
  '100% Advance',
  '50% Advance and 50% After Delivery',
  '30 Days',
  '45 Days',
  '60 Days',
  '90 Days',
  'Cash on Delivery',
  'Other',
]

const contactTypeOptions = ['Accounts', 'Production', 'Marketing', 'Finance', 'Management', 'Technical', 'Purchase', 'Sales', 'Administration', 'Other']

const categoryOptions = ['Mass', 'RKAM', 'NKAM', 'Laptop', 'Masks', 'Other']

export default function SupplierFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const [expanded, setExpanded] = useState('company')
  const [countries, setCountries] = useState<Array<{ name: string }>>([])
  const [states, setStates] = useState<Array<{ name: string }>>([])
  const [products, setProducts] = useState<string[]>([])
  const [form, setForm] = useState<SupplierPayload>({
    supplierName: '',
    gstNumber: '',
    category: '',
    paymentTerms: '',
    addressLine1: '',
    country: '',
    state: '',
    city: '',
    pinCode: '',
    bankName: '',
    bankAddress: '',
    accountHolder: '',
    accountNumber: '',
    ifscCode: '',
    loginEmailId: '',
    loginPassword: '',
    contactType: '',
    contactName: '',
    designation: '',
    emailId: '',
    contactNumber: '',
    product: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  useEffect(() => {
    const loadMeta = async () => {
      const nextCountries = await fetchCountriesForSuppliers()
      setCountries(nextCountries)
      const nextProducts = await fetchProductsForSuppliers()
      setProducts(nextProducts)
    }
    void loadMeta()
  }, [])

  useEffect(() => {
    if (!isEditing || !id) return
    const loadSupplier = async () => {
      const supplier = await fetchSupplierById(id)
      if (supplier) {
        setForm({
          supplierName: supplier.supplierName || '',
          gstNumber: supplier.gstNumber || '',
          category: supplier.category || '',
          paymentTerms: supplier.paymentTerms || '',
          addressLine1: supplier.addressLine1 || '',
          country: supplier.country || '',
          state: supplier.state || '',
          city: supplier.city || '',
          pinCode: supplier.pinCode || '',
          bankName: supplier.bankName || '',
          bankAddress: supplier.bankAddress || '',
          accountHolder: supplier.accountHolder || '',
          accountNumber: supplier.accountNumber || '',
          ifscCode: supplier.ifscCode || '',
          loginEmailId: supplier.loginEmailId || '',
          loginPassword: supplier.loginPassword || '',
          contactType: supplier.contactType || '',
          contactName: supplier.contactName || '',
          designation: supplier.designation || '',
          emailId: supplier.emailId || '',
          contactNumber: supplier.contactNumber || '',
          product: supplier.product || '',
        })
      }
    }
    void loadSupplier()
  }, [id, isEditing])

  useEffect(() => {
    if (!form.country) {
      setStates([])
      return
    }
    const loadStates = async () => {
      const nextStates = await fetchStatesForSuppliers(form.country)
      setStates(nextStates)
    }
    void loadStates()
  }, [form.country])

  const handleChange = (field: keyof SupplierPayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.supplierName.trim() || !form.category.trim() || !form.paymentTerms.trim() || !form.addressLine1.trim() || !form.country.trim() || !form.state.trim()) {
      setSubmitError('Supplier Name, Category, Payment Terms, Address, Country, and State are required.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    try {
      if (isEditing && id) {
        await updateSupplier(id, form)
      } else {
        await createSupplier(form)
      }
      setSubmitSuccess('Supplier saved successfully.')
      navigate('/sales/suppliers', { state: { message: 'Supplier saved successfully.' }, replace: true })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save supplier')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setForm({
      supplierName: '',
      gstNumber: '',
      category: '',
      paymentTerms: '',
      addressLine1: '',
      country: '',
      state: '',
      city: '',
      pinCode: '',
      bankName: '',
      bankAddress: '',
      accountHolder: '',
      accountNumber: '',
      ifscCode: '',
      loginEmailId: '',
      loginPassword: '',
      contactType: '',
      contactName: '',
      designation: '',
      emailId: '',
      contactNumber: '',
      product: '',
    })
    setExpanded('company')
  }

  const panelClass = 'rounded-lg border border-[#EFECE5] bg-white px-4 py-2 shadow-sm'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => navigate('/sales/suppliers')} className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <ArrowLeft className="h-4 w-4" />
          Back to Supplier List
        </button>
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <h1 className="crm-page-heading">{isEditing ? 'Edit Supplier' : 'INPUT SUPPLIER DETAILS'}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
          {submitSuccess ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{submitSuccess}</div> : null}

          <Accordion expanded={expanded === 'company'} onChange={() => setExpanded(expanded === 'company' ? '' : 'company')} className={panelClass}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <span className="text-sm font-semibold text-slate-700">1. Company Information</span>
            </AccordionSummary>
            <AccordionDetails>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Supplier Name *</span>
                  <input value={form.supplierName} onChange={(event) => handleChange('supplierName', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">GST Number</span>
                  <input value={form.gstNumber} onChange={(event) => handleChange('gstNumber', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Category *</span>
                  <select value={form.category} onChange={(event) => handleChange('category', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]">
                    <option value="">Select category</option>
                    {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Payment Terms *</span>
                  <select value={form.paymentTerms} onChange={(event) => handleChange('paymentTerms', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]">
                    <option value="">Select payment terms</option>
                    {paymentTermsOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Address Line 1 *</span>
                  <input value={form.addressLine1} onChange={(event) => handleChange('addressLine1', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Country *</span>
                  <select value={form.country} onChange={(event) => handleChange('country', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]">
                    <option value="">Select country</option>
                    {countries.map((country) => <option key={country.name} value={country.name}>{country.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">State *</span>
                  <select value={form.state} onChange={(event) => handleChange('state', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" disabled={!form.country}>
                    <option value="">Select state</option>
                    {states.map((state) => <option key={state.name} value={state.name}>{state.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">City</span>
                  <input value={form.city} onChange={(event) => handleChange('city', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Pin Code</span>
                  <input value={form.pinCode} onChange={(event) => handleChange('pinCode', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
              </div>
            </AccordionDetails>
          </Accordion>

          <Accordion expanded={expanded === 'bank'} onChange={() => setExpanded(expanded === 'bank' ? '' : 'bank')} className={panelClass}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <span className="text-sm font-semibold text-slate-700">2. Bank Details</span>
            </AccordionSummary>
            <AccordionDetails>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Bank Name</span>
                  <input value={form.bankName} onChange={(event) => handleChange('bankName', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Bank Address</span>
                  <input value={form.bankAddress} onChange={(event) => handleChange('bankAddress', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Account Holder</span>
                  <input value={form.accountHolder} onChange={(event) => handleChange('accountHolder', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Account Number</span>
                  <input value={form.accountNumber} onChange={(event) => handleChange('accountNumber', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">IFSC Code</span>
                  <input value={form.ifscCode} onChange={(event) => handleChange('ifscCode', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Login Email ID</span>
                  <input value={form.loginEmailId} onChange={(event) => handleChange('loginEmailId', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Login Password</span>
                  <input type="password" value={form.loginPassword} onChange={(event) => handleChange('loginPassword', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
              </div>
            </AccordionDetails>
          </Accordion>

          <Accordion expanded={expanded === 'contact'} onChange={() => setExpanded(expanded === 'contact' ? '' : 'contact')} className={panelClass}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <span className="text-sm font-semibold text-slate-700">3. Contact Information</span>
            </AccordionSummary>
            <AccordionDetails>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Contact Type</span>
                  <select value={form.contactType} onChange={(event) => handleChange('contactType', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]">
                    <option value="">Select contact type</option>
                    {contactTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
                  <input value={form.contactName} onChange={(event) => handleChange('contactName', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Designation</span>
                  <input value={form.designation} onChange={(event) => handleChange('designation', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Email ID</span>
                  <input value={form.emailId} onChange={(event) => handleChange('emailId', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Contact Number</span>
                  <input value={form.contactNumber} onChange={(event) => handleChange('contactNumber', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Product</span>
                  <select value={form.product} onChange={(event) => handleChange('product', event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]">
                    <option value="">Select product</option>
                    {products.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
            </AccordionDetails>
          </Accordion>

          <div className="flex items-center justify-end gap-3 border-t border-[#EFECE5] pt-4">
            <button type="button" onClick={handleReset} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-semibold text-slate-700">Reset</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E293B] disabled:opacity-60">{isSubmitting ? 'Submitting...' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
