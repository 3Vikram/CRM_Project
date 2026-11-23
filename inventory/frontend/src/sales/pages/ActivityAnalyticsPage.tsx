import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Download,
  ListChecks,
  Target,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  fetchActivityAnalytics,
  type ActivityAnalytics,
  type ActivityPerformanceInterval,
} from '@/sales/lib/activityApi'

const ACTIVITY_TYPES = ['All', 'Meeting', 'Call', 'Email', 'Demo', 'Site Visit', 'Follow-up', 'Support', 'Other']
const PERFORMANCE_OPTIONS: Array<{ value: ActivityPerformanceInterval; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]
const PERFORMANCE_RANGES = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
] as const
const todayInKolkata = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

const numberFormat = new Intl.NumberFormat('en-IN')
const getErrorMessage = (cause: unknown, fallback: string) => {
  if (cause && typeof cause === 'object' && 'response' in cause) {
    const response = cause.response
    if (response && typeof response === 'object' && 'data' in response) {
      const body = response.data
      if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
        return body.message
      }
    }
  }
  return cause instanceof Error ? cause.message : fallback
}
function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function EmptyChart({ children }: { children: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg bg-slate-50 px-5 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

function SkeletonDashboard() {
  return (
    <div className="space-y-6" aria-label="Loading activity analytics" aria-live="polite">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex h-16 animate-pulse items-center gap-2.5 rounded-xl border border-[#EFECE5] bg-white p-2.5">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-200" />
            <div className="flex flex-1 items-center justify-between gap-2">
              <div className="h-3 w-2/3 rounded bg-slate-200" />
              <div className="h-5 w-8 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-[350px] animate-pulse rounded-xl border border-[#EFECE5] bg-white p-5">
            <div className="h-4 w-1/3 rounded bg-slate-200" />
            <div className="mt-6 h-[270px] rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ActivityAnalyticsPage() {
  const navigate = useNavigate()
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ActivityAnalytics>()
  const [activityType, setActivityType] = useState('All')
  const [performanceRange, setPerformanceRange] = useState<(typeof PERFORMANCE_RANGES)[number]['value']>('week')
  const [performanceInterval, setPerformanceInterval] = useState<ActivityPerformanceInterval>('daily')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadAnalytics = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetchActivityAnalytics({
          activityType,
          dateRange: 'week',
          performanceRange,
          performanceInterval,
        })
        if (active) setData(response.data)
      } catch (cause) {
        if (active) {
          setData(undefined)
          setError(getErrorMessage(cause, 'Unable to load activity analytics.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadAnalytics()
    return () => { active = false }
  }, [activityType, performanceRange, performanceInterval])

  const exportPdf = async () => {
    if (!reportRef.current || !data) return
    setExporting(true)
    setError('')
    try {
      await html2pdf().set({
        margin: 8,
        filename: `activity-analytics-${todayInKolkata()}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }).from(reportRef.current).save()
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to generate the Activity Analytics PDF.'))
    } finally {
      setExporting(false)
    }
  }

  const cards = data ? [
    { label: 'Total Activities', value: numberFormat.format(data.cards.totalActivities), icon: Activity, background: '#DBEAFE', color: '#2563EB' },
    { label: "Today's Follow-ups", value: numberFormat.format(data.cards.todaysFollowUps), icon: CalendarCheck, background: '#DCFCE7', color: '#16A34A' },
    { label: 'Pending Follow-ups', value: numberFormat.format(data.cards.pendingFollowUps), icon: Clock3, background: '#FEF3C7', color: '#D97706' },
    { label: 'Positive & Negative Responses', value: `${data.cards.positiveResponses}:${data.cards.negativeResponses}`, icon: ThumbsUp, background: '#FFEDD5', color: '#EA580C' },
    { label: 'Number of Demos', value: numberFormat.format(data.cards.demos), icon: BarChart3, background: '#EDE9FE', color: '#7C3AED' },
    { label: 'Funnels Generated', value: numberFormat.format(data.cards.funnelsGenerated), icon: Target, background: '#F3E8FF', color: '#9333EA' },
    { label: 'Missed Follow-ups', value: numberFormat.format(data.cards.missedFollowUps), icon: ListChecks, background: '#FEE2E2', color: '#DC2626' },
    { label: 'Success Rate', value: `${data.cards.successRate.toFixed(1)}%`, icon: CheckCircle2, background: '#CFFAFE', color: '#0891B2' },
  ] satisfies Array<{ label: string; value: string; icon: LucideIcon; background: string; color: string }> : []

  const charts = data?.charts
  const hasPerformance = Boolean(charts?.activityPerformance.some((point) => point.count > 0))
  const hasCallsOrMeetings = Boolean(charts?.callsVsMeetings.some((point) => point.calls || point.meetings))
  const hasWeeklyActivity = Boolean(charts?.weeklyTrend.some((point) => point.total > 0))
  const hasFollowUps = Boolean(charts?.followUpCompletion.length)
  const hasProducts = Boolean(charts?.productAnalysis.length)
  const hasTypes = Boolean(charts?.activityTypeDistribution.length)
  const hasEmployees = Boolean(charts?.employeePerformance.some((employee) => employee.employee !== 'Unassigned'))
  const salesDistribution = charts?.salesDistribution
  const salesDistributionData = salesDistribution?.available
    ? [
      { name: 'Inside Sales', value: salesDistribution.inside || 0, color: '#6366F1' },
      { name: 'Field Sales', value: salesDistribution.field || 0, color: '#06B6D4' },
    ]
    : []

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/sales/activities')}
            aria-label="Back to activities"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EFECE5] bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="crm-page-heading !text-xl">Activity Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={loading || exporting || !data}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111827] px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </header>

      <section aria-label="Activity type filter" className="flex flex-wrap items-center gap-3 rounded-xl border border-[#EFECE5] bg-white px-4 py-3 shadow-sm">
        <label htmlFor="activity-analytics-type" className="text-sm font-medium text-slate-700">
          Activity Type
        </label>
        <select id="activity-analytics-type" value={activityType} onChange={(event) => setActivityType(event.target.value)} className="h-9 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]">
          {ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </section>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <SkeletonDashboard />
      ) : data ? (
        <div ref={reportRef} className="space-y-4">
          <section aria-label="Activity summary" className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon
              return (
                <article key={card.label} className="sales-summary-card !flex !h-16 !min-h-16 w-full !items-center gap-2.5 !p-2.5">
                  <div className="sales-summary-card-icon !h-10 !w-10 !shrink-0 !basis-10 !rounded-lg" style={{ backgroundColor: card.background, color: card.color }}>
                    <Icon aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <div className="sales-summary-card-label !block !truncate !text-xs !normal-case !tracking-normal">{card.label}</div>
                    <div className="sales-summary-card-value !shrink-0 !text-lg !leading-none">{card.value}</div>
                  </div>
                </article>
              )
            })}
          </section>

          <section aria-label="Activity charts" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartCard title="Activity Performance" subtitle={`Activity volume, ${PERFORMANCE_RANGES.find((option) => option.value === performanceRange)?.label.toLowerCase() || 'selected period'}`}>
                <div className="mb-2 flex flex-wrap justify-end gap-2">
                  <select
                    value={performanceRange}
                    onChange={(event) => setPerformanceRange(event.target.value as typeof performanceRange)}
                    aria-label="Activity performance date range"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                  >
                    {PERFORMANCE_RANGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select
                    value={performanceInterval}
                    onChange={(event) => setPerformanceInterval(event.target.value as ActivityPerformanceInterval)}
                    aria-label="Activity performance interval"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                  >
                    {PERFORMANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                {hasPerformance ? (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts?.activityPerformance} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={34} />
                        <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                        <Line type="monotone" dataKey="count" name="Activities" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366F1' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart>There are no activities in this reporting period.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Sales Distribution" subtitle="Inside Sales vs Field Sales">
                {salesDistribution?.available ? (
                  salesDistributionData.some((item) => item.value > 0) ? (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={salesDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={94} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                            {salesDistributionData.map((item) => <Cell key={item.name} fill={item.color} />)}
                          </Pie>
                          <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyChart>No sales-category activity is available for these filters.</EmptyChart>
                ) : <EmptyChart>{salesDistribution?.reason || 'Sales category data is unavailable.'}</EmptyChart>}
              </ChartCard>

              <ChartCard title="Calls vs Meetings" subtitle="Monthly comparison, last 8 months">
                {hasCallsOrMeetings ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts?.callsVsMeetings} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                        <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                        <Legend />
                        <Bar dataKey="calls" name="Calls" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="meetings" name="Meetings" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart>No calls or meetings were recorded in the selected period.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Follow-up Completion" subtitle="Completion rate by activity type">
                {hasFollowUps ? (
                  <div>
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts?.followUpCompletion} layout="vertical" margin={{ top: 8, right: 18, bottom: 4, left: 12 }}>
                          <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="type" width={92} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value, name) => [numberFormat.format(Number(value || 0)), name]} />
                          <Legend />
                          <Bar dataKey="completed" name="Completed" stackId="followups" fill="#10B981" />
                          <Bar dataKey="pending" name="Pending" stackId="followups" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {charts?.followUpCompletion.map((item) => (
                        <span key={item.type}>{item.type}: {item.rate.toFixed(1)}% complete</span>
                      ))}
                    </div>
                  </div>
                ) : <EmptyChart>No follow-up records were found for these filters.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Product-wise Activity Analysis" subtitle="Top five products by activity volume" className="lg:col-span-2">
                {hasProducts ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts?.productAnalysis} layout="vertical" margin={{ top: 8, right: 18, bottom: 4, left: 12 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="product" width={112} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                        <Bar dataKey="count" name="Activities" fill="#6366F1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart>No product data is associated with activities in this period.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Weekly Activity Trend" subtitle="Eight-week completion analysis" className="lg:col-span-2">
                {hasWeeklyActivity ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts?.weeklyTrend} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                        <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.weekStart || ''} formatter={(value) => numberFormat.format(Number(value || 0))} />
                        <Legend />
                        <Line type="monotone" dataKey="total" name="Total Activities" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="completed" name="Completed Activities" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="missed" name="Missed Activities" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart>No activity records are available for the last eight weeks under these filters.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Activity Type Distribution" subtitle="Recorded activity volume by type">
                {hasTypes ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts?.activityTypeDistribution} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="type" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={52} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={34} />
                        <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                        <Bar dataKey="count" name="Activities" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart>No activity types were recorded for these filters.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Employee Activity Performance" subtitle="Activities assigned to employees">
                {hasEmployees ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts?.employeePerformance.filter((employee) => employee.employee !== 'Unassigned')} layout="vertical" margin={{ top: 8, right: 18, bottom: 4, left: 12 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="employee" width={112} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                        <Legend />
                        <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="missed" name="Overdue" fill="#EF4444" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="count" name="Total Activities" fill="#6366F1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart>No assigned employee activity data is available for these filters.</EmptyChart>}
              </ChartCard>
          </section>
          <section aria-label="Today's timeline" className="rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Today&apos;s Timeline</h2>
                <p className="mt-1 text-xs text-slate-500">Activities scheduled for {todayInKolkata()}</p>
              </div>
              <button type="button" onClick={() => navigate('/sales/activities')} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                View All
              </button>
            </div>
            {data.timeline.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Activity</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Assigned To</th>
                      <th className="px-3 py-2 font-medium">Scheduled Time</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.timeline.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3">{item.activityType}</td>
                        <td className="px-3 py-3">{item.customerName}</td>
                        <td className="px-3 py-3">{item.assignedUser}</td>
                        <td className="px-3 py-3">{item.scheduledTime || 'Not recorded'}</td>
                        <td className="px-3 py-3">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No activities are scheduled for today.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
