import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import {
  Activity as ActivityIcon,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Package,
  RefreshCw,
  Search,
  Send,
  ArrowUpDown,
  Target,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Legend,
  LabelList,
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
  AnalyticsFilters,
  AnalyticsPeriod,
  AnalyticsRow,
  AssistantResult,
  SalesAnalytics,
  salesAnalyticsApi,
} from '../lib/salesAnalyticsApi'

const reportOptions = [
  { label: 'Revenue & Margin', path: '/reports/revenue-margin', icon: CircleDollarSign },
  { label: 'Top 10 Customers', path: '/reports/top-customers', icon: Users },
  { label: 'Top 10 Employees', path: '/reports/top-employees', icon: BriefcaseBusiness },
  { label: 'Top 10 Products', path: '/reports/top-products', icon: Package },
  { label: 'Usage Reports', path: '/reports/usage', icon: BarChart3 },
  { label: 'Funnel Analysis Reports', path: '/reports/funnel-analysis', icon: Target },
  { label: 'Team Analysis Reports', path: '/reports/team-analysis', icon: CheckCircle2 },
  { label: 'Product Analysis Reports', path: '/reports/product-analysis', icon: Package },
]

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'quarterly', label: 'This Quarter' },
  { value: 'half-yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'This Year' },
  { value: 'custom', label: 'Custom Date Range' },
]

const palette = ['#2563eb', '#0d9488', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']
const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const compactMoney = (value: number) => `₹${Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value || 0)}`
const countValue = (value: number) => new Intl.NumberFormat('en-IN').format(value || 0)
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isNonEmpty = (value: string) => value.length > 0

function ChartCard({
  title,
  subtitle,
  empty,
  emptyMessage = 'No records are available for this report in the selected period.',
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  empty: boolean
  emptyMessage?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {empty
        ? <div className="flex min-h-[88px] items-center justify-center rounded-lg bg-slate-50 px-5 text-center text-sm text-slate-500">{emptyMessage}</div>
        : <div className="w-full" style={{ height: 260, minWidth: 0 }}>{children}</div>}
    </section>
  )
}

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  color,
  isCurrency = false,
}: {
  label: string
  value: number | null
  change: number | null
  icon: typeof CircleDollarSign
  color: string
  isCurrency?: boolean
}) {
  const positive = change !== null && change >= 0
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900">
            {value === null ? '—' : isCurrency ? money.format(value) : countValue(value)}
          </p>
        </div>
        <div className={`rounded-lg p-2 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-3 flex min-h-5 items-center gap-1 text-xs">
        {change === null
          ? <span className="text-slate-400">No previous-period comparison</span>
          : <>
            {positive
              ? <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              : <ArrowDownRight className="h-4 w-4 text-rose-600" />}
            <span className={positive ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-slate-400">vs previous period</span>
          </>}
      </div>
    </section>
  )
}

function EmptyChart(rows: AnalyticsRow[] | undefined, field: keyof AnalyticsRow) {
  return !rows?.length || rows.every((row) => !Number(row[field] || 0))
}

function PiePanel({
  title,
  subtitle,
  rows,
  nameKey,
  valueKey,
  emptyMessage = 'No matching records are available in the selected period.',
}: {
  title: string
  subtitle: string
  rows: AnalyticsRow[] | undefined
  nameKey: keyof AnalyticsRow
  valueKey: keyof AnalyticsRow
  emptyMessage?: string
}) {
  const data = (rows || []).map((row) => ({
    name: String(row[nameKey] || 'Not recorded'),
    value: Number(row[valueKey] || 0),
  })).filter((row) => row.value > 0)

  return (
    <ChartCard title={title} subtitle={subtitle} empty={!data.length} emptyMessage={emptyMessage}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius={78} innerRadius={42} paddingAngle={2}>
            {data.map((row, index) => <Cell key={`${row.name}-${index}`} fill={palette[index % palette.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => countValue(Number(value))} />
          <Legend verticalAlign="bottom" height={32} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState<SalesAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [question, setQuestion] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [assistantResult, setAssistantResult] = useState<AssistantResult | null>(null)
  const [dateError, setDateError] = useState('')
  const [tableView, setTableView] = useState<'revenue' | 'customers' | 'employees' | 'products'>('revenue')
  const [tableSearch, setTableSearch] = useState('')
  const [sortAscending, setSortAscending] = useState(false)
  const reportElement = useRef<HTMLDivElement>(null)

  const filters = useMemo<AnalyticsFilters>(() => ({
    period,
    ...(period === 'custom' ? { startDate, endDate } : {}),
  }), [period, startDate, endDate])
  const customRangeReady = period !== 'custom' || (isNonEmpty(startDate) && isNonEmpty(endDate))

  useEffect(() => {
    if (!customRangeReady) {
      setLoading(false)
      setData(null)
      return
    }

    let active = true
    setLoading(true)
    setError('')
    salesAnalyticsApi.getAnalytics(filters)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((cause: unknown) => {
        if (active) {
          setData(null)
          setError(cause instanceof Error ? cause.message : 'Unable to load Sales analytics.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [filters, customRangeReady, reloadKey])

  const updatePeriod = (value: AnalyticsPeriod) => {
    setPeriod(value)
    setDateError('')
    if (value === 'custom') {
      const today = formatDate(new Date())
      setStartDate(today)
      setEndDate(today)
    }
  }

  const changeCustomDate = (which: 'start' | 'end', value: string) => {
    const nextStart = which === 'start' ? value : startDate
    const nextEnd = which === 'end' ? value : endDate
    if (nextStart && nextEnd && nextStart > nextEnd) {
      setDateError('Start date must be on or before the end date.')
      return
    }
    setDateError('')
    if (which === 'start') setStartDate(value)
    else setEndDate(value)
  }

  const handleExcelExport = async () => {
    setExporting(true)
    setError('')
    try {
      const file = await salesAnalyticsApi.exportExcel(filters)
      const objectUrl = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = 'sales-analytics.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export the Sales report.')
    } finally {
      setExporting(false)
    }
  }

  const handlePdfExport = async () => {
    if (!reportElement.current || !data) return
    try {
      await html2pdf().set({
        margin: 8,
        filename: `sales-analytics-${formatDate(new Date())}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }).from(reportElement.current).save()
    } catch {
      setError('Unable to generate the PDF report. Please try again.')
    }
  }

  const handleAssistantSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!question.trim()) return
    setAssistantLoading(true)
    setAssistantError('')
    setAssistantResult(null)
    try {
      const answer = await salesAnalyticsApi.askAssistant(question.trim(), filters)
      setAssistantResult(answer)
    } catch (cause) {
      setAssistantError(cause instanceof Error ? cause.message : 'The Sales AI assistant could not answer this question.')
    } finally {
      setAssistantLoading(false)
    }
  }

  const chartData = data?.charts
  const totalFunnelLeads = chartData?.funnel.reduce((sum, row) => sum + Number(row.count || 0), 0) || 0
  const assistantChart = useMemo(() => {
    if (!chartData || !assistantResult?.chartKey) return null
    const chart = {
      revenueTrend: { title: 'Revenue trend', rows: chartData.revenueTrend, category: 'label', metric: 'revenue', currency: true },
      customers: { title: 'Customer revenue', rows: chartData.customerRevenue, category: 'customer', metric: 'revenue', currency: true },
      quotations: { title: 'Quotations by customer', rows: chartData.quotationsByCustomer, category: 'customer', metric: 'quotations', currency: false },
      employees: { title: 'Employee revenue', rows: chartData.employeeRevenue, category: 'employee', metric: 'revenue', currency: true },
      funnel: { title: 'Lead funnel', rows: chartData.funnel, category: 'stage', metric: 'count', currency: false },
      products: { title: 'Product revenue', rows: chartData.productRevenue, category: 'product', metric: 'revenue', currency: true },
      activities: { title: 'Activity volume', rows: chartData.activityTrend, category: 'label', metric: 'count', currency: false },
    }[assistantResult.chartKey as 'revenueTrend' | 'customers' | 'quotations' | 'employees' | 'funnel' | 'products' | 'activities']
    return chart?.rows.length ? chart : null
  }, [assistantResult, chartData])
  const tableRows = useMemo(() => {
    if (!data) return []
    const rows = tableView === 'revenue'
      ? data.breakdown.revenue.map((row) => ({
        item: row.customer,
        detail: `${row.product} · ${row.employee}`,
        revenue: row.revenue,
        date: row.date,
      }))
      : data.breakdown[tableView].map((row) => ({
        item: String(row[tableView === 'customers' ? 'customer' : tableView === 'employees' ? 'employee' : 'product'] || 'Not recorded'),
        detail: `${countValue(Number(row.deals || 0))} deal${row.deals === 1 ? '' : 's'}`,
        revenue: Number(row.revenue || 0),
        date: '',
      }))
    const query = tableSearch.trim().toLowerCase()
    return rows
      .filter((row) => !query || `${row.item} ${row.detail} ${row.date}`.toLowerCase().includes(query))
      .sort((left, right) => (left.revenue - right.revenue) * (sortAscending ? 1 : -1))
      .slice(0, 100)
  }, [data, tableView, tableSearch, sortAscending])
  const suggestions = [
    'Show me this period’s sales performance',
    'Which employee generated the highest revenue?',
    'Which leads are pending conversion?',
    'Show overdue activities',
  ]

  return (
    <div className="reports-analytics mx-auto max-w-[1500px] space-y-5 pb-8">
      <style>{`
        #root .reports-analytics,
        #root .reports-analytics * {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }
        #root .reports-analytics {
          font-size: 14px !important;
        }
        #root .reports-analytics :where(p, span, label, td, th, button, a, input, textarea, select, option, li, dt, dd, small) {
          font-size: inherit !important;
        }
      `}</style>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-slate-900">Sales Reports &amp; Analytics</h1>
        <select value={period} onChange={(event) => updatePeriod(event.target.value as AnalyticsPeriod)} className="h-10 min-w-48 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
          {periods.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        {period === 'custom' && <>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Start date
            <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => changeCustomDate('start', event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">End date
            <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => changeCustomDate('end', event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800" />
          </label>
        </>}
        <button type="button" onClick={handlePdfExport} disabled={!data || loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="h-4 w-4" /> Download PDF
        </button>
        <button type="button" onClick={handleExcelExport} disabled={!data || loading || exporting} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
          {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
      </header>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
          {/* {loading ? 'Updating reports…' : data ? 'Filters apply to all charts, summaries and exports' : 'Select a period to load reports'} */}
        </span>
        {dateError && <p role="alert" className="text-sm text-rose-700">{dateError}</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}

      <div ref={reportElement} className="space-y-5">
        <section aria-label="Report summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard label="Total Revenue" value={data?.kpis.totalRevenue ?? null} change={data?.changes.totalRevenue ?? null} icon={CircleDollarSign} color="bg-blue-50 text-blue-700" isCurrency />
          <MetricCard label="Total Quotations" value={data?.kpis.totalQuotations ?? null} change={data?.changes.totalQuotations ?? null} icon={FileSpreadsheet} color="bg-violet-50 text-violet-700" />
          <MetricCard label="Total Customers" value={data?.kpis.customers ?? null} change={data?.changes.customers ?? null} icon={Users} color="bg-cyan-50 text-cyan-700" />
          <MetricCard label="Total Leads" value={data?.kpis.totalLeads ?? null} change={data?.changes.opportunities ?? null} icon={Target} color="bg-amber-50 text-amber-700" />
          <MetricCard label="Converted Leads" value={data?.kpis.convertedLeads ?? null} change={data?.changes.convertedLeads ?? null} icon={CheckCircle2} color="bg-emerald-50 text-emerald-700" />
          <MetricCard label="Pending Follow-Ups" value={data?.kpis.pendingFollowUps ?? null} change={data?.changes.pendingFollowUps ?? null} icon={ActivityIcon} color="bg-rose-50 text-rose-700" />
        </section>

        {loading && !data
          ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading authorized Sales analytics…</div>
          : error
            ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Charts are unavailable until the analytics request succeeds.</div>
            : <>
              <section aria-label="Revenue reports" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="Revenue Trend" subtitle="Actual revenue by day or month in the selected period" empty={EmptyChart(chartData?.revenueTrend, 'revenue')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData?.revenueTrend} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} width={68} />
                      <Tooltip formatter={(value) => money.format(Number(value || 0))} />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Revenue vs Margin" subtitle="Financial totals from recorded CRM order forms" empty={EmptyChart(chartData?.revenueMarginByMonth, 'revenue')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.revenueMarginByMonth} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} width={68} />
                      <Tooltip formatter={(value) => money.format(Number(value || 0))} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="margin" name="Margin" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>
              <section aria-label="Monthly revenue report" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="Revenue by Month" subtitle="Monthly revenue totals in the selected period" empty={EmptyChart(chartData?.monthlyRevenue, 'revenue')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.monthlyRevenue} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} width={68} />
                      <Tooltip formatter={(value) => money.format(Number(value || 0))} />
                      <Bar dataKey="revenue" name="Revenue" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="New Customers Over Time" subtitle="New CRM customers created during the period" empty={EmptyChart(chartData?.customerAcquisition, 'count')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData?.customerAcquisition} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" name="New customers" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>

              <section aria-label="Lead and funnel reports" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="Lead Conversion Funnel" subtitle="Authorized lead pipeline created through the selected period end" empty={EmptyChart(chartData?.funnel, 'count')} emptyMessage="No authorized leads are on record through this period end.">
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart margin={{ top: 12, right: 84, bottom: 12, left: 84 }}>
                      <Tooltip />
                      <Funnel data={chartData?.funnel} dataKey="count" nameKey="stage" isAnimationActive>
                        {(chartData?.funnel || []).map((row, index) => (
                          <Cell key={row.stage || index} fill={palette[index % palette.length]} />
                        ))}
                        <LabelList dataKey="stage" position="right" fill="#475569" stroke="none" fontSize={11} />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </ChartCard>
                <PiePanel title="Lead Status Distribution" subtitle={`${countValue(totalFunnelLeads)} authorized leads on record through period end`} rows={chartData?.leadStatus} nameKey="status" valueKey="count" emptyMessage="No authorized leads are on record through this period end." />
                <PiePanel title="Lead Sources" subtitle="Source breakdown for the pipeline through period end" rows={chartData?.leadSources} nameKey="source" valueKey="count" emptyMessage="No lead sources are recorded for the authorized pipeline." />
                <PiePanel title="Converted vs Pending Leads" subtitle="Current outcome for opportunities created through period end" rows={chartData?.leadConversion} nameKey="status" valueKey="count" emptyMessage="No authorized opportunities are on record through this period end." />
              </section>

              <section aria-label="Customer reports" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="Top 10 Customers by Revenue" subtitle="Revenue from order forms" empty={EmptyChart(chartData?.customerRevenue, 'revenue')} emptyMessage="Customer revenue is unavailable because no financial order forms match this period. Customer and quotation reports remain available.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.customerRevenue} layout="vertical" margin={{ top: 2, right: 18, bottom: 2, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={compactMoney} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="customer" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => money.format(Number(value || 0))} />
                      <Bar dataKey="revenue" name="Revenue" fill="#0d9488" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <PiePanel title="Customer Distribution" subtitle="Customer account type as of period end" rows={chartData?.customerDistribution} nameKey="accountType" valueKey="count" emptyMessage="No authorized customer records are available as of the selected period." />
                <ChartCard title="Customers with Most Quotations" subtitle="Quotation records grouped by customer" empty={EmptyChart(chartData?.quotationsByCustomer, 'quotations')} emptyMessage="No quotation records were created in the selected period.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.quotationsByCustomer} layout="vertical" margin={{ top: 4, right: 14, bottom: 4, left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="customer" width={112} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="quotations" name="Quotations" fill="#0891b2" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>

              <section aria-label="Employee reports" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="Employee Performance" subtitle="Revenue by employee from order forms" empty={EmptyChart(chartData?.employeeRevenue, 'revenue')} emptyMessage="Employee revenue is unavailable because no financial order forms match this period.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.employeeRevenue} margin={{ top: 8, right: 12, bottom: 22, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis dataKey="employee" angle={-18} textAnchor="end" interval={0} height={48} tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={compactMoney} tick={{ fontSize: 10 }} width={66} />
                      <Tooltip formatter={(value) => money.format(Number(value || 0))} />
                      <Bar dataKey="revenue" name="Revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Leads Assigned vs Converted" subtitle="Lead assignment and conversion by employee" empty={EmptyChart(chartData?.employeePerformance, 'leadsAssigned')} emptyMessage="No leads were assigned to employees in this period.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.employeePerformance} margin={{ top: 8, right: 12, bottom: 22, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="employee" angle={-18} textAnchor="end" interval={0} height={48} tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="leadsAssigned" name="Assigned leads" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="leadsConverted" name="Converted leads" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Activities Completed by Employee" subtitle="Completed activities assigned to each employee" empty={EmptyChart(chartData?.completedActivitiesByEmployee, 'count')} emptyMessage="No activities were completed in this period.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.completedActivitiesByEmployee} layout="vertical" margin={{ top: 4, right: 14, bottom: 4, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="employee" width={112} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Completed activities" fill="#0d9488" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>

              <section aria-label="Product reports" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="Product-wise Revenue" subtitle="Top products with financial order form records" empty={EmptyChart(chartData?.productRevenue, 'revenue')} emptyMessage="Product revenue is unavailable because no financial order forms match this period.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.productRevenue} layout="vertical" margin={{ top: 2, right: 12, bottom: 2, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={compactMoney} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="product" width={105} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => money.format(Number(value || 0))} />
                      <Bar dataKey="revenue" name="Revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <PiePanel title="Product Performance Distribution" subtitle="Units sold in financial order forms" rows={chartData?.productQuantities} nameKey="product" valueKey="quantity" emptyMessage="Units sold are unavailable because no financial order forms match this period." />
                <ChartCard title="Products in Quotations" subtitle="Requested quantities from quotation product records" empty={EmptyChart(chartData?.productQuotationCounts, 'quantity')} emptyMessage="No quotation product details are available for this period.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.productQuotationCounts} layout="vertical" margin={{ top: 2, right: 12, bottom: 2, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="product" width={105} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="quantity" name="Quoted quantity" fill="#f97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>

              <section aria-label="Activity reports" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="Daily Activities" subtitle="Activities grouped by activity date" empty={EmptyChart(chartData?.activityTrend, 'count')} emptyMessage="No activities have an activity date in this selected period.">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData?.activityTrend} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={30} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" name="Activities" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4, fill: '#ec4899', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <PiePanel title="Completed vs Pending Activities" subtitle="Activity status in the selected period" rows={chartData?.activityCompletion} nameKey="status" valueKey="count" emptyMessage="No activities are dated in the selected period." />
                <PiePanel title="Activity Type Distribution" subtitle="Activity types from recorded interactions" rows={chartData?.activityByType} nameKey="type" valueKey="count" emptyMessage="No activity types are recorded for this period." />
                <ChartCard title="Follow-Ups and Overdue Activities" subtitle="Follow-up dates within the selected period" empty={EmptyChart(chartData?.followUpOverdue, 'count')} emptyMessage="No follow-ups are due within the selected period.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.followUpOverdue} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip />
                      <Bar dataKey="count" name="Activities" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>
              <section aria-label="Detailed filtered report data" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Report Data</h2>
                    <p className="mt-1 text-xs text-slate-500">Search and sort actual records included in the selected period.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-slate-400">
                      <Search className="h-4 w-4" />
                      <input value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="Search report data" className="w-full min-w-36 text-sm text-slate-700 outline-none" />
                    </label>
                    <select aria-label="Report data category" value={tableView} onChange={(event) => setTableView(event.target.value as typeof tableView)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700">
                      <option value="revenue">Revenue records</option>
                      <option value="customers">Customers</option>
                      <option value="employees">Employees</option>
                      <option value="products">Products</option>
                    </select>
                    <button type="button" onClick={() => setSortAscending((ascending) => !ascending)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">
                      <ArrowUpDown className="h-4 w-4" /> Revenue {sortAscending ? 'low to high' : 'high to low'}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr><th className="px-3 py-2.5">Customer / Item</th><th className="px-3 py-2.5">Details</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5 text-right">Revenue</th></tr>
                    </thead>
                    <tbody>
                      {tableRows.length
                        ? tableRows.map((row, index) => <tr key={`${row.item}-${index}`} className="border-t border-slate-100">
                          <td className="px-3 py-2.5 font-medium text-slate-800">{row.item}</td>
                          <td className="px-3 py-2.5 text-slate-500">{row.detail}</td>
                          <td className="px-3 py-2.5 text-slate-500">{row.date || '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{money.format(row.revenue)}</td>
                        </tr>)
                        : <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">No matching CRM records.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </>}
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Detailed Reports</h2>
              <p className="mt-1 text-xs text-slate-500">Open a report for its detailed records and existing report tools.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400" />
          </div>
          <nav aria-label="Detailed Sales reports" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {reportOptions.map(({ label, path, icon: Icon }) => (
              <Link key={path} to={path} className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800">
                <span className="flex min-w-0 items-center gap-2.5"><Icon className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-blue-600" /><span className="truncate">{label}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </nav>
        </div>

        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700"><Bot className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">AI Report Assistant</h2>
              <p className="text-xs text-slate-500">Answers use authorized CRM data for the selected period.</p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)} className="rounded-full border border-blue-100 bg-white/80 px-2.5 py-1.5 text-left text-xs text-slate-600 hover:border-blue-300 hover:text-blue-800">
                {suggestion}
              </button>
            ))}
          </div>
          <form onSubmit={handleAssistantSubmit} className="flex gap-2">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} placeholder="Ask about sales, leads, customers or activities…" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <button type="submit" disabled={assistantLoading || !question.trim()} aria-label="Ask report assistant" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              {assistantLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          {assistantError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{assistantError}</p>}
          {assistantResult && (
            <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{assistantResult.answer}</p>
              {assistantChart && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold text-slate-600">{assistantChart.title}</p>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={assistantChart.rows}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey={assistantChart.category} tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={assistantChart.currency ? compactMoney : undefined} tick={{ fontSize: 10 }} width={52} />
                        <Tooltip formatter={(value) => assistantChart.currency ? money.format(Number(value || 0)) : countValue(Number(value || 0))} />
                        <Bar dataKey={assistantChart.metric} fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {assistantResult.details && Object.entries(assistantResult.details).map(([key, result]) => {
                const records = result.records || []
                if (!records.length) return null
                const fields = Object.keys(records[0]).slice(0, 4)
                return (
                  <div key={key} className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead><tr>{fields.map((field) => <th key={field} className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-600">{field}</th>)}</tr></thead>
                      <tbody>{records.slice(0, 6).map((record, index) => <tr key={`${key}-${index}`}>{fields.map((field) => <td key={field} className="border-b border-slate-100 px-2 py-1.5 text-slate-600">{record[field] || '—'}</td>)}</tr>)}</tbody>
                    </table>
                    {result.truncated && <p className="mt-1 text-xs text-slate-400">Showing a limited set of matching records.</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
