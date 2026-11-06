'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Download, Search, Mail, FileText, Send, Trash2 } from 'lucide-react'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { StatCard } from '@/sales/components/stat-card'
import { deleteCampaign, getCampaigns, MailCampaignRecord } from '@/sales/lib/mailCampaignApi'
import { PermissionGate } from '@/sales/components/PermissionGate'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import { PageFilters, type PageFilterValues } from '@/sales/components/PageFilters'

type CampaignStatus = 'Draft' | 'Scheduled' | 'Sent'

export default function MailCampaignPage({ statusFilter }: { statusFilter?: CampaignStatus }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [campaigns, setCampaigns] = useState<MailCampaignRecord[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [campaignFilters, setCampaignFilters] = useState<PageFilterValues>({})
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MailCampaignRecord | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ total: 0, drafts: 0, scheduled: 0, sent: 0 })
  const [isDownloading, setIsDownloading] = useState(false)

  const campaignFilterFields = useMemo(() => {
    const fields = [
      { key: 'createdBy', label: 'Created By', type: 'select' as const, options: Array.from(new Set(campaigns.map((campaign) => campaign.createdBy).filter(Boolean))).sort() },
      { key: 'campaignDate', label: statusFilter === 'Scheduled' ? 'Scheduled Date' : 'Created Date', type: 'date' as const },
    ]
    if (!statusFilter) {
      fields.unshift({
        key: 'status',
        label: 'Status',
        type: 'select' as const,
        options: Array.from(new Set(campaigns.map((campaign) => campaign.status).filter(Boolean))).sort(),
      })
    }
    return fields
  }, [campaigns, statusFilter])

  const loadCampaigns = async (nextPage = page, nextLimit = pageSize) => {
    const hasFilters = Object.values(campaignFilters).some(Boolean)
    if (hasFilters) {
      const allCampaigns: MailCampaignRecord[] = []
      let currentPage = 1
      let lastPage = 1
      do {
        const data = await getCampaigns({
          search,
          page: currentPage,
          limit: 100,
          ...(statusFilter ? { status: statusFilter } : {}),
        })
        allCampaigns.push(...(data.data || []))
        lastPage = data.pagination?.totalPages || 1
        currentPage += 1
      } while (currentPage <= lastPage)

      const filtered = allCampaigns.filter((campaign) => {
        const campaignDate = statusFilter === 'Scheduled'
          ? campaign.scheduledDate
          : campaign.createdDate || campaign.createdAt
        return (!campaignFilters.createdBy || campaign.createdBy === campaignFilters.createdBy)
          && (!campaignFilters.status || campaign.status === campaignFilters.status)
          && (!campaignFilters.campaignDate || String(campaignDate || '').slice(0, 10) === campaignFilters.campaignDate)
      })
      setTotalCount(filtered.length)
      setTotalPages(Math.max(1, Math.ceil(filtered.length / nextLimit)))
      setCampaigns(filtered.slice((nextPage - 1) * nextLimit, nextPage * nextLimit))
      return
    }

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
  }, [search, pageSize, campaignFilters, statusFilter])

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
  const tableHeaderCellClass = `${tableCellClass} bg-[#EDE7F6] text-[#17233B]`
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

  const handleDownloadReport = async () => {
    setIsDownloading(true)
    setError('')
    try {
      const allCampaigns: MailCampaignRecord[] = []
      let currentPage = 1
      let totalReportPages = 1
      do {
        const data = await getCampaigns({ search, page: currentPage, limit: 100, ...(statusFilter ? { status: statusFilter } : {}) })
        allCampaigns.push(...(data.data || []))
        totalReportPages = data.pagination?.totalPages || 1
        currentPage += 1
      } while (currentPage <= totalReportPages)

      if (!allCampaigns.length) {
        setError('There are no campaigns to download.')
        return
      }

      const toExcelDate = (value?: string) => {
        if (!value) return ''
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return ''
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        return `${day}-${month}-${date.getFullYear()}`
      }

      await downloadExcelReport({
        fileName: `${statusFilter ? statusFilter.toLowerCase() : 'mail'}-campaigns-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Mail Campaigns',
        headers: ['SL No.', 'Campaign ID', 'Campaign Name', 'Subject', 'Status', 'Created By', 'Date', 'Recipients', 'Opens (Total)', 'Unique Opens', 'Clicks (Total)'],
        rows: allCampaigns.map((campaign, index) => [
          index + 1,
          campaign.campaignId || '',
          campaign.campaignName || '',
          campaign.subject || '',
          campaign.status || '',
          campaign.createdBy || '',
          toExcelDate(campaign.createdDate),
          Number(campaign.recipientCount) || 0,
          Number(campaign.opens) || 0,
          Number(campaign.uniqueOpens) || 0,
          Number(campaign.clicks) || 0,
        ]),
        textColumns: [1, 2, 3, 4, 5, 6],
        centerColumns: [0, 1, 4, 6, 7, 8, 9, 10],
        leftColumns: [2, 3, 5],
        wrapColumns: [2, 3],
        wideColumns: [2, 3],
        columnWidths: [8, 14, 36, 40, 14, 18, 14, 12, 14, 14, 14],
      })
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the report.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-8">
      {statusFilter === 'Draft' || statusFilter === 'Scheduled' ? (
        <button type="button" onClick={() => navigate('/sales/mail-campaign')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]"><ArrowLeft className="h-4 w-4" /> Back to Mail Campaigns</button>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">{statusFilter ? `${statusFilter} Campaigns` : 'Mail Campaigns'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PageFilters
            fields={campaignFilterFields}
            values={campaignFilters}
            onApply={(values) => {
              setCampaignFilters(values)
              setPage(1)
            }}
            onClear={() => {
              setCampaignFilters({})
              setPage(1)
            }}
          />
          <button type="button" onClick={() => void handleDownloadReport()} disabled={isDownloading} className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm disabled:opacity-60">
            <Download className="h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download Report'}
          </button>
          <PermissionGate moduleName="mailCampaign" action="create">
            <button onClick={() => navigate('/sales/mail-campaign/new')} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1E293B]"><Plus className="h-4 w-4" /> Campaign</button>
          </PermissionGate>
        </div>
      </div>

      {!statusFilter ? (
        <div className="grid gap-6 md:grid-cols-3">
          <button type="button" onClick={() => navigate('/sales/mail-campaign')} className="text-left"><StatCard labelClassName="stat-card-label-increased" icon={Mail} label="Total Campaigns" value={stats.total} iconBg="bg-blue-50" iconColor="text-blue-600" /></button>
          <button type="button" onClick={() => navigate('/sales/mail-campaign/drafts')} className="text-left"><StatCard labelClassName="stat-card-label-increased" icon={FileText} label="Draft Campaigns" value={stats.drafts} iconBg="bg-violet-50" iconColor="text-violet-600" /></button>
          <button type="button" onClick={() => navigate('/sales/mail-campaign/sent')} className="text-left"><StatCard labelClassName="stat-card-label-increased" icon={Send} label="Sent Campaigns" value={stats.sent} iconBg="bg-green-50" iconColor="text-green-600" /></button>
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
          <table className="sales-data-table sales-mail-campaign-table w-full min-w-[900px] border-separate border-spacing-0 overflow-hidden rounded-lg border border-[#E5E7EB] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider">
                <th className={`${tableHeaderCellClass} w-[7%] text-center`}>Sl No.</th>
                <th className={`${tableHeaderCellClass} w-[12%]`}>Campaign ID</th>
                <th className={`${tableHeaderCellClass} w-[30%]`}>Campaign Name</th>
                <th className={`${tableHeaderCellClass} w-[15%]`}>Date</th>
                <th className={`${tableHeaderCellClass} w-[9%] text-center`}>View Template</th>
                <th className={`${tableHeaderCellClass} w-[9%] text-center`}>View Report</th>
                <th className={`${tableHeaderCellClass} w-[7%] text-center`}>Opens (Total)</th>
                <th className={`${tableHeaderCellClass} w-[6%] text-center`}>Clicks (Total)</th>
                <th className={`${tableHeaderCellClass} w-[8%] text-center`}>Delete</th>
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
                    <PermissionGate moduleName="mailCampaign" action="delete">
                      <button type="button" onClick={() => setDeleteTarget(campaign)} disabled={deletingCampaignId === campaign.campaignId} className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60" aria-label={`Delete ${campaign.campaignName}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingCampaignId === campaign.campaignId ? 'Deleting...' : 'Delete'}
                      </button>
                    </PermissionGate>
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
