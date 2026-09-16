import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, CalendarDays, UserCircle2, Activity, StickyNote, BadgeCheck } from 'lucide-react';
import { Toast } from '@/components/toast';
import { fetchLeadById, type LeadRecord } from '@/lib/leadApi';

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
};

export default function LeadDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const loadLead = async () => {
      if (!id) return;
      try {
        const current = await fetchLeadById(id);
        if (current) {
          setLead(current);
        }
      } catch {
        setToast('Unable to load lead details');
      }
    };

    void loadLead();
  }, [id]);

  if (!lead) {
    return <div className="rounded-lg border border-[#EFECE5] bg-white p-10 text-sm text-gray-600">Loading lead details…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/sales/leads')} className="mb-3 flex items-center gap-2 text-sm font-medium text-[#111827]">
            <ArrowLeft className="h-4 w-4" /> Back to Leads
          </button>
          <h1 className="crm-page-heading">Lead Details</h1>
          <p className="text-gray-600">Track the full journey of {lead.companyName}</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-semibold ${statusColors[lead.leadStatus || 'New'] || 'bg-blue-100 text-blue-700'}`}>
          {lead.leadStatus || 'New'}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-2xl bg-[#F2EFE8] p-3">
              <Building2 className="h-7 w-7 text-[#111827]" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-gray-900">{lead.companyName}</h2>
              <p className="text-sm text-gray-600">{lead.designation || 'Lead from CRM'}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</p>
              <p className="mt-2 font-semibold text-gray-900">{lead.contactPerson}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-600"><Mail className="h-4 w-4" /> {lead.email}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-600"><Phone className="h-4 w-4" /> {lead.mobile}</p>
            </div>
            <div className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign</p>
              <p className="mt-2 font-semibold text-gray-900">{lead.campaignName || 'Manual'}</p>
              <p className="mt-2 text-sm text-gray-600">ID: {lead.campaignId || 'N/A'}</p>
              <p className="mt-2 text-sm text-gray-600">Source: {lead.sourceOfLead || 'Manual'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-serif font-semibold text-gray-900">Lead Score</h3>
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-gray-900">{lead.leadScore || 0}</div>
              <div className={`rounded-full px-3 py-1 text-sm font-semibold ${lead.leadScore && lead.leadScore > 80 ? 'bg-red-100 text-red-700' : lead.leadScore && lead.leadScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                {lead.leadScore && lead.leadScore > 80 ? 'Hot' : lead.leadScore && lead.leadScore >= 50 ? 'Warm' : 'Cold'}
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">Priority: <span className="font-semibold text-gray-900">{lead.priority || 'Low'}</span></p>
          </div>
          <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-serif font-semibold text-gray-900">Assigned User</h3>
            <div className="flex items-center gap-3">
              <UserCircle2 className="h-6 w-6 text-[#111827]" />
              <div>
                <p className="font-semibold text-gray-900">{lead.assignedTo || 'Unassigned'}</p>
                <p className="text-sm text-gray-600">Created by {lead.createdBy || 'System'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><StickyNote className="h-5 w-5 text-[#111827]" /><h3 className="text-lg font-serif font-semibold text-gray-900">Notes</h3></div>
          <div className="space-y-3">
            {(lead.notes && lead.notes.length > 0) ? lead.notes.map((note, index) => (
              <div key={`${note.message}-${index}`} className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-3 text-sm text-gray-700">
                <p>{note.message}</p>
                <p className="mt-2 text-xs text-gray-500">{note.createdBy} • {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Just now'}</p>
              </div>
            )) : <p className="text-sm text-gray-600">No notes added yet.</p>}
          </div>
        </div>
        <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-[#111827]" /><h3 className="text-lg font-serif font-semibold text-gray-900">Activities</h3></div>
          <div className="space-y-3">
            {(lead.timeline && lead.timeline.length > 0) ? lead.timeline.slice().reverse().map((item, index) => (
              <div key={`${item.title}-${index}`} className="border-l-2 border-[#DAD5C9] pl-4">
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-600">{item.description}</p>
                <p className="mt-1 text-xs text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recently added'}</p>
              </div>
            )) : <p className="text-sm text-gray-600">No activity logged yet.</p>}
          </div>
        </div>
      </div>
      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  );
}
