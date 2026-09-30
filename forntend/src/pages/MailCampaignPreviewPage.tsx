'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getCampaignPreview, type MailCampaignPreview } from '@/lib/mailCampaignApi'

export default function MailCampaignPreviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const [preview, setPreview] = useState<MailCampaignPreview | null>(null)
  const [error, setError] = useState('')
  const backPath = typeof location.state?.from === 'string' ? location.state.from : '/sales/mail-campaign'

  useEffect(() => {
    if (!id) return
    getCampaignPreview(id)
      .then((response) => setPreview(response.data))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load campaign preview.'))
  }, [id])

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  if (!preview) return <div className="text-sm text-gray-500">Loading email preview...</div>

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate(backPath)} className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="overflow-hidden rounded-xl border border-[#EFECE5] bg-white shadow-sm">
        <div className="border-b border-[#EFECE5] bg-[#FAF8F2] px-6 py-5">
          <h1 className="crm-page-heading">Email Preview</h1>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-3"><dt className="w-16 font-semibold text-gray-500">Subject:</dt><dd className="font-medium text-gray-900">{preview.subject}</dd></div>
          </dl>
        </div>
        <div className="bg-[#F3F4F6] p-5 md:p-8">
          <iframe title="Actual campaign email content" srcDoc={preview.html} className="mx-auto block min-h-[720px] w-full max-w-3xl border-0 bg-white shadow-sm" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" />
        </div>
      </div>
    </div>
  )
}
