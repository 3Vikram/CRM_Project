'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCampaignReport, type MailCampaignReportRow } from '@/lib/mailCampaignApi'

export default function MailCampaignReportPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [rows, setRows] = useState<MailCampaignReportRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    void getCampaignReport(id).then((response) => setRows(response.data || [])).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load campaign report.'))
  }, [id])

  const cell = 'border border-[#E5E7EB] px-3 py-2.5 align-middle'
  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate('/sales/mail-campaign')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]"><ArrowLeft className="h-4 w-4" /> Back to Mail Campaigns</button>
      <div className="rounded-xl border border-[#EFECE5] bg-white p-6 shadow-sm">
        <h1 className="crm-page-heading">Mail Campaign Report</h1>
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-separate border-spacing-0 overflow-hidden rounded-lg border border-[#E5E7EB] text-sm">
            <thead><tr className="bg-[#F2EFE8] text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
              <th className={cell}>Sl.No</th><th className={cell}>Campaign ID</th><th className={cell}>Campaign Name</th><th className={cell}>Sent By</th><th className={cell}>Sent To</th><th className={cell}>Subject</th><th className={cell}>Opens</th><th className={cell}>Clicks</th>
            </tr></thead>
            <tbody>{rows.map((row) => <tr key={`${row.campaignId}-${row.sentTo}`} className="hover:bg-[#FAF8F2]"><td className={cell}>{row.serialNumber}</td><td className={cell}>{row.campaignId}</td><td className={cell}>{row.campaignName}</td><td className={cell}>{row.sentBy || '—'}</td><td className={cell}>{row.sentTo}</td><td className={cell}>{row.subject}</td><td className={cell}>{row.opens}</td><td className={cell}>{row.clicks}</td></tr>)}</tbody>
          </table>
          {!rows.length && !error ? <p className="py-10 text-center text-sm text-gray-500">No delivery records found.</p> : null}
        </div>
      </div>
    </div>
  )
}
