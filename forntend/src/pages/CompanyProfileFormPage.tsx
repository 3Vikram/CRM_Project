'use client'

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload } from 'lucide-react'
import { fetchCompanyProfileById, createCompanyProfile, updateCompanyProfile, type CompanyProfilePayload, type CompanyProfileRecord } from '@/lib/companyProfileApi'

interface UploadFields {
  companyLogo: File | null
  documentLogo: File | null
  documentHeader: File | null
  documentFooter: File | null
}

const emptyForm: CompanyProfilePayload = {
  directorName: '',
  directorDesignation: '',
  companyName: '',
  branchName: '',
  branchCode: '',
  registeredAddress: '',
  address: '',
  city: '',
  state: '',
  pin: '',
  country: '',
  companyContactNo: '',
  website: '',
  email: '',
  documentHeaderRequired: false,
  documentFooterRequired: false,
  gstNo: '',
  panNo: '',
  bankName: '',
  accountHolderName: '',
  accountNo: '',
  ifscCode: '',
  swiftCode: '',
  cin: '',
  iec: '',
  quotationFormat: '',
  idNoFormat: '',
  opfFormat: '',
  poFormat: '',
  piFormat: '',
  invoiceFormat: '',
  prFormat: '',
  enquiryFormat: '',
  challanFormat: '',
}

export default function CompanyProfileFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [form, setForm] = useState<CompanyProfilePayload>(emptyForm)
  const [uploadFields, setUploadFields] = useState<UploadFields>({
    companyLogo: null,
    documentLogo: null,
    documentHeader: null,
    documentFooter: null,
  })
  const [existingProfile, setExistingProfile] = useState<CompanyProfileRecord | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadTarget, setUploadTarget] = useState<keyof UploadFields | null>(null)

  useEffect(() => {
    if (!isEditing || !id) return

    const loadCompanyProfile = async () => {
      try {
        const response = await fetchCompanyProfileById(id)
        const companyProfile = response.data as CompanyProfileRecord
        setExistingProfile(companyProfile)
        setForm({
          directorName: companyProfile.directorName || '',
          directorDesignation: companyProfile.directorDesignation || '',
          companyName: companyProfile.companyName || '',
          branchName: companyProfile.branchName || '',
          branchCode: companyProfile.branchCode || '',
          registeredAddress: companyProfile.registeredAddress || '',
          address: companyProfile.address || '',
          city: companyProfile.city || '',
          state: companyProfile.state || '',
          pin: companyProfile.pin || '',
          country: companyProfile.country || '',
          companyContactNo: companyProfile.companyContactNo || '',
          website: companyProfile.website || '',
          email: companyProfile.email || '',
          documentHeaderRequired: companyProfile.documentHeaderRequired ?? false,
          documentFooterRequired: companyProfile.documentFooterRequired ?? false,
          gstNo: companyProfile.gstNo || '',
          panNo: companyProfile.panNo || '',
          bankName: companyProfile.bankName || '',
          accountHolderName: companyProfile.accountHolderName || '',
          accountNo: companyProfile.accountNo || '',
          ifscCode: companyProfile.ifscCode || '',
          swiftCode: companyProfile.swiftCode || '',
          cin: companyProfile.cin || '',
          iec: companyProfile.iec || '',
          quotationFormat: companyProfile.quotationFormat || '',
          idNoFormat: companyProfile.idNoFormat || '',
          opfFormat: companyProfile.opfFormat || '',
          poFormat: companyProfile.poFormat || '',
          piFormat: companyProfile.piFormat || '',
          invoiceFormat: companyProfile.invoiceFormat || '',
          prFormat: companyProfile.prFormat || '',
          enquiryFormat: companyProfile.enquiryFormat || '',
          challanFormat: companyProfile.challanFormat || '',
        })
      } catch (error) {
        console.error(error)
      }
    }

    void loadCompanyProfile()
  }, [id, isEditing])

  const handleChange = (field: keyof CompanyProfilePayload, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileSelect = (field: keyof UploadFields, file: File | null) => {
    setUploadFields((prev) => ({ ...prev, [field]: file }))
  }

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!uploadTarget) return
    const file = event.target.files?.[0] ?? null
    handleFileSelect(uploadTarget, file)
    event.target.value = ''
  }

  const removeUploadedFile = (field: keyof UploadFields) => {
    setUploadFields((prev) => ({ ...prev, [field]: null }))
  }

  const validateForm = () => {
    if (!form.directorName.trim()) return 'Director Name is required.'
    if (!form.directorDesignation.trim()) return 'Director Designation is required.'
    if (!form.companyName.trim()) return 'Company Name is required.'
    if (!form.city.trim()) return 'City is required.'
    if (!form.state.trim()) return 'State is required.'
    if (!form.pin.trim()) return 'PIN is required.'
    if (!form.country.trim()) return 'Country is required.'
    if (!form.website.trim()) return 'Website is required.'
    if (!form.email.trim()) return 'Email is required.'
    if (!form.gstNo.trim()) return 'GST No. is required.'
    if (!form.panNo.trim()) return 'PAN No. is required.'
    if (!form.bankName.trim()) return 'Bank Name is required.'
    if (!form.accountHolderName.trim()) return 'Account Holder Name is required.'
    if (!form.accountNo.trim()) return 'Account No. is required.'
    if (!form.ifscCode.trim()) return 'IFSC Code is required.'
    if (!form.swiftCode.trim()) return 'Swift Code is required.'
    if (!form.cin.trim()) return 'CIN is required.'
    if (!form.iec.trim()) return 'IEC is required.'
    if (!form.quotationFormat.trim()) return 'Quotation Format is required.'
    if (!form.idNoFormat.trim()) return 'ID No. Format is required.'
    if (!form.opfFormat.trim()) return 'OPF Format is required.'
    if (!form.poFormat.trim()) return 'PO Format is required.'
    if (!form.piFormat.trim()) return 'PI Format is required.'
    if (!form.invoiceFormat.trim()) return 'Invoice Format is required.'
    if (!form.prFormat.trim()) return 'PR Format is required.'
    if (!form.enquiryFormat.trim()) return 'Enquiry Format is required.'
    if (!form.challanFormat.trim()) return 'Challan Format is required.'
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
    setSubmitSuccess(null)
    setIsSaving(true)

    try {
      const files: Record<string, File | null> = {
        companyLogo: uploadFields.companyLogo,
        documentLogo: uploadFields.documentLogo,
        documentHeader: uploadFields.documentHeader,
        documentFooter: uploadFields.documentFooter,
      }

      if (isEditing && id) {
        await updateCompanyProfile(id, form, files)
        setSubmitSuccess('Company profile updated successfully.')
      } else {
        await createCompanyProfile(form, files)
        setSubmitSuccess('Company profile created successfully.')
      }
      navigate('/sales/company-profiles')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save company profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const uploadedPreview = (field: keyof UploadFields) => {
    const existingFile = existingProfile?.[field as keyof CompanyProfileRecord] as { filePath?: string; fileName?: string } | undefined
    const selectedFile = uploadFields[field]
    return selectedFile ? selectedFile.name : existingFile?.fileName || 'No file selected'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => navigate('/sales/company-profiles')} className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <ArrowLeft className="h-4 w-4" />
          Back to Company Profiles
        </button>
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <h1 className="crm-page-heading">{isEditing ? 'Edit Company Profile' : 'Add Company Profile'}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
          {submitSuccess ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{submitSuccess}</div> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Director Name *</span>
              <input value={form.directorName} onChange={(event) => handleChange('directorName', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Director Designation *</span>
              <input value={form.directorDesignation} onChange={(event) => handleChange('directorDesignation', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Company Name *</span>
              <input value={form.companyName} onChange={(event) => handleChange('companyName', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Branch Name</span>
              <input value={form.branchName} onChange={(event) => handleChange('branchName', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Branch Code</span>
              <input value={form.branchCode} onChange={(event) => handleChange('branchCode', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Registered Address</span>
              <textarea value={form.registeredAddress} onChange={(event) => handleChange('registeredAddress', event.target.value)} className="crm-input form-control min-h-[88px]" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Address</span>
              <textarea value={form.address} onChange={(event) => handleChange('address', event.target.value)} className="crm-input form-control min-h-[88px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">City *</span>
              <input value={form.city} onChange={(event) => handleChange('city', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">State *</span>
              <input value={form.state} onChange={(event) => handleChange('state', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">PIN *</span>
              <input value={form.pin} onChange={(event) => handleChange('pin', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Country *</span>
              <input value={form.country} onChange={(event) => handleChange('country', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Contact Number</span>
              <input value={form.companyContactNo} onChange={(event) => handleChange('companyContactNo', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Website *</span>
              <input value={form.website} onChange={(event) => handleChange('website', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email *</span>
              <input value={form.email} onChange={(event) => handleChange('email', event.target.value)} className="crm-input form-control" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Company Logo</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setUploadTarget('companyLogo'); fileInputRef.current?.click() }} className="crm-button-secondary">
                  <Upload className="h-4 w-4" /> Upload
                </button>
                <span className="text-sm text-slate-600">{uploadedPreview('companyLogo')}</span>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Document Logo</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setUploadTarget('documentLogo'); fileInputRef.current?.click() }} className="crm-button-secondary">
                  <Upload className="h-4 w-4" /> Upload
                </button>
                <span className="text-sm text-slate-600">{uploadedPreview('documentLogo')}</span>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Document Header</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setUploadTarget('documentHeader'); fileInputRef.current?.click() }} className="crm-button-secondary">
                  <Upload className="h-4 w-4" /> Upload
                </button>
                <span className="text-sm text-slate-600">{uploadedPreview('documentHeader')}</span>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Document Footer</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setUploadTarget('documentFooter'); fileInputRef.current?.click() }} className="crm-button-secondary">
                  <Upload className="h-4 w-4" /> Upload
                </button>
                <span className="text-sm text-slate-600">{uploadedPreview('documentFooter')}</span>
              </div>
            </label>
          </div>

          <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.pdf,.doc,.docx" onChange={onFileInputChange} className="hidden" />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">GST No. *</span>
              <input value={form.gstNo} onChange={(event) => handleChange('gstNo', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">PAN No. *</span>
              <input value={form.panNo} onChange={(event) => handleChange('panNo', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Bank Name *</span>
              <input value={form.bankName} onChange={(event) => handleChange('bankName', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Account Holder Name *</span>
              <input value={form.accountHolderName} onChange={(event) => handleChange('accountHolderName', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Account No. *</span>
              <input value={form.accountNo} onChange={(event) => handleChange('accountNo', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">IFSC Code *</span>
              <input value={form.ifscCode} onChange={(event) => handleChange('ifscCode', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Swift Code *</span>
              <input value={form.swiftCode} onChange={(event) => handleChange('swiftCode', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">CIN *</span>
              <input value={form.cin} onChange={(event) => handleChange('cin', event.target.value)} className="crm-input form-control" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">IEC *</span>
              <input value={form.iec} onChange={(event) => handleChange('iec', event.target.value)} className="crm-input form-control" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Quotation Format *</span>
              <input value={form.quotationFormat} onChange={(event) => handleChange('quotationFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. QTN-2024-###" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">ID No. Format *</span>
              <input value={form.idNoFormat} onChange={(event) => handleChange('idNoFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. IDN-###" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">OPF Format *</span>
              <input value={form.opfFormat} onChange={(event) => handleChange('opfFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. OPF-###" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">PO Format *</span>
              <input value={form.poFormat} onChange={(event) => handleChange('poFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. PO-###" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">PI Format *</span>
              <input value={form.piFormat} onChange={(event) => handleChange('piFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. PI-###" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Invoice Format *</span>
              <input value={form.invoiceFormat} onChange={(event) => handleChange('invoiceFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. INV-###" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">PR Format *</span>
              <input value={form.prFormat} onChange={(event) => handleChange('prFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. PR-###" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Enquiry Format *</span>
              <input value={form.enquiryFormat} onChange={(event) => handleChange('enquiryFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. ENQ-###" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Challan Format *</span>
              <input value={form.challanFormat} onChange={(event) => handleChange('challanFormat', event.target.value)} className="crm-input form-control" placeholder="E.g. CHL-###" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button type="submit" disabled={isSaving} className="rounded-lg bg-[#111827] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? 'Saving...' : isEditing ? 'Update Profile' : 'Create Profile'}
            </button>
            <button type="button" onClick={() => navigate('/sales/company-profiles')} className="rounded-lg border border-[#EFECE5] bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[#F2F2F2]">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
