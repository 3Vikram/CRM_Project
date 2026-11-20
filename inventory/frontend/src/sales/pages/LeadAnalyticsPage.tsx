import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Download,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchLeadAnalytics, type LeadAnalytics } from '@/sales/lib/leadApi'

const LEAD_STATUSES = ['New', 'Contacted', 'Follow-up', 'Interested', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Scrapped']
const numberFormat = new Intl.NumberFormat('en-IN')
const currencyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const AGE_COLORS = ['#10B981', '#06B6D4', '#6366F1', '#F59E0B', '#EF4444']
const todayDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}
function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </header>
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

function LoadingDashboard() {
  return (
    <div className="space-y-5" aria-label="Loading lead analytics" aria-live="polite">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="h-[88px] animate-pulse rounded-xl border border-[#EFECE5] bg-white p-4">
            <div className="h-3 w-2/3 rounded bg-slate-200" />
            <div className="mt-5 h-5 w-1/3 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[330px] animate-pulse rounded-xl border border-[#EFECE5] bg-white p-5">
            <div className="h-4 w-1/3 rounded bg-slate-200" />
            <div className="mt-6 h-[260px] rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LeadAnalyticsPage() {
  const navigate = useNavigate()
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<LeadAnalytics>()
  const [status, setStatus] = useState('All')
  const [source, setSource] = useState('All')
  const [employeeOption, setEmployeeOption] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const selectedEmployee = employeeOption
    ? {
      employeeId: employeeOption.split('|')[0].slice(3),
      employeeName: decodeURIComponent(employeeOption.split('|')[1]?.slice(5) || ''),
    }
    : { employeeId: '', employeeName: '' }

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetchLeadAnalytics({
          status,
          source,
          ...selectedEmployee,
        })
        if (active) setData(response.data)
      } catch (cause) {
        if (active) {
          setData(undefined)
          setError(cause instanceof Error ? cause.message : 'Unable to load lead analytics.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [status, source, employeeOption, refreshKey])

  const exportPdf = async () => {
    if (!reportRef.current || !data) return
    setExporting(true)
    setError('')
    try {
      await html2pdf().set({
        margin: 8,
        filename: `lead-analytics-${todayDateKey()}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }).from(reportRef.current).save()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate the Lead Analytics PDF.')
    } finally {
      setExporting(false)
    }
  }

  const hasLeads = Boolean(data?.kpis.totalLeads)
  const hasAging = Boolean(data?.charts.leadAging.totalOpenLeads)
  const kpis = data ? [
    { label: 'Total Leads', value: numberFormat.format(data.kpis.totalLeads), icon: Users, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Open Leads', value: numberFormat.format(data.kpis.openLeads), icon: Target, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Conversion Rate', value: `${data.kpis.conversionRate.toFixed(1)}%`, icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Expiring Follow Up', value: numberFormat.format(data.kpis.expiringFollowUps), icon: CalendarClock, tone: 'bg-rose-50 text-rose-600' },
    { label: 'Leads This Month', value: numberFormat.format(data.kpis.leadsThisMonth), icon: BarChart3, tone: 'bg-orange-50 text-orange-600' },
  ] : []
  const revenueAvailable = Boolean(data?.charts.pipelineValueAvailable)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/sales/leads')}
            aria-label="Back to leads"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EFECE5] bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="crm-page-heading !text-xl">Lead Analytics Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={() => void exportPdf()} disabled={loading || exporting || !data} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111827] px-3.5 text-sm font-medium text-white shadow-sm hover:bg-[#1E293B] disabled:opacity-60">
            <Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Download PDF'}
          </button>
        </div>
      </header>

      <section aria-label="Lead analytics filters" className="grid grid-cols-1 items-center gap-2 rounded-xl border border-[#EFECE5] bg-white px-3 py-2 shadow-sm sm:grid-cols-3">
        <label className="sr-only" htmlFor="lead-analytics-status">Lead filter</label>
        <select id="lead-analytics-status" aria-label="Lead filter" value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">
            <option value="All">All</option>
            {(data?.filters.availableStatuses || LEAD_STATUSES).map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Account Manager
          <select value={employeeOption} onChange={(event) => setEmployeeOption(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">
            <option value="">All employees</option>
            {(data?.filters.availableEmployees || []).map((employee) => {
              const value = `id:${employee.id}|name:${encodeURIComponent(employee.name)}`
              return <option key={value} value={value}>{employee.name}</option>
            })}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Source
          <select value={source} onChange={(event) => setSource(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">
            <option value="All">All</option>
            {(data?.filters.availableSources || []).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </section>

      {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {loading ? <LoadingDashboard /> : data ? (
        <div ref={reportRef} className="space-y-4">
          <section aria-label="Lead analytics summary" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map(({ label, value, icon: Icon, tone }) => (
              <article key={label} className="flex h-[72px] min-w-0 items-center gap-2.5 rounded-xl border border-[#EFECE5] bg-white px-3 py-2.5 shadow-sm">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-[18px] w-[18px]" /></span>
                <div className="min-w-0">
                  <p className="text-[20px] font-semibold leading-tight text-slate-900">{value}</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{label}</p>
                </div>
              </article>
            ))}
          </section>

          <section aria-label="Lead analytics charts" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="Leads by Source" subtitle="Lead records grouped by their recorded source">
              {data.charts.leadsBySource.length ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.leadsBySource} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="source" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                      <Tooltip formatter={(value) => [numberFormat.format(Number(value || 0)), 'Leads']} />
                      <Bar dataKey="count" name="Leads" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No lead sources are recorded for these filters.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Monthly Lead Trend" subtitle="Lead creation count for each month in the selected range">
              {hasLeads ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.charts.monthlyTrend} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={12} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                      <Tooltip formatter={(value) => [numberFormat.format(Number(value || 0)), 'Leads']} />
                      <Line type="monotone" dataKey="count" name="Leads" stroke="#0EA5E9" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No leads were created during the selected period.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Top Employees" subtitle={revenueAvailable ? 'Assigned lead count and available pipeline value' : 'Assigned lead count; pipeline value is not available'}>
              {data.charts.topEmployees.length ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.topEmployees} margin={{ top: 8, right: 14, bottom: 38, left: 4 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="employee" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={56} />
                      <YAxis yAxisId="leads" allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                      {revenueAvailable ? <YAxis yAxisId="pipeline" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(value) => numberFormat.format(Number(value))} width={58} /> : null}
                      <Tooltip formatter={(value, name) => name === 'Pipeline Value'
                        ? [currencyFormat.format(Number(value || 0)), name]
                        : [numberFormat.format(Number(value || 0)), name]} />
                      <Bar yAxisId="leads" dataKey="leadCount" name="Leads" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      {revenueAvailable ? <Bar yAxisId="pipeline" dataKey="pipelineValue" name="Pipeline Value" fill="#10B981" radius={[4, 4, 0, 0]} /> : null}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No employee-assigned leads are available for these filters.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Lead Funnel" subtitle="Lead counts by supported CRM status; percent of filtered leads">
              {hasLeads ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.leadFunnel.filter((stage) => stage.count > 0)} layout="vertical" margin={{ top: 6, right: 18, bottom: 6, left: 8 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="stage" width={94} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value, _name, item) => [
                        `${numberFormat.format(Number(value || 0))} (${Number(item?.payload?.percent || 0).toFixed(1)}%)`,
                        'Leads',
                      ]} />
                      <Bar dataKey="count" name="Leads" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No leads match the selected filters.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Follow-up Analysis" subtitle="Open leads grouped by current follow-up status">
              {hasLeads ? (
                <div className="flex h-[310px] flex-col justify-center gap-5 px-3">
                  {[
                    { label: 'Overdue follow-ups', value: data.charts.followUpAnalysis.overdue, color: 'bg-rose-500' },
                    { label: 'Follow-ups not scheduled', value: data.charts.followUpAnalysis.unscheduled, color: 'bg-amber-500' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="font-semibold text-slate-900">{numberFormat.format(item.value)}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${data.kpis.openLeads ? `${Math.min(100, (item.value / data.kpis.openLeads) * 100)}%` : '0%'}` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyChart>No follow-up data is available for these filters.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Lead Aging" subtitle="Age of open leads at the time of this report">
              {hasAging ? (
                <>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.leadAging.groups} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="age" tick={{ fontSize: 9 }} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                        <Tooltip formatter={(value, _name, item) => [
                          `${numberFormat.format(Number(value || 0))} (${Number(item?.payload?.percent || 0).toFixed(1)}%)`,
                          'Open Leads',
                        ]} />
                        <Bar dataKey="count" name="Open Leads" radius={[4, 4, 0, 0]}>
                          {data.charts.leadAging.groups.map((group, index) => <Cell key={group.age} fill={AGE_COLORS[index]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">
                    <div><p className="text-slate-500">Active ≤15 days</p><p className="mt-1 font-semibold text-slate-900">{numberFormat.format(data.charts.leadAging.activeWithin15Days)}</p></div>
                    <div><p className="text-slate-500">Stale &gt;30 days</p><p className="mt-1 font-semibold text-slate-900">{numberFormat.format(data.charts.leadAging.staleMoreThan30Days)}</p></div>
                    <div><p className="text-slate-500">Open leads</p><p className="mt-1 font-semibold text-slate-900">{numberFormat.format(data.charts.leadAging.totalOpenLeads)}</p></div>
                    <div><p className="text-slate-500">Average age</p><p className="mt-1 font-semibold text-slate-900">{data.charts.leadAging.averageLeadAge === null ? '—' : `${data.charts.leadAging.averageLeadAge} days`}</p></div>
                  </div>
                </>
              ) : <EmptyChart>No open leads are available for aging analysis.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Product / SBU-wise Lead Analysis" subtitle="Lead count, conversions, and scrapped leads by recorded product or SBU">
              {data.charts.productAvailable ? (
                <>
                  <div className="h-[270px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.productAnalysis} margin={{ top: 8, right: 12, bottom: 34, left: 0 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={54} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={34} />
                        <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                        <Legend />
                        <Bar dataKey="total" name="Total Leads" fill="#6366F1" />
                        <Bar dataKey="converted" name="Converted" fill="#10B981" />
                        <Bar dataKey="scrapped" name="Scrapped" fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-2 py-2 font-medium">Product / SBU</th>
                          <th className="px-2 py-2 font-medium">Total Leads</th>
                          <th className="px-2 py-2 font-medium">Converted</th>
                          <th className="px-2 py-2 font-medium">Conversion %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.charts.productAnalysis.map((product) => (
                          <tr key={product.name}>
                            <td className="px-2 py-2">{product.name}</td>
                            <td className="px-2 py-2">{numberFormat.format(product.total)}</td>
                            <td className="px-2 py-2">{numberFormat.format(product.converted)}</td>
                            <td className="px-2 py-2">{product.conversionPercent.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <EmptyChart>No product or SBU values are recorded on leads in this period.</EmptyChart>}
            </ChartCard>
          </section>
          <p className="text-xs text-slate-500">
            Pipeline value uses only recorded quotation value/revenue or product quantity × unit price. Funnel and quotation conversions use the recorded lead timeline actions; Activity conversion requires a linked Activity lead ID.
          </p>
        </div>
      ) : null}
    </div>
  )
}
