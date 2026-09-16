'use client'

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, Plus, RefreshCcw, Save, Upload } from 'lucide-react'
import { Country, State, City } from 'country-state-city'
import Select from 'react-select'
import {
  createCustomer,
  fetchCustomerById,
  updateCustomer,
  type CustomerApiRecord,
  type CustomerPayload,
} from '@/lib/customerApi'

interface ContactItem {
  id: string
  contactType: string
  name: string
  email: string
  phone: string
  designation: string
}

interface DocumentItem {
  id: string
  fileName: string
  fileType: string
  size: number
  file?: File
}

interface CustomerFormState {
  companyName: string
  state: string
  gstNumber: string
  billingAddressLine: string
  billingCountry: string
  billingState: string
  billingCity: string
  billingArea: string
  billingPinCode: string
  billingContactNumber: string
  billingEmail: string
  status: 'Active' | 'Inactive'
  accountType: string
  createdBy: string
  notes: string
  contacts: ContactItem[]
  documents: DocumentItem[]
}

interface LocationOption {
  name: string
  code?: string
  isoCode?: string
  countryCode?: string
  stateCode?: string
}

interface SelectOption {
  label: string
  value: string
  code?: string
  isoCode?: string
  countryCode?: string
  stateCode?: string
}

type SectionKey = 'company' | 'billing' | 'contact' | 'documents'

const contactTypeOptions = ['Accounts', 'Production', 'Marketing', 'Finance', 'Management']

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    minHeight: '44px',
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#111827' : '#e2e8f0',
    boxShadow: 'none',
    '&:hover': {
      borderColor: '#111827',
    },
    backgroundColor: '#ffffff',
  }),
  placeholder: (base: Record<string, unknown>) => ({ ...base, color: '#94a3b8' }),
  singleValue: (base: Record<string, unknown>) => ({ ...base, color: '#0f172a' }),
  menu: (base: Record<string, unknown>) => ({ ...base, zIndex: 50, borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #EFECE5' }),
  option: (base: Record<string, unknown>, state: { isFocused: boolean; isSelected: boolean }) => ({
    ...base,
    backgroundColor: state.isSelected ? '#111827' : state.isFocused ? '#F2EFE8' : '#ffffff',
    color: state.isSelected ? '#ffffff' : '#0f172a',
  }),
}

const filterByInput = (option: { label: string }, inputValue: string) => {
  return option.label.toLowerCase().includes(inputValue.toLowerCase())
}

const emptyForm: CustomerFormState = {
  companyName: '',
  state: '',
  gstNumber: '',
  billingAddressLine: '',
  billingCountry: '',
  billingState: '',
  billingCity: '',
  billingArea: '',
  billingPinCode: '',
  billingContactNumber: '',
  billingEmail: '',
  status: 'Active',
  accountType: 'Individual',
  createdBy: 'Admin',
  notes: '',
  contacts: [
    {
      id: crypto.randomUUID(),
      contactType: 'Accounts',
      name: '',
      email: '',
      phone: '',
      designation: '',
    },
  ],
  documents: [],
}

export default function CustomerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState<CustomerFormState>(emptyForm)
  const [activeSection, setActiveSection] = useState<SectionKey | null>('company')
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [countries, setCountries] = useState<LocationOption[]>([])
  const [states, setStates] = useState<LocationOption[]>([])
  const [cities, setCities] = useState<LocationOption[]>([])
  const [companyStateOptions, setCompanyStateOptions] = useState<SelectOption[]>([])

  useEffect(() => {
    const allCountries = Country.getAllCountries()
      .map((country) => ({
        name: country.name,
        code: country.isoCode,
        isoCode: country.isoCode,
      }))
      .sort((left, right) => left.name.localeCompare(right.name))

    const allStates = State.getAllStates()
      .map((state) => ({
        label: state.name,
        value: state.name,
        code: state.isoCode,
        isoCode: state.isoCode,
        countryCode: state.countryCode,
      }))
      .sort((left, right) => left.label.localeCompare(right.label))

    setCountries(allCountries)
    setCompanyStateOptions(allStates)
  }, [])

  useEffect(() => {
    if (!form.billingCountry) {
      setStates([])
      setCities([])
      return
    }

    const selectedCountry = countries.find((entry) => entry.name === form.billingCountry)
    if (!selectedCountry?.isoCode) {
      setStates([])
      setCities([])
      return
    }

    const countryStates = State.getStatesOfCountry(selectedCountry.isoCode)
      .map((state) => ({
        name: state.name,
        code: state.isoCode,
        isoCode: state.isoCode,
        countryCode: state.countryCode,
      }))
      .sort((left, right) => left.name.localeCompare(right.name))

    setStates(countryStates)
    setCities([])
  }, [countries, form.billingCountry])

  useEffect(() => {
    if (!form.billingState) {
      setCities([])
      return
    }

    const selectedCountry = countries.find((entry) => entry.name === form.billingCountry)
    const selectedState = states.find((entry) => entry.name === form.billingState)
    if (!selectedCountry?.isoCode || !selectedState?.isoCode) {
      setCities([])
      return
    }

    const stateCities = City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode)
      .map((city) => ({
        name: city.name,
        code: city.stateCode,
        isoCode: city.stateCode,
        countryCode: city.countryCode,
        stateCode: city.stateCode,
      }))
      .sort((left, right) => left.name.localeCompare(right.name))

    setCities(stateCities)
  }, [countries, form.billingCountry, form.billingState, states])

  useEffect(() => {
    if (!isEditing) return

    const loadCustomer = async () => {
      try {
        const response = await fetchCustomerById(id as string)
        const customer = response.data as CustomerApiRecord
        const primaryContact = customer.contacts?.[0]
        setForm({
          companyName: customer.companyName || customer.customerName || '',
          state: customer.state || '',
          gstNumber: customer.gstNumber || '',
          billingAddressLine: customer.billToAddress?.addressLine1 || '',
          billingCountry: customer.billToAddress?.country || '',
          billingState: customer.billToAddress?.state || '',
          billingCity: customer.billToAddress?.city || '',
          billingArea: customer.billToAddress?.area || '',
          billingPinCode: customer.billToAddress?.pincode || '',
          billingContactNumber: customer.phone || primaryContact?.phone || '',
          billingEmail: customer.email || primaryContact?.email || '',
          status: customer.status || 'Active',
          accountType: customer.accountType || 'Individual',
          createdBy: customer.createdBy || 'Admin',
          notes: customer.notes || '',
          contacts: (customer.contacts?.length ? customer.contacts : [primaryContact]).filter(Boolean).map((contact, index) => ({
            id: `${contact?.name || 'contact'}-${index}`,
            contactType: 'Accounts',
            name: contact?.name || '',
            email: contact?.email || '',
            phone: contact?.phone || '',
            designation: contact?.designation || '',
          })),
          documents: [],
        })
      } catch (error) {
        console.error(error)
      }
    }

    void loadCustomer()
  }, [id, isEditing])

  const handleFieldChange = (field: keyof Omit<CustomerFormState, 'contacts' | 'documents'>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCountryChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      billingCountry: value,
      billingState: '',
      billingCity: '',
      billingArea: '',
      billingPinCode: '',
    }))
  }

  const handleStateChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      billingState: value,
      billingCity: '',
      billingArea: '',
      billingPinCode: '',
    }))
  }

  const handleCityChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      billingCity: value,
      billingArea: '',
      billingPinCode: '',
    }))
  }

  const handleContactChange = (index: number, field: keyof ContactItem, value: string) => {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((contact, contactIndex) => (contactIndex === index ? { ...contact, [field]: value } : contact)),
    }))
  }

  const addContact = () => {
    setForm((prev) => ({
      ...prev,
      contacts: [
        ...prev.contacts,
        {
          id: crypto.randomUUID(),
          contactType: 'Accounts',
          name: '',
          email: '',
          phone: '',
          designation: '',
        },
      ],
    }))
  }

  const removeContact = (index: number) => {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, contactIndex) => contactIndex !== index),
    }))
  }

  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const documents = files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      fileType: file.type || file.name.split('.').pop() || 'unknown',
      size: file.size,
      file,
    }))

    setForm((prev) => ({ ...prev, documents: [...prev.documents, ...documents] }))
    event.target.value = ''
  }

  const resetForm = () => {
    setForm({
      ...emptyForm,
      contacts: [
        {
          id: crypto.randomUUID(),
          contactType: 'Accounts',
          name: '',
          email: '',
          phone: '',
          designation: '',
        },
      ],
    })
    setActiveSection('company')
    setSubmitError(null)
  }

  const validateForm = () => {
    if (!form.companyName.trim()) return 'Company Name is required.'
    if (!form.state.trim()) return 'State is required.'
    if (!form.billingAddressLine.trim()) return 'Address Line is required.'
    if (!form.billingCountry.trim()) return 'Country is required.'
    if (!form.billingState.trim()) return 'State is required.'
    if (!form.billingCity.trim()) return 'City is required.'
    if (!form.billingArea.trim()) return 'Area is required.'
    if (!form.billingPinCode.trim()) return 'Pin Code is required.'
    if (!form.billingContactNumber.trim()) return 'Contact Number is required.'
    if (!form.billingEmail.trim()) return 'Email Address is required.'

    const invalidContact = form.contacts.some((contact) => !contact.contactType || !contact.name || !contact.email || !contact.phone)
    if (invalidContact) return 'Each contact must include Contact Type, Name, Email ID, and Contact Number.'

    if (!form.documents.length) return 'At least one document is required.'

    return null
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setSubmitError(validationError)
      return
    }

    setSubmitError(null)
    setIsSaving(true)

    const payload: CustomerPayload = {
      companyName: form.companyName,
      customerName: form.companyName,
      email: form.billingEmail,
      phone: form.billingContactNumber,
      status: form.status,
      notes: form.notes,
      state: form.state,
      createdBy: form.createdBy,
      accountType: form.accountType,
      contacts: form.contacts.map((contact) => ({
        contactType: contact.contactType,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        designation: contact.designation,
      })),
      billToAddress: {
        addressLine1: form.billingAddressLine,
        area: form.billingArea,
        country: form.billingCountry,
        state: form.billingState,
        city: form.billingCity,
        pincode: form.billingPinCode,
      },
      shipToSameAsBilling: true,
      shipToAddress: {
        addressLine1: form.billingAddressLine,
        area: form.billingArea,
        country: form.billingCountry,
        state: form.billingState,
        city: form.billingCity,
        pincode: form.billingPinCode,
      },
      documents: form.documents.map((document) => ({
        fileName: document.fileName,
        filePath: '',
        documentType: document.fileType,
        mimeType: document.fileType,
        size: document.size,
      })),
    }

    const files = form.documents.map((document) => document.file).filter((file): file is File => Boolean(file))

    try {
      if (isEditing) {
        await updateCustomer(id as string, payload, files)
      } else {
        await createCustomer(payload, files)
      }
      navigate('/sales/customers')
    } catch (error) {
      console.error(error)
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong while saving the customer.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full rounded-xl border border-[#EFECE5] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/sales/customers')} className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <ArrowLeft className="h-4 w-4" />
            Back to Customer List
          </button>
          <h1 className="crm-page-heading">{isEditing ? 'Edit Customer' : 'Add Customer'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        ) : null}

        <SectionCard
          title="Company Information"
          isOpen={activeSection === 'company'}
          onToggle={() => setActiveSection((current) => (current === 'company' ? null : 'company'))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company Name" required>
              <input value={form.companyName} onChange={(event) => handleFieldChange('companyName', event.target.value)} placeholder="Company Name" className="crm-input form-control" />
            </Field>
            <Field label="State" required>
              <Select
                value={form.state ? { label: form.state, value: form.state } : null}
                onChange={(option) => handleFieldChange('state', option?.value ?? '')}
                options={form.billingCountry ? states.map((state) => ({ label: state.name, value: state.name, code: state.code, isoCode: state.isoCode, countryCode: state.countryCode })) : companyStateOptions}
                isSearchable
                isClearable
                placeholder="Search state"
                className="text-sm"
                classNamePrefix="crm-select"
                styles={selectStyles as never}
                filterOption={filterByInput as never}
              />
            </Field>
            <Field label="GST Number">
              <input value={form.gstNumber} onChange={(event) => handleFieldChange('gstNumber', event.target.value)} placeholder="GST Number" className="crm-input form-control" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Billing Address"
          isOpen={activeSection === 'billing'}
          onToggle={() => setActiveSection((current) => (current === 'billing' ? null : 'billing'))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Address Line" required>
              <input value={form.billingAddressLine} onChange={(event) => handleFieldChange('billingAddressLine', event.target.value)} placeholder="Address Line" className="crm-input form-control" />
            </Field>
            <Field label="Country" required>
              <Select
                value={countries.find((country) => country.name === form.billingCountry) ? { label: form.billingCountry, value: form.billingCountry } : null}
                onChange={(option) => handleCountryChange(option?.value ?? '')}
                options={countries.map((country) => ({ label: country.name, value: country.name, code: country.code, isoCode: country.isoCode }))}
                isSearchable
                isClearable
                placeholder="Search country"
                className="text-sm"
                classNamePrefix="crm-select"
                styles={selectStyles as never}
              />
            </Field>
            <Field label="State" required>
              <Select
                value={states.find((state) => state.name === form.billingState) ? { label: form.billingState, value: form.billingState } : null}
                onChange={(option) => handleStateChange(option?.value ?? '')}
                options={states.map((state) => ({ label: state.name, value: state.name, code: state.code, isoCode: state.isoCode }))}
                isSearchable
                isClearable
                placeholder="Search state"
                isDisabled={!form.billingCountry}
                className="text-sm"
                classNamePrefix="crm-select"
                styles={selectStyles as never}
                filterOption={filterByInput as never}
              />
            </Field>
            <Field label="City" required>
              <Select
                value={cities.find((city) => city.name === form.billingCity) ? { label: form.billingCity, value: form.billingCity } : null}
                onChange={(option) => handleCityChange(option?.value ?? '')}
                options={cities.map((city) => ({ label: city.name, value: city.name, code: city.code, isoCode: city.isoCode }))}
                isSearchable
                isClearable
                placeholder="Search city"
                isDisabled={!form.billingState}
                className="text-sm"
                classNamePrefix="crm-select"
                styles={selectStyles as never}
                filterOption={filterByInput as never}
              />
            </Field>
            <Field label="Area" required>
              <input
                value={form.billingArea}
                onChange={(event) => handleFieldChange('billingArea', event.target.value)}
                placeholder="Area"
                className="crm-input form-control"
              />
            </Field>
            <Field label="Pin Code" required>
              <input
                type="text"
                value={form.billingPinCode}
                onChange={(event) => handleFieldChange('billingPinCode', event.target.value)}
                placeholder="Pin Code"
                className="crm-input form-control"
              />
            </Field>
            <Field label="Contact Number" required>
              <input value={form.billingContactNumber} onChange={(event) => handleFieldChange('billingContactNumber', event.target.value)} placeholder="Contact Number" className="crm-input form-control" />
            </Field>
            <Field label="Email Address" required>
              <input type="email" value={form.billingEmail} onChange={(event) => handleFieldChange('billingEmail', event.target.value)} placeholder="Email" className="crm-input form-control" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Contact Information"
          isOpen={activeSection === 'contact'}
          onToggle={() => setActiveSection((current) => (current === 'contact' ? null : 'contact'))}
        >
          <div className="space-y-4">
            {form.contacts.map((contact, index) => (
              <div key={contact.id} className="rounded-lg border border-[#EFECE5] bg-[#F8F7F3] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Contact {index + 1}</span>
                  {form.contacts.length > 1 ? (
                    <button type="button" onClick={() => removeContact(index)} className="text-sm text-[#111827]">Remove</button>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Contact Type" required>
                    <select value={contact.contactType} onChange={(event) => handleContactChange(index, 'contactType', event.target.value)} className="crm-input form-select">
                      <option value="">Select</option>
                      {contactTypeOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Name" required>
                    <input value={contact.name} onChange={(event) => handleContactChange(index, 'name', event.target.value)} placeholder="Contact Name" className="crm-input form-control" />
                  </Field>
                  <Field label="Email ID" required>
                    <input type="email" value={contact.email} onChange={(event) => handleContactChange(index, 'email', event.target.value)} placeholder="Email" className="crm-input form-control" />
                  </Field>
                  <Field label="Contact Number" required>
                    <input value={contact.phone} onChange={(event) => handleContactChange(index, 'phone', event.target.value)} placeholder="Contact Number" className="crm-input form-control" />
                  </Field>
                  <Field label="Designation">
                    <input value={contact.designation} onChange={(event) => handleContactChange(index, 'designation', event.target.value)} placeholder="Designation" className="crm-input form-control" />
                  </Field>
                </div>
              </div>
            ))}
            <button type="button" onClick={addContact} className="flex items-center gap-2 rounded-lg border border-[#111827] bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#F2EFE8]">
              <Plus className="h-4 w-4" />
              Add Contact
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Documents"
          isOpen={activeSection === 'documents'}
          onToggle={() => setActiveSection((current) => (current === 'documents' ? null : 'documents'))}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-3 py-2 text-sm font-semibold text-slate-700">
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleDocumentUpload} className="hidden" />
              <span className="text-sm text-slate-500">PDF, DOC, DOCX, JPG, JPEG, PNG</span>
            </div>
            {form.documents.length > 0 ? (
              <div className="space-y-2">
                {form.documents.map((document) => (
                  <div key={document.id} className="rounded-lg border border-[#EFECE5] bg-[#F8F7F3] px-3 py-2 text-sm text-slate-700">
                    {document.fileName} <span className="text-slate-500">({Math.round(document.size / 1024)} KB)</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <div className="flex items-center justify-end gap-3 border-t border-[#EFECE5] pt-4">
          <button type="button" onClick={resetForm} className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            <RefreshCcw className="h-4 w-4" />
            Reset
          </button>
          <button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E293B] disabled:opacity-60">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SectionCard({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#EFECE5] bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between bg-[#F8F7F3] px-4 py-3 text-left">
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
      </button>
      {isOpen ? <div className="p-4">{children}</div> : null}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  )
}
