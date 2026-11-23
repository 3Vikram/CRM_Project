'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Search,
  Plus,
  Download,
  Activity,
  BarChart3,
  Sparkles,
  Clock3,
  Flame,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { LeadDetailsDrawer } from '@/components/LeadDetailsDrawer'
import { PermissionGate } from '@/components/PermissionGate'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/toast'
import { fetchLeads, moveLeadToActivity, moveLeadToFunnel, generateLeadQuotation, convertLeadToCustomer, scrapLead, deleteLead, updateLead, isLeadAssigned, LEAD_ASSIGNMENT_REQUIRED_MESSAGE, type LeadRecord } from '@/lib/leadApi'
import { fetchEmployees, type EmployeeRecord } from '@/lib/employeeApi'
import { clearApiCache } from '@/lib/apiCache'

interface LeadsPageProps {
  pageTitle?: string
  initialStatusFilter?: string
  addButtonLabel?: string
  onAddButtonClick?: () => void
  showAddButton?: boolean
}

const statusColors: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700',
  Contacted: 'bg-sky-100 text-sky-700',
  'Follow-up': 'bg-amber-100 text-amber-700',
  Interested: 'bg-violet-100 text-violet-700',
  Qualified: 'bg-emerald-100 text-emerald-700',
  'Proposal Sent': 'bg-purple-100 text-purple-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
  Scrapped: 'bg-gray-100 text-gray-700',
}

const PAGE_SIZE = 8
const tableCellClass = 'px-4 py-3 border-r border-[#D1D5DB]'

export default function LeadsPage({
  pageTitle = 'Lead Management',
  initialStatusFilter = 'all',
  addButtonLabel = 'Add Lead',
  onAddButtonClick,
  showAddButton = true,
}: LeadsPageProps) {
  console.log('LeadsPage Started')
  const navigate = useNavigate()
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const visibleLeads = leads
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LeadRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [ownerTarget, setOwnerTarget] = useState<LeadRecord | null>(null)
  const [ownerMenuPosition, setOwnerMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [isAssigningOwner, setIsAssigningOwner] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(8)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info')
  const [isLoading, setIsLoading] = useState(false)

  const loadLeads = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = { page, limit, search: searchQuery, status: statusFilter === 'all' ? '' : statusFilter, source: sourceFilter === 'all' ? '' : sourceFilter }
      const response = await fetchLeads(params)
      setLeads(response.data)
      setTotalPages(response.pagination.totalPages)
      setTotalCount(response.pagination.total || 0)
    } catch {
      setToast('Unable to load leads')
    } finally {
      setIsLoading(false)
    }
  }, [limit, page, searchQuery, sourceFilter, statusFilter])

  useEffect(() => { void loadLeads() }, [loadLeads])

  useEffect(() => {
    void fetchEmployees({ limit: 1000, status: 'Active' })
      .then((response) => setEmployees(response.data || []))
      .catch((error) => {
        console.error('Unable to load employees for lead assignment:', error)
        setToast('Unable to load employees')
      })
  }, [])

  useEffect(() => { setPage(1) }, [searchQuery, statusFilter, sourceFilter])

  useEffect(() => {
    setStatusFilter(initialStatusFilter)
  }, [initialStatusFilter])

  const handleAction = async (action: string, lead: LeadRecord, anchorRect?: DOMRect) => {
    setToastType('info')
    try {
      if (action === 'view') {
        setSelectedLead(lead)
        setIsDrawerOpen(true)
      }
      if (action === 'delete') {
        setDeleteTarget(lead)
      }
      if (action === 'edit') navigate(`/sales/leads/edit/${lead._id}`)
      if (action === 'owner') {
        if (anchorRect) {
          const menuWidth = 224
          const menuHeight = 280
          setOwnerMenuPosition({
            top: Math.max(8, Math.min(anchorRect.bottom + 4, window.innerHeight - menuHeight - 8)),
            left: Math.max(8, Math.min(anchorRect.right - menuWidth, window.innerWidth - menuWidth - 8)),
          })
        }
        setOwnerTarget(lead)
        return
      }
      if (action === 'followup') {
        const followUpDate = window.prompt('Schedule follow-up date', lead.followUpDate || '')
        if (followUpDate !== null) {
          const followUpTime = window.prompt('Schedule follow-up time', lead.followUpTime || '') || ''
          setLeads((prev) => prev.map((item) => item._id === lead._id ? { ...item, followUpDate: followUpDate || '', followUpTime } : item))
          setToast('Follow-up scheduled')
        }
      }
      if (action === 'activity') {
        if (isLeadAssigned(lead.assignedTo)) {
          try {
            await moveLeadToActivity(lead._id)
            setToastType('success')
            setToast('Lead moved to activity')
          } catch (error) {
            const message = axios.isAxiosError<{ message?: string }>(error)
              ? error.response?.data?.message
              : error instanceof Error ? error.message : undefined
            setToastType('error')
            setToast(message || 'Unable to move lead to activity')
            return
          }
        }

        navigate('/sales/activities/new', {
          state: {
            lead,
            source: 'lead-management',
          },
        })

        return
      }
      if (action === 'funnel') { await moveLeadToFunnel(lead._id); setToast('Lead moved to funnel'); await loadLeads() }
      if (action === 'quotation') { await generateLeadQuotation(lead._id); setToast('Quotation generated'); await loadLeads() }
      if (action === 'convert') { await convertLeadToCustomer(lead._id); setToast('Lead converted to customer'); await loadLeads() }
      if (action === 'scrap') { const reason = window.prompt('Enter scrap reason', 'No reason provided') || 'No reason provided'; await scrapLead(lead._id, reason); setToast('Lead scrapped'); await loadLeads() }
      // reload current page after actions that change state
      if (['activity', 'funnel', 'quotation', 'convert', 'scrap'].includes(action)) {
        await loadLeads()
      }
    } catch {
      setToast('Action failed')
    }
  }

  const metrics = useMemo(() => {
    const total = leads.length
    const newToday = leads.filter((lead) => (lead.createdDate ? new Date(lead.createdDate).toDateString() === new Date().toDateString() : false)).length
    const pending = leads.filter((lead) => (lead.leadStatus || 'New') === 'Follow-up' || (lead.leadStatus || 'New') === 'New').length
    const hot = leads.filter((lead) => (lead.leadScore || 0) > 80).length
    const followUps = leads.filter((lead) => (lead.followUpDate || '').length > 0).length
    const activities = leads.filter((lead) => (lead.timeline || []).length > 0).length
    const funnels = leads.filter((lead) => ['Qualified', 'Proposal Sent', 'Negotiation', 'Won'].includes(lead.leadStatus || 'New')).length
    const quotations = leads.filter((lead) => (lead.leadStatus || 'New') === 'Proposal Sent').length
    const converted = leads.filter((lead) => lead.isConverted).length
    const scrapped = leads.filter((lead) => lead.isScrapped).length
    return { total, newToday, pending, hot, followUps, activities, funnels, quotations, converted, scrapped }
  }, [leads])

  return (
    <div className="space-y-6">
      
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">{pageTitle}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showAddButton && <PermissionGate moduleName="leads" action="create">
            <button onClick={() => (onAddButtonClick ? onAddButtonClick() : navigate('/sales/leads/new'))} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B]">
              <Plus className="h-4 w-4" /> {addButtonLabel}
            </button>
          </PermissionGate>}
          <button className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-[#E7E3DA]">
            <Download className="h-4 w-4" /> Download Report
          </button>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search lead" className="w-full rounded-lg border border-[#EFECE5] bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard labelClassName="stat-card-label-increased" icon={BarChart3} label="Total Leads" value={metrics.total} description="All leads in the CRM" iconBg="bg-blue-100" iconColor="text-blue-700" />
        <StatCard labelClassName="stat-card-label-increased" icon={Sparkles} label="New Leads Today" value={metrics.newToday} description="Freshly created today" iconBg="bg-emerald-100" iconColor="text-emerald-700" />
        {/* <StatCard icon={Clock3} label="Pending Leads" value={metrics.pending} description="Awaiting attention" iconBg="bg-amber-100" iconColor="text-amber-700" /> */}
        {/* <StatCard icon={Flame} label="Hot Leads" value={metrics.hot} description="Score above 80" iconBg="bg-rose-100" iconColor="text-rose-700" /> */}
        <StatCard labelClassName="stat-card-label-increased" icon={RefreshCw} label="Follow-ups Today" value={metrics.followUps} description="Scheduled follow ups" iconBg="bg-violet-100" iconColor="text-violet-700" />
        <StatCard labelClassName="stat-card-label-increased" icon={Activity} label="Total Activities Generated" value={metrics.activities} description="Tracked events" iconBg="bg-sky-100" iconColor="text-sky-700" />
        <StatCard labelClassName="stat-card-label-increased" icon={Users} label="Total Funnels Generated" value={metrics.funnels} description="Qualified pipeline" iconBg="bg-indigo-100" iconColor="text-indigo-700" />
        <StatCard labelClassName="stat-card-label-increased" icon={FileText} label="Total Quotations Generated" value={metrics.quotations} description="Proposals sent" iconBg="bg-purple-100" iconColor="text-purple-700" />
        <StatCard labelClassName="stat-card-label-increased" icon={CheckCircle2} label="Converted Leads" value={metrics.converted} description="Won customers" iconBg="bg-green-100" iconColor="text-green-700" />
        <StatCard labelClassName="stat-card-label-increased" icon={XCircle} label="Scrapped Leads" value={metrics.scrapped} description="Closed as lost" iconBg="bg-gray-100" iconColor="text-gray-700" />
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Status</span>
            <select className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              {Object.keys(statusColors).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Source</span>
            <select className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="Mail Campaign">Mail Campaign</option>
              <option value="Manual">Manual</option>
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#EFECE5]">
          {isLoading ? <div className="p-8 text-center text-sm text-gray-500">Loading leads…</div> : (
            <table className="min-w-full text-sm">
              <thead className="bg-[#F2EFE8] text-left text-xs uppercase tracking-wider text-gray-600">
                <tr>
                  <th className={tableCellClass}>Lead ID</th>
                  <th className={tableCellClass}>Company</th>
                  <th className={tableCellClass}>Contact</th>
                  <th className={tableCellClass}>Email</th>
                  <th className={tableCellClass}>Source</th>
                  <th className={tableCellClass}>Assigned To</th>
                  <th className={tableCellClass}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.map((lead) => (
                  <tr key={lead._id} className="border-t border-[#EFECE5] bg-white">
                    <td className={`${tableCellClass} font-semibold text-gray-900`}>{lead.leadId || lead._id.slice(-6)}</td>
                    <td className={`${tableCellClass} text-gray-700`}>{lead.companyName}</td>
                    <td className={`${tableCellClass} text-gray-700`}>{lead.contactPerson}</td>
                    <td className={`${tableCellClass} text-gray-700`}>{lead.email}</td>
                    <td className={`${tableCellClass} text-gray-700`}>{lead.sourceOfLead || 'Manual'}</td>
                    <td className={`${tableCellClass} text-gray-700`}>{lead.assignedTo || 'Unassigned'}</td>
                    <td className={tableCellClass}>
                      <ActionMenu moduleName="leads" onView={() => void handleAction('view', lead)} onEdit={() => void handleAction('edit', lead)} onDelete={() => void handleAction('delete', lead)}>
                        {(closeMenu, buttonRect) => (
                          <>
                            <button type="button" role="menuitem" onClick={() => { closeMenu(); void handleAction('owner', lead, buttonRect) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]"><Users className="h-4 w-4" /> Assign Owner</button>
                            <button type="button" role="menuitem" onClick={() => { closeMenu(); void handleAction('followup', lead) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]"><Calendar className="h-4 w-4" /> Schedule Follow-up</button>
                            <button type="button" role="menuitem" onClick={() => { closeMenu(); void handleAction('activity', lead) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]"><Calendar className="h-4 w-4" /> Move To Activity</button>
                            <button type="button" role="menuitem" onClick={() => { closeMenu(); void handleAction('convert', lead) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]"><CheckCircle2 className="h-4 w-4" /> Convert To Customer</button>
                            <button type="button" role="menuitem" onClick={() => { closeMenu(); void handleAction('scrap', lead) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]"><XCircle className="h-4 w-4" /> Scrap Lead</button>
                          </>
                        )}
                      </ActionMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>Showing {visibleLeads.length} of {totalCount} leads</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} className="rounded border border-[#EFECE5] p-2 hover:bg-[#F2EFE8]" disabled={page === 1}><ChevronLeft className="h-4 w-4" /></button>
            <span className="rounded bg-[#F2EFE8] px-3 py-1 text-sm font-medium text-gray-700">{page} / {totalPages}</span>
            <button onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} className="rounded border border-[#EFECE5] p-2 hover:bg-[#F2EFE8]" disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {ownerTarget && ownerMenuPosition ? createPortal(
        <div
          className="fixed z-[9999] w-56 overflow-y-auto rounded-lg border border-[#EFECE5] bg-white p-2 shadow-xl"
          style={{ top: ownerMenuPosition.top, left: ownerMenuPosition.left, maxHeight: '250px' }}
        >
          <div className="border-b border-[#EFECE5] px-3 py-2 text-sm font-semibold text-gray-700">Assign Owner</div>
          {employees.length ? employees.map((employee) => (
            <button
              key={employee._id}
              type="button"
              disabled={isAssigningOwner}
              onClick={async () => {
                if (!ownerTarget) return
                setIsAssigningOwner(true)
                try {
                  await updateLead(ownerTarget._id, {
                    assignedTo: employee.employeeName || employee.fullName || employee.email,
                    assignedToId: employee._id,
                  })
                  setOwnerTarget(null)
                  setOwnerMenuPosition(null)
                  setToast('Owner assigned')
                  clearApiCache()
                  await loadLeads()
                } catch (error) {
                  console.error('Assign owner error:', error)
                  setToast('Unable to assign owner')
                } finally {
                  setIsAssigningOwner(false)
                }
              }}
              className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8] disabled:opacity-60"
            >
              {employee.employeeName || employee.fullName || employee.email}
            </button>
          )) : <div className="px-3 py-2 text-sm text-gray-500">No active employees found.</div>}
        </div>,
        document.body,
      ) : null}

      <LeadDetailsDrawer
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {deleteTarget ? createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/30 p-4" onClick={() => !isDeleting && setDeleteTarget(null)}>
          <div className="w-full max-w-[420px] rounded-xl border border-[#EFECE5] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-lead-title">
            <h2 id="delete-lead-title" className="text-lg font-semibold text-gray-900">Are you sure to delete this lead?</h2>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-[#F2EFE8] disabled:opacity-60">Cancel</button>
              <button type="button" onClick={async () => {
                if (!deleteTarget) return
                setIsDeleting(true)
                try {
                  console.log('Deleting lead with MongoDB _id:', deleteTarget._id, 'custom leadId:', deleteTarget.leadId)
                  await deleteLead(deleteTarget._id)
                  setDeleteTarget(null)
                  setToast('Lead deleted')
                  await loadLeads()
                } catch (error) {
                  console.error('Delete lead error:', error)
                  setToast('Unable to delete lead')
                } finally {
                  setIsDeleting(false)
                }
              }} disabled={isDeleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">Delete</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {toast && <Toast message={toast} type={toastType} onClose={() => setToast(null)} />}
    </div>
  )
}
