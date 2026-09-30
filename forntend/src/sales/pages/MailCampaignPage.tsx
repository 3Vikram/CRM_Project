'use client'

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Download, Search, Mail, FileText, Clock3, Send, Trash2 } from 'lucide-react'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { StatCard } from '@/components/stat-card'
import { deleteCampaign, getCampaigns, MailCampaignRecord } from '@/lib/mailCampaignApi'

type CampaignStatus = 'Draft' | 'Scheduled' | 'Sent'

export default function MailCampaignPage({ statusFilter }: { statusFilter?: CampaignStatus }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [campaigns, setCampaigns] = useState<MailCampaignRecord[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MailCampaignRecord | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ total: 0, drafts: 0, scheduled: 0, sent: 0 })

  const loadCampaigns = async (nextPage = page, nextLimit = pageSize) => {
    const data = await getCampaigns({ search, page: nextPage, limit: nextLimit, ...(statusFilter ? { status: statusFilter } : {}) })
    setCampaigns(data.data || [])
    setTotalPages(data.pagination?.totalPages || 1)
    setTotalCount(data.pagination?.total || 0)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCampaigns(1, pageSize)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [search, pageSize])

  useEffect(() => {
    void loadCampaigns(page, pageSize)
  }, [page, statusFilter])

  useEffect(() => {
    if (statusFilter) return
    void Promise.all([
      getCampaigns({ limit: 1 }),
      getCampaigns({ limit: 1, status: 'Draft' }),
      getCampaigns({ limit: 1, status: 'Scheduled' }),
      getCampaigns({ limit: 1, status: 'Sent' }),
    ]).then(([total, drafts, scheduled, sent]) => {
      setStats({
        total: total.pagination?.total || 0,
        drafts: drafts.pagination?.total || 0,
        scheduled: scheduled.pagination?.total || 0,
        sent: sent.pagination?.total || 0,
      })
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load campaign counts.'))
  }, [statusFilter])

  const tableCellClass = 'border border-[#E5E7EB] px-3 py-2.5 align-middle'
  const formatDate = (value?: string) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const handleDelete = async (campaign: MailCampaignRecord) => {
    setDeletingCampaignId(campaign.campaignId)
    setMessage('')
    setError('')
    try {
      await deleteCampaign(campaign.campaignId)
      setCampaigns((current) => current.filter((item) => item.campaignId !== campaign.campaignId))
      setTotalCount((current) => Math.max(current - 1, 0))
      setMessage('Campaign deleted successfully.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete campaign.')
    } finally {
      setDeletingCampaignId(null)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-8">
      {statusFilter === 'Draft' || statusFilter === 'Scheduled' ? (
        <button type="button" onClick={() => navigate('/sales/mail-campaign')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]"><ArrowLeft className="h-4 w-4" /> Back to Mail Campaigns</button>
      ) : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="crm-page-heading">{statusFilter ? `${statusFilter} Campaigns` : 'Mail Campaigns'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <button onClick={() => navigate('/sales/mail-campaign/new')} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1E293B]">
            <Plus className="h-4 w-4" />
            Campaign
          </button>
        </div>
      </div>

      {!statusFilter ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={() => navigate('/sales/mail-campaign')} className="text-left"><StatCard labelClassName="stat-card-label-increased" icon={Mail} label="Total Campaigns" value={stats.total} description="All active campaigns" iconBg="bg-[#F2EFE8]" iconColor="text-[#111827]" /></button>
          <button type="button" onClick={() => navigate('/sales/mail-campaign/drafts')} className="text-left"><StatCard labelClassName="stat-card-label-increased" icon={FileText} label="Draft Campaigns" value={stats.drafts} description="Saved for later review" iconBg="bg-[#F2EFE8]" iconColor="text-gray-700" /></button>
          <button type="button" onClick={() => navigate('/sales/mail-campaign/scheduled')} className="text-left"><StatCard labelClassName="stat-card-label-increased" icon={Clock3} label="Scheduled Campaigns" value={stats.scheduled} description="Queued for sending" iconBg="bg-[#F2EFE8]" iconColor="text-amber-700" /></button>
          <button type="button" onClick={() => navigate('/sales/mail-campaign/sent')} className="text-left"><StatCard labelClassName="stat-card-label-increased" icon={Send} label="Sent Campaigns" value={stats.sent} description="Completed campaigns" iconBg="bg-[#F2EFE8]" iconColor="text-green-700" /></button>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="max-w-xl">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Search Campaign</label>
            <div className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search campaign" />
            </div>
          </div>
        </div>
        {message ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-x-auto">
          {campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#EFECE5] bg-[#FAF8F2] px-6 py-12 text-center text-sm text-gray-500">No campaigns found.</div>
          ) : (
          <table className="w-full min-w-[900px] border-separate border-spacing-0 overflow-hidden rounded-lg border border-[#E5E7EB] text-sm">
            <thead>
              <tr className="bg-[#F2EFE8] text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                <th className={`${tableCellClass} w-[7%] text-center`}>Sl No.</th>
                <th className={`${tableCellClass} w-[12%]`}>Campaign ID</th>
                <th className={`${tableCellClass} w-[30%]`}>Campaign Name</th>
                <th className={`${tableCellClass} w-[15%]`}>Date</th>
                <th className={`${tableCellClass} w-[9%] text-center`}>View Template</th>
                <th className={`${tableCellClass} w-[9%] text-center`}>View Report</th>
                <th className={`${tableCellClass} w-[7%] text-center`}>Opens (Total)</th>
                <th className={`${tableCellClass} w-[6%] text-center`}>Clicks (Total)</th>
                <th className={`${tableCellClass} w-[8%] text-center`}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, index) => (
                <tr key={campaign._id} className="hover:bg-[#FAF8F2]">
                  <td className={`${tableCellClass} text-center font-medium text-gray-900`}>{(page - 1) * pageSize + index + 1}</td>
                  <td className={`${tableCellClass} font-medium text-gray-900`}>{campaign.campaignId}</td>
                  <td className={tableCellClass}>{campaign.campaignName}</td>
                  <td className={`${tableCellClass} whitespace-nowrap`}>{statusFilter === 'Scheduled' ? `${formatDate(campaign.scheduledDate)} ${campaign.scheduledTime || ''}` : formatDate(campaign.createdDate || campaign.createdAt)}</td>
                  <td className={`${tableCellClass} text-center`}>
                    <button type="button" onClick={() => {
                      const target = campaign.status === 'Draft' || campaign.status === 'Scheduled' ? `/sales/mail-campaign/edit/${campaign._id}` : `/sales/mail-campaign/view/${campaign._id}`
                      navigate(target, target.includes('/view/') ? { state: { from: location.pathname } } : undefined)
                    }} className="rounded bg-[#111827] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1E293B]">View</button>
                  </td>
                  <td className={`${tableCellClass} text-center`}>
                    <button type="button" onClick={() => navigate(`/sales/reports/mail-campaigns/${campaign._id}`)} className="rounded bg-[#111827] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1E293B]">Report</button>
                  </td>
                  <td className={`${tableCellClass} text-center`}>{campaign.opens}</td>
                  <td className={`${tableCellClass} text-center`}>{campaign.clicks}</td>
                  <td className={`${tableCellClass} text-center`}>
                    <button type="button" onClick={() => setDeleteTarget(campaign)} disabled={deletingCampaignId === campaign.campaignId} className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60" aria-label={`Delete ${campaign.campaignName}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingCampaignId === campaign.campaignId ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE5] pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show</span>
            <select className="rounded border border-[#EFECE5] bg-white px-2 py-1.5 text-sm text-gray-700" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="text-sm text-gray-500">Showing {(totalCount === 0 ? 0 : (page - 1) * pageSize + 1)} to {Math.min(page * pageSize, totalCount)} of {totalCount} entries</div>
          <div className="flex items-center gap-2">
            <button className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} aria-labelledby="delete-campaign-dialog-title">
        <DialogTitle id="delete-campaign-dialog-title">Are you sure to delete this?</DialogTitle>
        <DialogContent>
          <DialogContentText>{deleteTarget?.campaignName || 'The selected campaign'} will be permanently deleted.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => deleteTarget && void handleDelete(deleteTarget)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
