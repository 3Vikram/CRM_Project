import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Toast } from '@/components/toast';
import { deleteActivity, fetchActivities, type ActivityRecord } from '@/lib/activityApi';
import { fetchCustomers } from '@/lib/customerApi';

const createdByOptions = ['Admin', 'Anaya Patel', 'Rahul Sharma', 'Rhea Shah', 'Maya Nair', 'System'];
const dateOptions = [
  { value: 'All', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'this-year', label: 'This Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom-date', label: 'Custom Date' },
];
const DATE_FORMATTER = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export default function ActivityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const [activityPendingDeletion, setActivityPendingDeletion] = useState<ActivityRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createdBy, setCreatedBy] = useState('All');
  const [customerName, setCustomerName] = useState('All');
  const [followUpPreset, setFollowUpPreset] = useState('All');
  const [toast, setToast] = useState<string | null>(null);
  const [customerOptions, setCustomerOptions] = useState<string[]>([]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchActivities({
        page,
        limit,
        createdBy: createdBy !== 'All' ? createdBy : '',
        customerName: customerName !== 'All' ? customerName : '',
        followUpPreset: followUpPreset !== 'All' ? followUpPreset : '',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setActivities(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalRows(response.pagination?.total || 0);
    } catch {
      setActivities([]);
      setTotalPages(1);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, createdBy, customerName, followUpPreset]);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await fetchCustomers({ limit: 500 });
        const names = (response.data || [])
          .map((item) => item.companyName || item.customerName || '')
          .filter(Boolean);
        setCustomerOptions(Array.from(new Set(names)).sort());
      } catch {
        setCustomerOptions([]);
      }
    };

    void loadCustomers();
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    const flashMessage = (location.state as { message?: string; refresh?: boolean } | null)?.message;
    if (flashMessage) {
      setToast(flashMessage);
    }
    if ((location.state as { refresh?: boolean } | null)?.refresh) {
      void loadActivities();
    }
  }, [location.state, loadActivities]);

  const handleSearch = useCallback(() => {
    setPage(1);
    void loadActivities();
  }, [loadActivities]);

  const handleDownloadReport = useCallback(() => {
    const csvHeader = [
      'Activity ID',
      'Representative',
      'Company',
      'Activity Type',
      'Activity Date',
      // 'Activity Time',
      'Follow-up Date',
      // 'Follow-up Time',
      'Product',
      'Requirements',
      'Remarks',
      'Contact Person',
      'Contact Mail',
      'Contact Mobile',
      'Activity Status',
    ];

    const csvRows = activities.map((activity) => [
      activity.activityId || activity._id,
      activity.assignedUser || '',
      activity.company || activity.customerName || '',
      activity.activityType || '',
      activity.activityDate || '',
      activity.followUpDate || '',
      activity.product || '',
      activity.customerRequirements || '',
      activity.customerRemarks || '',
      activity.contactPerson || '',
      activity.email || '',
      activity.mobileNo || '',
      activity.status || '',
    ]);

    const csvContent = [csvHeader, ...csvRows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'activity-report.csv';
    link.click();
    URL.revokeObjectURL(url);
    setToast('Activity report downloaded');
  }, [activities]);

  const handleDelete = useCallback(async () => {
    if (!activityPendingDeletion) return;

    setDeleting(true);
    try {
      await deleteActivity(activityPendingDeletion._id);
      setActivityPendingDeletion(null);
      setToast('Activity deleted successfully');
      await loadActivities();
    } catch {
      setToast('Unable to delete activity');
    } finally {
      setDeleting(false);
    }
  }, [activityPendingDeletion, loadActivities]);

  const summaryText = useMemo(() => {
    const start = (page - 1) * limit + 1;
    return `Showing ${start} to ${Math.min(page * limit, totalRows)} of ${totalRows} entries`;
  }, [page, limit, totalRows]);

  const tableCellClass = 'px-4 py-3 border-r border-[#D1D5DB]';

  return (
    <div className="space-y-6" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="crm-page-heading">Activity Dashboard</h1>
          {/* <p className="text-sm text-gray-600">Search, filter, review, and export activity records across the CRM.</p> */}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* <button type="button" onClick={handleSearch} className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white">
            <Search className="h-4 w-4" /> Search
          </button> */}
          <button type="button" onClick={handleDownloadReport} className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700">
            <Download className="h-4 w-4" /> Download Report
          </button>
          <button type="button" onClick={() => navigate('/sales/activities/new')} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E293B]">
            <Plus className="h-4 w-4" /> Add New
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Created By</span>
            <select value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              {['All', ...createdByOptions].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer Name</span>
            <select value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              <option value="All">All</option>
              {customerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Follow-up Date</span>
            <select value={followUpPreset} onChange={(event) => setFollowUpPreset(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              {dateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

        </div>
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#EFECE5] text-sm">
            <thead className="bg-[#F8F7F3] text-left text-xs font-semibold tracking-wider text-gray-600">
              <tr>
                <th className={tableCellClass}>SL No</th>
                <th className={tableCellClass}>REPRESENTATIVE</th>
                <th className={tableCellClass}>ACTIVITY ID</th>
                <th className={tableCellClass}>COMPANY</th>
                <th className={tableCellClass}>ACTIVITY TYPE</th>
                <th className={tableCellClass}>ACTIVITY DATE</th>
                {/* <th className={tableCellClass}>Activity Time</th> */}
                <th className={tableCellClass}>FOLLOW-UP DATE</th>
                {/* <th className={tableCellClass}>Follow-up Time</th> */}
                <th className={tableCellClass}>PRODUCT</th>
                <th className={tableCellClass}>REQUIREMENTS</th>
                <th className={tableCellClass}>REMARKS</th>
                <th className={tableCellClass}>CONTACT PERSON</th>
                <th className={tableCellClass}>CONTACT MAIL</th>
                <th className={tableCellClass}>CONTACT MOBILE</th>
                <th className={tableCellClass}>ACTIVITY STATUS</th>
                <th className="px-4 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE5] bg-white text-gray-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td colSpan={15} className="px-4 py-6">
                      <div className="h-4 animate-pulse rounded bg-[#EFECE5]" />
                    </td>
                  </tr>
                ))
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center text-sm text-gray-500">No activities found</td>
                </tr>
              ) : (
                activities.map((activity, index) => (
                  <tr key={activity._id} className="align-top">
                    <td className={tableCellClass}>{(page - 1) * limit + index + 1}</td>
                    <td className={tableCellClass}>{activity.assignedUser || 'Admin'}</td>
                    <td className={tableCellClass}>{activity.activityId || activity._id}</td>
                    <td className={tableCellClass}>{activity.company || activity.customerName || '-'}</td>
                    <td className={tableCellClass}>{activity.activityType || '-'}</td>
                    <td className={tableCellClass}>{activity.activityDate || '-'}</td>
                    <td className={tableCellClass}>{activity.followUpDate || '-'}</td>
                    <td className={tableCellClass}>{activity.product || '-'}</td>
                    <td className={`${tableCellClass} max-w-[200px]`}>{activity.customerRequirements || '-'}</td>
                    <td className={`${tableCellClass} max-w-[200px]`}>{activity.customerRemarks || '-'}</td>
                    <td className={tableCellClass}>{activity.contactPerson || '-'}</td>
                    <td className={tableCellClass}>{activity.email || '-'}</td>
                    <td className={tableCellClass}>{activity.mobileNo || '-'}</td>
                    <td className={tableCellClass}><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{activity.status || 'Open'}</span></td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setSelectedActivity(activity)} className="flex items-center gap-1 rounded bg-[#F2EFE8] px-2.5 py-1 text-xs font-medium text-gray-700">
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <button type="button" onClick={() => navigate(`/sales/activities/edit/${activity._id}`)} className="flex items-center gap-1 rounded bg-[#F2EFE8] px-2.5 py-1 text-xs font-medium text-gray-700">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button type="button" onClick={() => setActivityPendingDeletion(activity)} className="flex items-center gap-1 rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE5] bg-[#FAF8F2] px-4 py-3 text-sm text-gray-600">
          <div>{summaryText}</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded border border-[#EFECE5] px-3 py-1.5 disabled:opacity-50">Previous</button>
            <span className="font-medium text-gray-700">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded border border-[#EFECE5] px-3 py-1.5 disabled:opacity-50">Next</button>
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="rounded border border-[#EFECE5] px-2 py-1.5 text-sm">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {selectedActivity && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedActivity(null)}>
          <div className="fixed right-0 top-[calc(4rem+20px)] z-50 h-[calc(100vh-4rem-20px)] w-full max-w-[520px] overflow-y-auto border-l border-[#EFECE5] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EFECE5] bg-white px-4 py-3">
              <button type="button" onClick={() => setSelectedActivity(null)} className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 transition hover:bg-[#F2EFE8]">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h3 className="text-base font-bold text-gray-900">Activity Details</h3>
              <button type="button" onClick={() => setSelectedActivity(null)} className="rounded-lg p-2 text-gray-500 hover:bg-[#F2EFE8] hover:text-gray-800" aria-label="Close details drawer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5 text-sm text-gray-700">
              <div className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{selectedActivity.company || selectedActivity.customerName || 'N/A'}</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard label="Contact Person" value={selectedActivity.contactPerson || 'N/A'} />
                <DetailCard label="Designation" value={selectedActivity.designation || 'N/A'} />
                <DetailCard label="Email" value={selectedActivity.email || 'N/A'} />
                <DetailCard label="Mobile" value={selectedActivity.mobileNo || 'N/A'} />
                <DetailCard label="Location" value={selectedActivity.location || 'N/A'} />
                <DetailCard label="Activity Type" value={selectedActivity.activityType || 'N/A'} />
                <DetailCard label="Activity Date" value={selectedActivity.activityDate || 'N/A'} />
                <DetailCard label="Follow-up Date" value={selectedActivity.followUpDate || 'N/A'} />
                <DetailCard label="Response" value={selectedActivity.response || 'N/A'} />
                <DetailCard label="Product" value={selectedActivity.product || 'N/A'} />
                <DetailCard label="Source of Lead" value={selectedActivity.sourceOfLead || 'N/A'} />
                <DetailCard label="Assigned User" value={selectedActivity.assignedUser || 'N/A'} />
                <DetailCard label="Created By" value={selectedActivity.createdBy || 'N/A'} />
                <DetailCard label="Created Date" value={selectedActivity.createdAt ? DATE_FORMATTER.format(new Date(selectedActivity.createdAt)) : 'N/A'} />
              </div>

              <div className="rounded-lg border border-[#EFECE5] p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer Requirements</div>
                <div className="mt-2 text-gray-900">{selectedActivity.customerRequirements || 'N/A'}</div>
              </div>
              <div className="rounded-lg border border-[#EFECE5] p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Remarks</div>
                <div className="mt-2 text-gray-900">{selectedActivity.customerRemarks || 'N/A'}</div>
              </div>
              <div className="rounded-lg border border-[#EFECE5] p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Timeline</div>
                <div className="mt-2 text-gray-900">No timeline captured for this activity.</div>
              </div>
              <div className="rounded-lg border border-[#EFECE5] p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Notes</div>
                <div className="mt-2 text-gray-900">No notes captured for this activity.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activityPendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !deleting && setActivityPendingDeletion(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-activity-title" className="w-full max-w-md rounded-lg bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#EFECE5] px-5 py-4">
              <h2 id="delete-activity-title" className="text-lg font-bold text-gray-900">Delete Activity</h2>
              <button type="button" onClick={() => setActivityPendingDeletion(null)} disabled={deleting} className="rounded-lg p-2 text-gray-500 hover:bg-[#F2EFE8] hover:text-gray-800 disabled:opacity-50" aria-label="Close delete confirmation">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-6 text-sm text-gray-700">Are you sure to want to delete this activity?</div>
            <div className="flex justify-end gap-3 border-t border-[#EFECE5] px-5 py-4">
              <button type="button" onClick={() => setActivityPendingDeletion(null)} disabled={deleting} className="rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={() => void handleDelete()} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#EFECE5] p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-2 font-medium text-gray-900">{value}</div>
    </div>
  );
}
