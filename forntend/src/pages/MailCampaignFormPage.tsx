'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { TiptapEditor } from '@/components/TiptapEditor'
import { createCampaign, fetchRecipientData, getCampaignById, sendCampaign, updateCampaign } from '@/lib/mailCampaignApi'
import { fetchCompanyProfiles, type CompanyProfileRecord } from '@/lib/companyProfileApi'

const alignmentOptions = ['Image Before Text', 'Image After Text']

export default function MailCampaignFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [campaignName, setCampaignName] = useState('')
  const [subject, setSubject] = useState('')
  const [imageAlignment, setImageAlignment] = useState(alignmentOptions[0])
  const [campaignBody, setCampaignBody] = useState('')
  const [footer, setFooter] = useState('')
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileRecord | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [batchName, setBatchName] = useState('')
  const [batchNumber, setBatchNumber] = useState<number | ''>('')
  const [batches, setBatches] = useState<Array<{ batchNumber: number; name: string; count: number }>>([])
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const resolveImageUrl = (filePath?: string) => {
    if (!filePath) return ''
    if (/^https?:\/\//i.test(filePath)) return filePath
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api$/, '')
    return `${base}${filePath}`
  }

  useEffect(() => {
    const loadCampaignFormData = async () => {
      try {
        const profileResponse = await fetchCompanyProfiles({ page: 1, limit: 100 })
        setCompanyProfile(profileResponse.data?.find((profile) => profile.companyLogo?.filePath) || null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load campaign data.')
      }
    }
    void loadCampaignFormData()
  }, [])

  useEffect(() => {
    if (!id) return
    void getCampaignById(id).then((campaign) => {
      setCampaignName(campaign.campaignName || '')
      setSubject(campaign.subject || '')
      setImageAlignment(campaign.imageAlignment || alignmentOptions[0])
      setCampaignBody(campaign.campaignBody || '')
      setFooter(campaign.footer || '')
      setImagePreviewUrl(resolveImageUrl(campaign.image))
      setScheduledDate(campaign.scheduledDate || '')
      setScheduledTime(campaign.scheduledTime || '')
      setBatchName(campaign.batchName || '')
      setBatchNumber(campaign.batchNumber || '')
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load campaign.'))
  }, [id])

  useEffect(() => {
    void fetchRecipientData(['Contacts']).then((response) => {
      const availableBatches = Array.isArray(response?.data?.batches) ? response.data.batches : []
      setBatches(availableBatches.sort((left: { batchNumber: number }, right: { batchNumber: number }) => left.batchNumber - right.batchNumber))
    }).catch(() => setBatches([]))
  }, [])

  const handleImageChange = (file: File | null) => {
    if (!file) return
    setImage(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  const saveCampaign = async (event: React.FormEvent, action: 'Draft' | 'Scheduled' | 'Sent') => {
    event.preventDefault()
    if (!campaignName.trim()) {
      setError('Campaign name is required.')
      return
    }
    if (!subject.trim()) {
      setError('Subject is required.')
      return
    }
    if (action === 'Scheduled' && (!scheduledDate || !scheduledTime)) {
      setError('Scheduled date and time are required.')
      return
    }
    setIsSaving(true)
    setError('')
    const formData = new FormData()
    formData.append('campaignName', campaignName.trim())
    formData.append('subject', subject.trim())
    formData.append('campaignType', 'Promotional')
    formData.append('imageAlignment', imageAlignment)
    formData.append('campaignBody', campaignBody)
    formData.append('footer', footer)
    formData.append('status', action)
    formData.append('createdBy', typeof window !== 'undefined' ? (window.localStorage.getItem('userName') || window.localStorage.getItem('name') || 'Admin') : 'Admin')
    formData.append('createdDate', new Date().toISOString().split('T')[0])
    formData.append('scheduledDate', action === 'Scheduled' ? scheduledDate : '')
    formData.append('scheduledTime', action === 'Scheduled' ? scheduledTime : '')
    formData.append('batchName', batchName)
    formData.append('batchNumber', batchNumber ? String(batchNumber) : '')
    if (image) formData.append('image', image)

    try {
      const savedCampaign = id ? await updateCampaign(id, formData) : await createCampaign(formData)
      const savedId = id || savedCampaign.data?._id
      if (!savedId) throw new Error('Campaign was saved without an ID.')
      if (action === 'Sent') await sendCampaign(savedId)
      navigate('/sales/mail-campaign')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save campaign.')
    } finally {
      setIsSaving(false)
    }
  }

  const logoUrl = resolveImageUrl(companyProfile?.companyLogo?.filePath)
  const campaignImageUrl = imagePreviewUrl
  const campaignBodyPreview = campaignBody.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || ''
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || ''
    return (logoUrl && source === logoUrl) || /company logo/i.test(alt) ? '' : tag
  })
  const logoBeforeBody = imageAlignment === 'Image Before Text' || imageAlignment === 'Image Above Text'
  const campaignImageBeforeBody = imageAlignment === 'Image Before Text' || imageAlignment === 'Image Above Text'
  const previewContent = (
    <div className="mx-auto max-w-2xl bg-white p-8 text-gray-800 shadow-sm" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '16px', lineHeight: 1.5 }}>
      {logoBeforeBody && logoUrl ? <img src={logoUrl} alt="Synov company logo" className="mb-5 block h-auto w-[120px] object-contain" /> : null}
      {campaignImageBeforeBody && campaignImageUrl ? <img src={campaignImageUrl} alt="Campaign image" className="mb-5 block max-h-80 w-full object-contain" /> : null}
      <div className="[&_p]:m-0 [&_p]:mb-4 [&_p:empty]:min-h-[1.5em]" dangerouslySetInnerHTML={{ __html: campaignBodyPreview || '<p>Campaign body</p>' }} />
      {!campaignImageBeforeBody && campaignImageUrl ? <img src={campaignImageUrl} alt="Campaign image" className="my-5 block max-h-80 w-full object-contain" /> : null}
      {!logoBeforeBody && logoUrl ? <img src={logoUrl} alt="Synov company logo" className="my-5 block h-auto w-[120px] object-contain" /> : null}
      <div className="mt-6 border-t border-gray-200 pt-4 [&_p]:m-0 [&_p]:mb-4 [&_p:empty]:min-h-[1.5em]" dangerouslySetInnerHTML={{ __html: footer || '<p>Footer</p>' }} />
    </div>
  )

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate('/sales/mail-campaign')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]"><ArrowLeft className="h-4 w-4" /> Back to Mail Campaigns</button>
      <div className="rounded-xl border border-[#EFECE5] bg-white p-8 shadow-sm">
        <h1 className="crm-page-heading">{id ? 'Edit Campaign' : 'Create Campaign'}</h1>
        {error ? <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <form onSubmit={(event) => void saveCampaign(event, 'Sent')} className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">Campaign Name</span>
              <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CEC9BD]" placeholder="Campaign name" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CEC9BD]" placeholder="Email subject" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">Campaign Image Alignment</span>
              <select value={imageAlignment} onChange={(event) => setImageAlignment(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CEC9BD]">
                {alignmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">Batch</span>
              <select value={batchNumber} onChange={(event) => {
                const nextBatchNumber = event.target.value ? Number(event.target.value) : ''
                setBatchNumber(nextBatchNumber)
                setBatchName(nextBatchNumber ? `Batch ${nextBatchNumber}` : '')
              }} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CEC9BD]">
                <option value="">All Batches</option>
                {batches.map((batch) => <option key={batch.batchNumber} value={batch.batchNumber}>{batch.name} ({batch.count})</option>)}
              </select>
            </label>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Campaign Body</label>
            <TiptapEditor value={campaignBody} onChange={setCampaignBody} placeholder="Write your campaign body" companyLogoUrl={logoUrl} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Image Upload</label>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={imageInputRef} type="file" accept="image/*" onChange={(event) => handleImageChange(event.target.files?.[0] || null)} className="block flex-1 rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700" />
              <button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[#111827] bg-white px-4 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F2EFE8]"><ImagePlus className="h-4 w-4" /> Add New Image</button>
              {image ? <span className="text-sm text-gray-500">{image.name}</span> : null}
            </div>
            {imagePreviewUrl ? <img src={imagePreviewUrl} alt="Campaign upload preview" className="mt-3 max-h-32 max-w-xs object-contain" /> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Footer</label>
            <TiptapEditor value={footer} onChange={setFooter} placeholder="Write your campaign footer" companyLogoUrl={logoUrl} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">Scheduled Date</span>
              <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">Scheduled Time</span>
              <input type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#EFECE5] pt-6">
              <button type="button" onClick={() => setIsPreviewOpen(true)} className="rounded-lg border border-[#111827] bg-white px-6 py-3 text-sm font-semibold text-[#111827] hover:bg-[#F2EFE8]">Preview</button>
            <button type="button" onClick={(event) => void saveCampaign(event, 'Draft')} disabled={isSaving} className="rounded-lg border border-[#111827] bg-white px-6 py-3 text-sm font-semibold text-[#111827] hover:bg-[#F2EFE8] disabled:opacity-60">Save Draft</button>
            <button type="button" onClick={(event) => void saveCampaign(event, 'Scheduled')} disabled={isSaving} className="rounded-lg border border-amber-600 bg-white px-6 py-3 text-sm font-semibold text-amber-700 disabled:opacity-60">Schedule</button>
            <button type="submit" disabled={isSaving} className="rounded-lg bg-[#111827] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60">{isSaving ? 'Submitting...' : 'Send'}</button>
          </div>
        </form>
      </div>
      {isPreviewOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Campaign preview">
          <div className="mx-auto my-8 max-w-4xl rounded-xl bg-[#F7F5EF] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Campaign Preview</h2>
              <button type="button" onClick={() => setIsPreviewOpen(false)} aria-label="Close preview" className="rounded p-2 text-gray-600 hover:bg-white"><X className="h-5 w-5" /></button>
            </div>
            {previewContent}
          </div>
        </div>
      ) : null}
    </div>
  )
}
