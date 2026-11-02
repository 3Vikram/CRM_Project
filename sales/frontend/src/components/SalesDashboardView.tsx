import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Handshake,
  LoaderCircle,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react'
import type { DashboardData, DashboardPeriod, FollowUpCategory } from '../lib/dashboardApi'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const compactCurrency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 })
const number = new Intl.NumberFormat('en-IN')
const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
]
const followUpFilters = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'upcoming', label: 'Upcoming' },
] as const
const chartColors = ['#3966C8', '#31A3A0', '#E3A546', '#8770C7', '#E5776A', '#4E7A8A', '#759455', '#BD78A0']
const safeCurrency = (value: number) => currency.format(Number.isFinite(value) ? value : 0)
const safeCompactCurrency = (value: number) => compactCurrency.format(Number.isFinite(value) ? value : 0)
const formatDate = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const todayDateKey = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function Panel({ title, subtitle, action, children, className = '' }: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_8px_24px_rgba(27,39,62,0.04)] ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#17233B]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function ShareList({ rows, emptyLabel }: { rows: DashboardData['analytics']['topProducts']; emptyLabel: string }) {
  if (!rows.length) return <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{emptyLabel}</p>
  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={row.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-700">{row.label}</span>
            <span className="shrink-0 text-right text-slate-600">{safeCompactCurrency(row.revenue)} <span className="text-xs text-slate-400">({row.percentage.toFixed(1)}%)</span></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(row.percentage, 0), 100)}%`, backgroundColor: chartColors[index % chartColors.length] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SalesDashboardView({ fetchDashboardData }: {
  fetchDashboardData: (period: DashboardPeriod) => Promise<DashboardData>
}) {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<DashboardPeriod>('all')
  const [followUpFilter, setFollowUpFilter] = useState<(typeof followUpFilters)[number]['value']>('all')
  const [followUpCategory, setFollowUpCategory] = useState<FollowUpCategory | 'All'>('All')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadDashboard = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      setData(await fetchDashboardData(period))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Sales dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [period])

  const followUpCounts = data?.followUps.counts
  const filteredFollowUps = useMemo(() => {
    const records = data?.followUps.records || []
    const today = todayDateKey()
    return records.filter((record) => {
      const inCategory = followUpCategory === 'All' || record.category === followUpCategory
      const inTimeFilter = followUpFilter === 'all'
        || (followUpFilter === 'overdue' && record.dueDate < today)
        || (followUpFilter === 'today' && record.dueDate === today)
        || (followUpFilter === 'upcoming' && record.dueDate > today)
      return inCategory && inTimeFilter
    })
  }, [data, followUpCategory, followUpFilter])

  const cards = data ? [
    { title: 'Opportunities', metric: data.summary.opportunities, icon: BriefcaseBusiness, color: '#4969C8', href: '/sales/leads', extras: `${number.format(data.summary.opportunities.open)} open` },
    { title: 'Quotations', metric: data.summary.quotations, icon: FileText, color: '#25A19A', href: '/sales/quotations', extras: `${number.format(data.summary.quotations.open)} open` },
    { title: 'OPFs', metric: data.summary.opfs, icon: Handshake, color: '#9A75C7', href: '/sales/opf', extras: 'Order processing forms' },
    { title: 'Meetings', metric: data.summary.meetings, icon: CalendarDays, color: '#D99538', href: '/sales/activities', extras: 'Logged meetings' },
  ] : []

  const revenueRows = data?.analytics.revenueTrend || []
  const maxRevenue = Math.max(1, ...revenueRows.flatMap((row) => [row.revenue, row.margin]))
  const chartWidth = Math.max(560, revenueRows.length * 58)
  const chartHeight = 210
  const chartPadding = 24
  const revenuePath = revenueRows.map((row, index) => {
    const x = chartPadding + (index / Math.max(revenueRows.length - 1, 1)) * (chartWidth - chartPadding * 2)
    const y = chartHeight - chartPadding - (row.revenue / maxRevenue) * (chartHeight - chartPadding * 2)
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
  const marginPath = revenueRows.map((row, index) => {
    const x = chartPadding + (index / Math.max(revenueRows.length - 1, 1)) * (chartWidth - chartPadding * 2)
    const y = chartHeight - chartPadding - (row.margin / maxRevenue) * (chartHeight - chartPadding * 2)
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
  const donutTotal = data?.analytics.oemSales.reduce((sum, row) => sum + row.revenue, 0) || 0
  let donutProgress = 0
  const donutStops = (data?.analytics.oemSales || []).map((row, index) => {
    const start = donutProgress
    donutProgress += row.percentage
    return `${chartColors[index % chartColors.length]} ${start}% ${donutProgress}%`
  })
  const donutStyle = { background: donutStops.length ? `conic-gradient(${donutStops.join(', ')})` : '#E9EDF3' }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-[#65718A]">Sales workspace</p>
          <h1 className="text-3xl font-bold tracking-tight text-[#17233B]">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-[#E3E7EF] bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Analytics period</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)} className="bg-transparent outline-none">
              {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void loadDashboard(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-xl border border-[#E3E7EF] bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboard(true)} className="font-semibold underline">Try again</button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-[#E8EAF0] bg-white text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Loading dashboard data…
        </div>
      ) : data ? (
        <>
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#17233B] via-[#22375B] to-[#32527C] p-6 text-white shadow-[0_16px_34px_rgba(23,35,59,0.16)] sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[34px] border-white/5" />
            <div className="relative flex flex-wrap items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-4">
                {data.user.photo ? (
                  <img src={data.user.photo} alt="" className="h-16 w-16 rounded-full border-2 border-white/50 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-xl font-bold">{data.user.initials || 'S'}</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-100">Welcome back</p>
                  <h2 className="mt-1 truncate text-2xl font-bold">{data.user.name}</h2>
                  <p className="mt-1 text-sm text-blue-100">{[data.user.designation, data.user.department, data.user.branch].filter(Boolean).join(' · ') || data.user.role}</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wider text-blue-100">Today</p>
                <p className="mt-1 text-lg font-semibold">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
              </div>
            </div>
          </section>

          <section aria-label="Sales summary" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {cards.map(({ title, metric, icon: Icon, color, href, extras }) => (
              <button key={title} type="button" onClick={() => navigate(href)} className="group rounded-2xl border border-[#E8EAF0] bg-white p-5 text-left shadow-[0_8px_24px_rgba(27,39,62,0.04)] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-[#17233B]">{number.format(metric.total)}</p>
                  </div>
                  <span className="rounded-xl p-3" style={{ backgroundColor: `${color}15`, color }}><Icon className="h-5 w-5" /></span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">{number.format(metric.currentYear)} this year <span className="text-slate-300">·</span> {number.format(metric.previousYear)} last year</span>
                  <span className="font-semibold" style={{ color }}>{extras}</span>
                </div>
                <span className="sr-only">Open {title}</span>
              </button>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,1fr)]">
            <Panel title="Monthly Earning" subtitle="Revenue recorded from order processing forms this month" action={<span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>}>
              <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_190px]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Monthly target</p>
                    <p className="mt-2 text-xl font-bold text-[#17233B]">{data.earnings.target === null ? 'Not configured' : safeCurrency(data.earnings.target)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Monthly achievement</p>
                    <p className="mt-2 text-xl font-bold text-[#17233B]">{safeCurrency(data.earnings.achievement)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                    <p className="text-sm text-slate-500">Total revenue</p>
                    <p className="mt-2 text-2xl font-bold text-[#17233B]">{safeCurrency(data.earnings.revenue)}</p>
                    <p className="mt-1 text-xs text-slate-500">Based on Sales OPF revenue records</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="relative grid h-40 w-40 place-items-center rounded-full" style={{ background: data.earnings.target && data.earnings.target > 0 ? `conic-gradient(#31A3A0 ${Math.min(data.earnings.achievement / data.earnings.target, 1) * 100}%, #E9EDF3 0)` : '#E9EDF3' }}>
                    <div className="grid h-[118px] w-[118px] place-items-center rounded-full bg-white text-center">
                      {data.earnings.target && data.earnings.target > 0 ? (
                        <div><p className="text-2xl font-bold text-[#17233B]">{Math.round(data.earnings.achievement / data.earnings.target * 100)}%</p><p className="text-xs text-slate-500">of target</p></div>
                      ) : (
                        <div><Target className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-1 max-w-[84px] text-xs text-slate-500">Target not configured</p></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Open Tasks" subtitle={`${data.openTasks.length} active task${data.openTasks.length === 1 ? '' : 's'}`} action={<button type="button" onClick={() => navigate('/sales/activities')} className="text-sm font-semibold text-blue-700 hover:underline">View activities</button>}>
              {data.openTasks.length ? (
                <div className="divide-y divide-slate-100">
                  {data.openTasks.map((task) => (
                    <button key={task.id} type="button" onClick={() => navigate(task.href)} className="flex w-full items-start gap-3 py-3 text-left first:pt-0 last:pb-0">
                      <span className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-700"><Clock3 className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{task.id} · {task.title}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{task.detail} · {task.assignedTo}</span>
                        {task.dueDate ? <span className="mt-1 block text-xs text-slate-400">Due {formatDate(task.dueDate)}</span> : null}
                      </span>
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-slate-50 px-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">No open tasks</p>
                  <p className="mt-1 text-xs text-slate-500">There are no active activities assigned to you.</p>
                </div>
              )}
            </Panel>
          </section>

          <Panel title="Follow-ups" subtitle="Activities, opportunities and renewals that need attention" action={
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {followUpFilters.map((filter) => (
                <button key={filter.value} type="button" onClick={() => setFollowUpFilter(filter.value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${followUpFilter === filter.value ? 'bg-white text-[#17233B] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {filter.label} <span className="ml-1 text-slate-400">{followUpCounts?.[filter.value] || 0}</span>
                </button>
              ))}
            </div>
          }>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(['All', 'Activity', 'Funnel', 'Lead', 'Renewal'] as const).map((category) => (
                <button key={category} type="button" onClick={() => setFollowUpCategory(category)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${followUpCategory === category ? 'border-[#253B61] bg-[#253B61] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{category}</button>
              ))}
            </div>
            {filteredFollowUps.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredFollowUps.slice(0, 9).map((record) => (
                  <button key={`${record.category}-${record.id}`} type="button" onClick={() => navigate(record.href)} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40">
                    <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${record.dueDate < todayDateKey() ? 'bg-red-50 text-red-700' : record.dueDate === todayDateKey() ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{record.category}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{record.title}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{record.detail}</span>
                      <span className="mt-2 block text-xs text-slate-500">{formatDate(record.dueDate)} · {record.assignedTo}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No follow-ups match these filters.</p>
            )}
          </Panel>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
            <Panel title="Revenue vs Margin" subtitle="Monthly closed funnels, created funnels, revenue and margin" action={<span className="text-xs font-medium text-slate-500">{periods.find((option) => option.value === period)?.label}</span>}>
              {revenueRows.length ? (
                <>
                  <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#3966C8]" />Revenue</span>
                    <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#31A3A0]" />Margin</span>
                    <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#E3A546]" />Funnels closed / created</span>
                  </div>
                  <div className="overflow-x-auto">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[210px] w-full min-w-[560px]" role="img" aria-label="Revenue and margin by month">
                      {[0, 1, 2, 3].map((line) => {
                        const y = chartPadding + line / 3 * (chartHeight - chartPadding * 2)
                        return <line key={line} x1={chartPadding} x2={chartWidth - chartPadding} y1={y} y2={y} stroke="#E8ECF2" strokeDasharray="4 5" />
                      })}
                      {revenueRows.map((row, index) => {
                        const x = chartPadding + (index / Math.max(revenueRows.length - 1, 1)) * (chartWidth - chartPadding * 2)
                        const bar = Math.max(3, (row.funnelsClosed / Math.max(...revenueRows.map((item) => item.funnelsClosed), 1)) * 30)
                        return <g key={row.month}>
                          <rect x={x - 12} y={chartHeight - chartPadding - bar} width="10" height={bar} rx="3" fill="#E3A546" opacity="0.85" />
                          <rect x={x + 2} y={chartHeight - chartPadding - Math.max(3, (row.funnelsCreated / Math.max(...revenueRows.map((item) => item.funnelsCreated), 1)) * 30)} width="10" height={Math.max(3, (row.funnelsCreated / Math.max(...revenueRows.map((item) => item.funnelsCreated), 1)) * 30)} rx="3" fill="#E3A546" opacity="0.4" />
                          <text x={x} y={chartHeight - 4} textAnchor="middle" fontSize="10" fill="#64748B">{new Date(`${row.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</text>
                        </g>
                      })}
                      <path d={revenuePath} fill="none" stroke="#3966C8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={marginPath} fill="none" stroke="#31A3A0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {revenueRows.map((row, index) => {
                        const x = chartPadding + (index / Math.max(revenueRows.length - 1, 1)) * (chartWidth - chartPadding * 2)
                        const y = chartHeight - chartPadding - (row.revenue / maxRevenue) * (chartHeight - chartPadding * 2)
                        return <circle key={`${row.month}-revenue`} cx={x} cy={y} r="3" fill="#3966C8" />
                      })}
                    </svg>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500 sm:grid-cols-4">
                    <div>Funnels closed <strong className="block text-sm text-slate-800">{number.format(revenueRows.reduce((sum, row) => sum + row.funnelsClosed, 0))}</strong></div>
                    <div>Funnels created <strong className="block text-sm text-slate-800">{number.format(revenueRows.reduce((sum, row) => sum + row.funnelsCreated, 0))}</strong></div>
                    <div>Revenue <strong className="block text-sm text-slate-800">{safeCompactCurrency(revenueRows.reduce((sum, row) => sum + row.revenue, 0))}</strong></div>
                    <div>Margin <strong className="block text-sm text-slate-800">{safeCompactCurrency(revenueRows.reduce((sum, row) => sum + row.margin, 0))}</strong></div>
                  </div>
                </>
              ) : <p className="py-10 text-center text-sm text-slate-500">No revenue or funnel data for this period.</p>}
            </Panel>

            <Panel title="OEM Wise Sales Analysis" subtitle="Share of recorded OPF revenue">
              {donutTotal > 0 ? (
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <div className="relative h-40 w-40 shrink-0 rounded-full" style={donutStyle}>
                    <div className="absolute inset-[24%] grid place-items-center rounded-full bg-white text-center">
                      <div><span className="block text-xs text-slate-500">Revenue</span><strong className="text-sm text-[#17233B]">{safeCompactCurrency(donutTotal)}</strong></div>
                    </div>
                  </div>
                  <div className="w-full space-y-3">
                    {data.analytics.oemSales.map((row, index) => <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-slate-600"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="truncate">{row.label}</span></span>
                      <strong className="shrink-0 text-slate-800">{row.percentage.toFixed(1)}%</strong>
                    </div>)}
                  </div>
                </div>
              ) : <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No OEM sales recorded for this period.</p>}
            </Panel>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <Panel title="Top Selling Products" subtitle="OPF revenue share">
              <ShareList rows={data.analytics.topProducts} emptyLabel="No product sales recorded for this period." />
            </Panel>
            <Panel title="Today's Activity" subtitle="CRM records created today">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Activities', value: data.analytics.today.activities, icon: Activity },
                  { label: 'Customers', value: data.analytics.today.customers, icon: Users },
                  { label: 'Funnels', value: data.analytics.today.funnels, icon: BriefcaseBusiness },
                  { label: 'Quotations', value: data.analytics.today.quotations, icon: FileText },
                  { label: 'OPFs', value: data.analytics.today.opfs, icon: Handshake },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <Icon className="h-4 w-4 text-[#4969C8]" />
                    <p className="mt-3 text-xl font-bold text-[#17233B]">{number.format(value)}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Top Customers" subtitle="Revenue-based customer share">
              <ShareList rows={data.analytics.topCustomers} emptyLabel="No customer revenue recorded for this period." />
            </Panel>
          </section>

          <Panel title="Expected Closures" subtitle="Quotation opportunities with a recorded expected closure date" action={<button type="button" onClick={() => navigate('/sales/quotations')} className="text-sm font-semibold text-blue-700 hover:underline">All quotations</button>}>
            {data.expectedClosures.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
                  <thead><tr className="text-xs uppercase tracking-wide">
                    {['Quote Number', 'Company', 'Account Manager', 'Revenue', 'Expected Closure Date', 'Product Details', ''].map((header) => <th key={header || 'view'} className="border-y border-[#E5E7EB] bg-[#EDE7F6] px-4 py-3 font-semibold text-[#17233B] first:rounded-l-lg last:rounded-r-lg">{header}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.expectedClosures.map((quote) => <tr key={quote.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-[#17233B]">{quote.quoteNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{quote.company}</td>
                      <td className="px-4 py-3 text-slate-600">{quote.accountManager}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{safeCurrency(quote.revenue)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(quote.expectedClosureDate)}</td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-slate-600">{quote.productDetails}</td>
                      <td className="px-4 py-3"><button type="button" onClick={() => navigate(quote.href)} className="rounded-lg border border-[#DCE3EF] px-3 py-1.5 text-xs font-semibold text-[#253B61] hover:bg-slate-50">View</button></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 px-4 py-10 text-center">
                <CircleDollarSign className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No expected closures</p>
                <p className="mt-1 text-xs text-slate-500">Quotations with expected closure dates will appear here.</p>
              </div>
            )}
          </Panel>
        </>
      ) : (
        <div className="rounded-2xl border border-[#E8EAF0] bg-white px-5 py-12 text-center text-sm text-slate-500">Dashboard data is unavailable.</div>
      )}
    </div>
  )
}
