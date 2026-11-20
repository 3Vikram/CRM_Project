import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Award,
  Bot,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  MessageCircle,
  Package,
  Printer,
  Send,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  askSalesAssistant,
  downloadSalesAnalytics,
  fetchSalesAnalytics,
  type AnalyticsChartKey,
  type AnalyticsFilters,
  type AnalyticsPeriod,
  type SalesAssistantDetails,
  type SalesAnalytics,
} from '@/lib/salesAnalyticsApi'

const reportOptions = [
  { label: 'Revenue & Margin', path: '/reports/revenue-margin', icon: CircleDollarSign },
  { label: 'Top 10 Customers', path: '/reports/top-customers', icon: Users },
  { label: 'Top 10 Employees', path: '/reports/top-employees', icon: BriefcaseBusiness },
  { label: 'Top 10 Products', path: '/reports/top-products', icon: Package },
  { label: 'Usage Reports', path: '/reports/usage', icon: Activity },
  { label: 'Funnel Analysis Reports', path: '/reports/funnel-analysis', icon: Target },
  { label: 'Team Analysis Reports', path: '/reports/team-analysis', icon: Award },
  { label: 'Product Analysis Reports', path: '/reports/product-analysis', icon: ChartNoAxesCombined },
]
const periods: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'quarterly', label: 'This Quarter' },
  { value: 'half-yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'This Year' },
  { value: 'custom', label: 'Custom Date Range' },
]
const suggestedQuestions = [
  "Show this period's revenue.",
  'Who is the top-performing sales employee?',
  'Which leads are pending conversion?',
  'Which customers generated the highest revenue?',
  'Show overdue activities.',
]
const palette = ['#3155A6', '#20A39E', '#F3A847', '#8B7BEA', '#E46D78', '#5C9B72']

type AssistantMessage = {
  id: number
  question?: string
  answer: string
  chartKey?: AnalyticsChartKey
  details?: SalesAssistantDetails
}

function PrintableTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <table className="w-full border-collapse text-left text-xs">
        <thead><tr>{columns.map((column) => <th key={column} className="border border-[#CBD3DE] bg-[#F3F5F8] px-2 py-1.5">{column}</th>)}</tr></thead>
        <tbody>{rows.length
          ? rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`} className="border border-[#CBD3DE] px-2 py-1.5">{cell}</td>)}</tr>)
          : <tr><td colSpan={columns.length} className="border border-[#CBD3DE] px-2 py-2">No authorized records for this period.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(value || 0)
const formatCompactCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value || 0)
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<SalesAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [question, setQuestion] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [assistantOpen, setAssistantOpen] = useState(false)

  const filters = useMemo<AnalyticsFilters>(() => ({
    period,
    ...(period === 'custom' ? { startDate, endDate } : {}),
  }), [endDate, period, startDate])
  const latestFilters = useRef(filters)

  useEffect(() => {
    latestFilters.current = filters
    let active = true
    setLoading(true)
    setError('')
    setMessages([])
    setAssistantError('')
    fetchSalesAnalytics(filters)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setData(null)
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Sales analytics.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [filters])

  const changePeriod = (value: AnalyticsPeriod) => {
    setPeriod(value)
    if (value === 'custom') {
      setStartDate((current) => current || today())
      setEndDate((current) => current || today())
    }
  }

  const handleExcelExport = async () => {
    setExporting(true)
    setError('')
    try {
      await downloadSalesAnalytics(filters)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export the report.')
    } finally {
      setExporting(false)
    }
  }

  const sendQuestion = async (event?: FormEvent<HTMLFormElement>, suggested?: string) => {
    event?.preventDefault()
    const text = (suggested || question).trim()
    if (!text || assistantLoading) return
    setQuestion('')
    setAssistantError('')
    setAssistantLoading(true)
    const submittedFilters = filters
    try {
      const response = await askSalesAssistant(text, submittedFilters)
      if (latestFilters.current !== submittedFilters) return
      setMessages((current) => [...current, {
        id: Date.now(),
        question: text,
        answer: response.answer,
        chartKey: response.chartKey,
        details: response.details,
      }])
    } catch (assistantRequestError) {
      setAssistantError(assistantRequestError instanceof Error
        ? assistantRequestError.message
        : 'The Sales AI assistant could not answer this question.')
    } finally {
      setAssistantLoading(false)
    }
  }

  return (
    <div className="sales-analytics-page mx-auto w-full max-w-[1500px] space-y-6 pb-12 text-[#17233B]">
      <style>{`
        @media print {
          @page { size: landscape; margin: 12mm; }
          html, body, #root { height: auto !important; overflow: visible !important; }
          .sales-analytics-page { max-width: none !important; overflow: visible !important; }
          .sales-analytics-no-print, aside, header { display: none !important; }
          main { overflow: visible !important; height: auto !important; padding: 0 !important; }
          .sales-module-typography, .sales-module-typography > div { display: block !important; height: auto !important; margin: 0 !important; overflow: visible !important; }
          .sales-analytics-card { break-inside: avoid; box-shadow: none !important; }
          .sales-analytics-print-only { display: block !important; }
          .sales-analytics-print-header { display: block !important; }
        }
      `}</style>
      <header className="flex flex-wrap items-center gap-3 border-b border-[#E8ECF2] pb-5">
        <h1 className="min-w-0 flex-1 text-3xl font-bold tracking-tight text-[#17233B]">Sales Reports &amp; Analytics</h1>
        <div className="sales-analytics-no-print flex w-full flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end">
          <select
            id="analytics-period"
            aria-label="Date range"
            value={period}
            onChange={(event) => changePeriod(event.target.value as AnalyticsPeriod)}
            className="h-10 rounded-lg border border-[#DDE3EC] bg-white px-3 text-sm font-medium text-[#273650] outline-none focus:border-[#3155A6]"
          >
            {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="analytics-start">Start date</label>
              <input id="analytics-start" aria-label="Start date" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-lg border border-[#DDE3EC] bg-white px-2 text-sm" />
              <span className="text-sm text-[#738096]">to</span>
              <label className="sr-only" htmlFor="analytics-end">End date</label>
              <input id="analytics-end" aria-label="End date" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-lg border border-[#DDE3EC] bg-white px-2 text-sm" />
            </div>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-3 text-sm font-semibold text-[#33415C] transition hover:bg-[#F6F8FB]">
            <Printer className="h-4 w-4" /> Export PDF
          </button>
          <button type="button" disabled={exporting || loading} onClick={() => void handleExcelExport()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#172B55] px-3 text-sm font-semibold text-white transition hover:bg-[#243D72] disabled:cursor-not-allowed disabled:opacity-60">
            {exporting ? <ArrowDownToLine className="h-4 w-4 animate-bounce" /> : <FileSpreadsheet className="h-4 w-4" />}
            {exporting ? 'Preparing…' : 'Export Excel'}
          </button>
        </div>
      </header>

      <div className="sales-analytics-print-header hidden">
        <h2 className="text-xl font-bold">{data?.companyName || 'Company'} Sales Analytics Report</h2>
        <p className="text-sm">Period: {data?.periodLabel || '—'} · Generated {data ? new Date(data.generatedAt).toLocaleString('en-IN') : '—'}</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {loading && !data ? (
        <div className="rounded-2xl border border-[#E8ECF2] bg-white px-6 py-20 text-center text-sm text-[#738096]">Loading authorized sales data…</div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-semibold text-[#33415C]">{data.periodLabel}</p>
            <p className="text-xs text-[#8A95A7]">Updated {new Date(data.generatedAt).toLocaleString('en-IN')}</p>
          </div>
          <div className="sales-analytics-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#E4EAF2] bg-white px-4 py-3 text-xs text-[#66748A] shadow-[0_4px_14px_rgba(27,44,74,0.025)]">
            <span className="font-semibold text-[#33415C]">Compared with {data.comparison.periodLabel}</span>
            <span>Revenue: <strong className="text-[#273650]">{formatCurrency(data.comparison.totalRevenue)}</strong></span>
            <span>Deals: <strong className="text-[#273650]">{data.comparison.totalDeals}</strong></span>
            <span>Conversion: <strong className="text-[#273650]">{data.comparison.conversionRate.toFixed(1)}%</strong></span>
          </div>
          <section aria-label="Sales key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <KpiCard label="Total revenue" value={formatCurrency(data.kpis.totalRevenue)} icon={CircleDollarSign} accent="blue" change={data.changes.totalRevenue} loading={loading} />
            <KpiCard label="Total quotations" value={data.kpis.totalQuotations.toLocaleString('en-IN')} icon={FileSpreadsheet} accent="teal" change={data.changes.totalQuotations} loading={loading} />
            <KpiCard label="Total customers" value={data.kpis.customers.toLocaleString('en-IN')} icon={Users} accent="violet" change={data.changes.customers} loading={loading} />
            <KpiCard label="Total leads" value={data.kpis.totalLeads.toLocaleString('en-IN')} icon={Target} accent="amber" change={data.changes.opportunities} loading={loading} />
            <KpiCard label="Converted leads" value={data.kpis.convertedLeads.toLocaleString('en-IN')} icon={TrendingUp} accent="green" change={data.changes.convertedLeads} loading={loading} />
            <KpiCard label="Pending follow-ups" value={data.kpis.pendingFollowUps.toLocaleString('en-IN')} icon={Clock3} accent="amber" change={data.changes.pendingFollowUps} loading={loading} />
          </section>

          <section aria-labelledby="revenue-analysis-heading" className="space-y-4">
            <SectionHeading id="revenue-analysis-heading" title="Revenue & margin analysis" detail="Recognized revenue and recorded margin from order processing forms." />
            <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Monthly revenue trend" detail="Recognized order form revenue over the selected period">
              <RevenueLine data={data.charts.revenueTrend} />
            </ChartCard>
            <ChartCard title="Revenue vs margin" detail="Monthly financial totals from order forms">
              <FinancialBars data={data.charts.revenueMarginByMonth} />
            </ChartCard>
            <ChartCard title="Revenue by month" detail="Area trend of revenue across the selected period">
              <RevenueArea data={data.charts.monthlyRevenue} />
            </ChartCard>
            <ChartCard title="Revenue and total margin" detail="Current period compared with the previous period">
              <MetricComparison
                items={[
                  { label: 'Revenue', value: data.kpis.totalRevenue, previous: data.comparison.totalRevenue, color: '#3155A6' },
                  { label: 'Margin', value: data.kpis.totalMargin, previous: data.comparison.totalMargin, color: '#20A39E' },
                ]}
              />
            </ChartCard>
            </div>
          </section>

          <section aria-labelledby="customer-analysis-heading" className="space-y-4">
            <SectionHeading id="customer-analysis-heading" title="Customer analysis" detail="Customer revenue contribution, acquisition, and recorded account status." />
            <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard title="Top 10 customers by revenue" detail="Revenue recorded on their order forms">
              <RevenueBars data={data.charts.customerRevenue.map((row) => ({ label: row.customer, revenue: row.revenue }))} />
            </ChartCard>
            <ChartCard title="Customer acquisition trend" detail="Customers created in the selected period">
              <CountTrend data={data.charts.customerAcquisition} seriesLabel="Customers" />
            </ChartCard>
            <ChartCard title="Active vs inactive customers" detail="Status of customers created in this period">
              <DonutSummary data={data.charts.customerStatus.map((row) => ({ label: row.status, value: row.count }))} colors={['#20A39E', '#A8B1BF']} />
            </ChartCard>
            <ChartCard title="Customer contribution to revenue" detail="Share among the top customers">
              <RevenueDonut data={data.charts.customerRevenue} />
            </ChartCard>
            <ChartCard title="Customer revenue summary" detail="Current period customer contribution">
              <MetricBarChart data={data.charts.customerRevenue.map((row) => ({ label: row.customer, value: row.revenue, display: formatCurrency(row.revenue) }))} />
            </ChartCard>
            </div>
          </section>

          <section aria-labelledby="employee-analysis-heading" className="space-y-4">
            <SectionHeading id="employee-analysis-heading" title="Employee performance" detail="Revenue and activity figures are limited to the signed-in user's authorized report scope." />
            <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard title="Top sales employees by revenue" detail="Authorized recorded revenue and order forms">
              <Leaderboard data={data.charts.employeeRevenue} />
            </ChartCard>
            <ChartCard title="Employee quotations and conversions" detail="Quotation records and those marked won">
              <EmployeeQuotationBars data={data.charts.employeeQuotations} />
            </ChartCard>
            <ChartCard title="Employee activity performance" detail="Activities assigned to employees in this period">
              <MetricBarChart data={data.charts.activityByEmployee.map((row) => ({ label: row.employee, value: row.count, display: row.count.toLocaleString('en-IN') }))} />
            </ChartCard>
            <ChartCard title="Employee target vs actual" detail="Target comparisons require target values in employee records">
              <TargetGauge target={data.charts.targetAchievement.target} achieved={data.charts.targetAchievement.achieved} />
            </ChartCard>
            </div>
          </section>

          <section aria-labelledby="product-analysis-heading" className="space-y-4">
            <SectionHeading id="product-analysis-heading" title="Product analysis" detail="Product sales and quantity are derived from recorded order forms." />
            <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard title="Top products by sales revenue" detail="Recorded order form revenue by product">
              <RevenueBars data={data.charts.productRevenue.map((row) => ({ label: row.product, revenue: row.revenue }))} />
            </ChartCard>
            <ChartCard title="Product quantity sold" detail="Total quantity from order forms">
              <MetricBarChart data={data.charts.productQuantities.map((row) => ({ label: row.product, value: row.quantity, display: row.quantity.toLocaleString('en-IN') }))} />
            </ChartCard>
            <ChartCard title="Product revenue contribution" detail="Share of revenue among recorded products">
              <DonutSummary data={data.charts.productRevenue.map((row) => ({ label: row.product, value: row.revenue }))} />
            </ChartCard>
            <ChartCard title="Product performance trend" detail="Monthly revenue by product">
              <ProductTrend data={data.charts.productTrend} />
            </ChartCard>
            </div>
          </section>

          <section aria-labelledby="funnel-analysis-heading" className="space-y-4">
            <SectionHeading id="funnel-analysis-heading" title="Funnel analysis" detail="Opportunity stages and outcomes recorded in the selected period." />
            <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard title="Sales funnel" detail="CRM opportunities grouped by current stage">
              <FunnelChart data={data.charts.funnel} />
            </ChartCard>
            <ChartCard title="Lead status distribution" detail="Current status of authorized lead and quotation records">
              <DonutSummary data={data.charts.leadStatus.map((row) => ({ label: row.status, value: row.count }))} />
            </ChartCard>
            <ChartCard title="Lead sources" detail="Source recorded on lead records in this period">
              <DonutSummary data={data.charts.leadSources.map((row) => ({ label: row.source, value: row.count }))} />
            </ChartCard>
            <ChartCard title="Opportunities by stage" detail="Current opportunity count at each recorded stage">
              <MetricBarChart data={data.charts.funnel.map((row) => ({ label: row.stage, value: row.count, display: row.count.toLocaleString('en-IN') }))} />
            </ChartCard>
            <ChartCard title="Won vs lost opportunities" detail="Decided leads in the selected period">
              <DonutSummary data={[{ label: 'Won', value: data.kpis.wonDeals }, { label: 'Lost', value: data.kpis.lostDeals }]} colors={['#3A8C58', '#D35C6B']} />
            </ChartCard>
            <ChartCard title="Stage-wise conversion" detail="Stages describe current status; stage-to-stage history is not stored">
              <UnavailableChart message="Historical stage transitions are not recorded, so stage conversion rates cannot be calculated reliably." />
            </ChartCard>
            <ChartCard title="Expected revenue by funnel stage" detail="Opportunity values and stage probabilities">
              <UnavailableChart message="The funnel data does not store a consistent opportunity value and stage probability for this calculation." />
            </ChartCard>
            </div>
          </section>

          <section aria-labelledby="activity-analysis-heading" className="space-y-4">
            <SectionHeading id="activity-analysis-heading" title="Activity analysis" detail="Status and follow-up views use the effective activity status for today." />
            <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard title="Activities by type" detail="Calls, meetings, emails, and other recorded types">
              <DonutSummary data={data.charts.activityByType.map((row) => ({ label: row.type, value: row.count }))} />
            </ChartCard>
            <ChartCard title="Activity trend" detail="Daily or monthly activity volume">
              <CountTrend data={data.charts.activityTrend} seriesLabel="Activities" />
            </ChartCard>
            <ChartCard title="Completed, pending and overdue" detail="Effective statuses computed from activity outcome and follow-up dates">
              <DonutSummary data={data.charts.activityByStatus.map((row) => ({ label: row.status, value: row.count }))} colors={['#3A8C58', '#F3A847', '#8B7BEA', '#E46D78', '#3155A6', '#A8B1BF']} />
            </ChartCard>
            <ChartCard title="Follow-ups and overdue activities" detail="Counts of open follow-ups and activities past their follow-up date">
              <MetricBarChart data={data.charts.followUpOverdue.map((row) => ({ label: row.label, value: row.count, display: row.count.toLocaleString('en-IN') }))} />
            </ChartCard>
            <ChartCard title="Employee activity performance" detail="Assigned activity counts">
              <MetricBarChart data={data.charts.activityByEmployee.map((row) => ({ label: row.employee, value: row.count, display: row.count.toLocaleString('en-IN') }))} />
            </ChartCard>
            <ChartCard title="Activity calendar" detail="Daily activity volume in the selected period">
              <ActivityHeatmap data={data.charts.activityHeatmap} />
            </ChartCard>
            <ChartCard title="Upcoming follow-ups" detail="Open activities with a future follow-up date">
              <FollowUpsTable data={data.charts.upcomingFollowUps} />
            </ChartCard>
            </div>
          </section>

          <section aria-labelledby="quotation-analysis-heading" className="space-y-4">
            <SectionHeading id="quotation-analysis-heading" title="Quotation analysis" detail="Quotation counts and statuses are based on existing Sales lead records." />
            <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard title="Quotations created over time" detail="Quotation records by creation date">
              <CountTrend data={data.charts.quotationTrend} seriesLabel="Quotations" />
            </ChartCard>
            <ChartCard title="Draft, sent, approved and rejected" detail="Quotation stages available in the existing lead status model">
              <DonutSummary data={data.charts.quotationStatus.map((row) => ({ label: row.status, value: row.count }))} colors={['#A8B1BF', '#3155A6', '#3A8C58', '#D35C6B']} />
            </ChartCard>
            <ChartCard title="Quotation conversion rate" detail="Won quotations among decided quotation records">
              <MetricStat value={`${data.kpis.quotationConversionRate.toFixed(1)}%`} label="Won ÷ decided quotations" />
            </ChartCard>
            <ChartCard title="Quotation value by month" detail="Quotation monetary values">
              <UnavailableChart message="Quotation line-item values are not consistently available in the report's lead records." />
            </ChartCard>
            <ChartCard title="Top customers by quotation value" detail="Quotation monetary values">
              <UnavailableChart message="Customer quotation totals cannot be calculated without consistent quotation values." />
            </ChartCard>
            </div>
          </section>

          <section aria-labelledby="usage-analysis-heading" className="space-y-4">
            <SectionHeading id="usage-analysis-heading" title="Usage reports" detail="Usage analytics are shown only when supported by recorded application data." />
            <UnavailableChart message="This Sales application does not currently store login history or feature-usage events for reporting." />
          </section>

          <section className="sales-analytics-print-only hidden">
            <h2 className="mb-2 mt-6 text-lg font-bold">Sales breakdown</h2>
            <PrintableTable
              title="Employee revenue"
              columns={['Employee', 'Revenue', 'Order forms']}
              rows={data.breakdown.employees.map((row) => [row.employee, formatCurrency(row.revenue), String(row.deals)])}
            />
            <PrintableTable
              title="Customer revenue"
              columns={['Customer', 'Revenue', 'Order forms']}
              rows={data.breakdown.customers.map((row) => [row.customer, formatCurrency(row.revenue), String(row.deals)])}
            />
            <PrintableTable
              title="Product revenue"
              columns={['Product', 'Revenue', 'Order forms']}
              rows={data.breakdown.products.map((row) => [row.product, formatCurrency(row.revenue), String(row.deals)])}
            />
            <PrintableTable
              title="Upcoming follow-ups"
              columns={['Customer', 'Employee', 'Follow-up date', 'Status']}
              rows={data.charts.upcomingFollowUps.map((row) => [row.customer, row.employee, row.followUpDate, row.status])}
            />
          </section>

          <section className="sales-analytics-card rounded-2xl border border-[#E4EAF2] bg-white p-5 shadow-[0_8px_24px_rgba(27,44,74,0.04)] sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold"><Bot className="h-5 w-5 text-[#3155A6]" /> AI Insights &amp; Sales Assistant</h2>
                <p className="mt-1 text-sm text-[#738096]">Ask questions about the actual CRM metrics available to your account and selected period.</p>
              </div>
              <button type="button" aria-expanded={assistantOpen} onClick={() => setAssistantOpen((open) => !open)} className="sales-analytics-no-print inline-flex items-center gap-2 rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm font-semibold text-[#33415C] hover:bg-[#F6F8FB]">
                <MessageCircle className="h-4 w-4" /> {assistantOpen ? 'Close assistant' : 'Ask a question'} {assistantOpen && <X className="h-4 w-4" />}
              </button>
            </div>
            {assistantOpen && (
              <>
                <div className="sales-analytics-no-print mb-4 flex flex-wrap gap-2">
                  {suggestedQuestions.map((prompt) => (
                    <button key={prompt} type="button" disabled={assistantLoading} onClick={() => void sendQuestion(undefined, prompt)} className="rounded-full border border-[#DDE3EC] bg-[#FAFBFD] px-3 py-1.5 text-xs font-medium text-[#52617A] transition hover:border-[#AEBBD0] hover:text-[#172B55] disabled:opacity-50">{prompt}</button>
                  ))}
                </div>
                {messages.length > 0 && (
                  <div className="mb-4 max-h-[460px] space-y-4 overflow-y-auto rounded-xl bg-[#F7F9FC] p-4">
                    {messages.map((message) => (
                      <article key={message.id} className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#738096]">You · {message.question}</p>
                        <div className="whitespace-pre-wrap rounded-xl border border-[#E4EAF2] bg-white p-4 text-sm leading-6 text-[#33415C]">{message.answer}</div>
                        {message.details?.pendingLeads && (
                          <AssistantDetailTable
                            title="Pending leads"
                            columns={['Lead ID', 'Company', 'Status', 'Assigned to', 'Follow-up date']}
                            rows={message.details.pendingLeads.records.map((lead) => [lead.leadId || '—', lead.company, lead.status, lead.assignedTo, lead.followUpDate || '—'])}
                            truncated={message.details.pendingLeads.truncated}
                          />
                        )}
                        {message.details?.activities && (
                          <AssistantDetailTable
                            title="Activities"
                            columns={['Activity ID', 'Customer', 'Type', 'Assigned to', 'Follow-up date', 'Status']}
                            rows={message.details.activities.records.map((activity) => [activity.activityId || '—', activity.customer, activity.type, activity.assignedTo, activity.followUpDate || '—', activity.status])}
                            truncated={message.details.activities.truncated}
                          />
                        )}
                        {message.chartKey && <AssistantChart chartKey={message.chartKey} data={data} />}
                      </article>
                    ))}
                    {assistantLoading && <p className="animate-pulse text-sm text-[#738096]">Analyzing authorized CRM data…</p>}
                  </div>
                )}
                {assistantError && <p role="alert" className="mb-3 text-sm font-medium text-red-700">{assistantError}</p>}
                <form onSubmit={(event) => void sendQuestion(event)} className="sales-analytics-no-print flex gap-2">
                  <label className="sr-only" htmlFor="sales-assistant-question">Ask about Sales data</label>
                  <input id="sales-assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} placeholder="Ask about revenue, quotations, customers, or team performance…" className="h-11 min-w-0 flex-1 rounded-xl border border-[#DDE3EC] bg-white px-4 text-sm outline-none placeholder:text-[#9AA5B5] focus:border-[#3155A6]" />
                  <button disabled={!question.trim() || assistantLoading} type="submit" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#172B55] px-4 text-sm font-semibold text-white transition hover:bg-[#243D72] disabled:cursor-not-allowed disabled:opacity-50">
                    <Send className="h-4 w-4" /><span className="hidden sm:inline">{assistantLoading ? 'Thinking…' : 'Ask'}</span>
                  </button>
                </form>
              </>
            )}
          </section>

          <section className="sales-analytics-no-print space-y-3">
            <div>
              <h2 className="text-lg font-bold">Sales reports</h2>
              <p className="mt-1 text-sm text-[#738096]">Open a detailed report. Existing report views and filters are unchanged.</p>
            </div>
            <nav aria-label="Sales reports" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {reportOptions.map(({ label, path, icon: Icon }) => (
                <Link key={path} to={path} className="group flex items-center justify-between rounded-xl border border-[#E4EAF2] bg-white p-4 text-[#263650] shadow-[0_4px_14px_rgba(27,44,74,0.025)] transition hover:border-[#B9C6D9] hover:shadow-[0_8px_22px_rgba(27,44,74,0.07)]">
                  <span className="flex items-center gap-3 text-sm font-semibold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F0F4FB] text-[#3155A6]"><Icon className="h-4 w-4" /></span>{label}</span>
                  <ArrowRight className="h-4 w-4 text-[#98A4B5] transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </nav>
          </section>
        </>
      ) : null}
    </div>
  )
}

function SectionHeading({ id, title, detail }: { id: string; title: string; detail: string }) {
  return (
    <div>
      <h2 id={id} className="text-xl font-bold tracking-tight text-[#202E47]">{title}</h2>
      <p className="mt-1 text-sm text-[#8792A4]">{detail}</p>
    </div>
  )
}

function AssistantDetailTable({ title, columns, rows, truncated }: { title: string; columns: string[]; rows: string[][]; truncated: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E4EAF2] bg-white p-3">
      <h3 className="mb-2 text-sm font-bold text-[#33415C]">{title}</h3>
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead><tr>{columns.map((column) => <th key={column} className="border border-[#E4EAF2] bg-[#F6F8FB] px-2 py-2">{column}</th>)}</tr></thead>
        <tbody>{rows.length
          ? rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`} className="border border-[#E4EAF2] px-2 py-2">{cell}</td>)}</tr>)
          : <tr><td colSpan={columns.length} className="border border-[#E4EAF2] px-2 py-3 text-center text-[#8792A4]">No matching authorized records in this period.</td></tr>}
        </tbody>
      </table>
      {truncated && <p className="mt-2 text-xs text-[#8792A4]">Showing a limited set of matching records.</p>}
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, accent, hint, change, percentagePoints = false, loading }: {
  label: string
  value: string
  icon: typeof CircleDollarSign
  accent: 'blue' | 'teal' | 'violet' | 'green' | 'amber' | 'rose'
  hint?: string
  change: number | null
  percentagePoints?: boolean
  loading: boolean
}) {
  const color = {
    blue: 'bg-[#EEF3FF] text-[#3155A6]',
    teal: 'bg-[#E9F7F5] text-[#168C86]',
    violet: 'bg-[#F1EEFF] text-[#7566D9]',
    green: 'bg-[#EAF6EE] text-[#3A8C58]',
    amber: 'bg-[#FFF5E7] text-[#D28A24]',
    rose: 'bg-[#FCEDEF] text-[#D35C6B]',
  }[accent]
  return (
    <article className="sales-analytics-card rounded-2xl border border-[#E4EAF2] bg-white p-4 shadow-[0_8px_24px_rgba(27,44,74,0.04)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-[#738096] sm:text-sm">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${color}`}><Icon className="h-[18px] w-[18px]" /></span>
      </div>
      <p className="mt-4 truncate text-2xl font-bold tracking-tight text-[#17233B]" aria-live="polite">{loading ? 'Updating…' : value}</p>
      {hint && <p className="mt-1 text-xs text-[#8A95A7]">{hint}</p>}
      <p className={`mt-2 text-xs font-semibold ${change === null ? 'text-[#98A2B1]' : change > 0 ? 'text-[#27834B]' : change < 0 ? 'text-[#C44F5D]' : 'text-[#738096]'}`}>
        {loading ? 'Comparing…' : change === null || !Number.isFinite(change)
          ? 'No prior-period baseline'
          : <span className="inline-flex items-center gap-1">
            <TrendingUp aria-hidden="true" className={`h-3.5 w-3.5 ${change < 0 ? 'rotate-180' : ''}`} />
            {`${change > 0 ? '+' : ''}${change.toFixed(1)}${percentagePoints ? ' pp' : '%'} vs previous period`}
          </span>}
      </p>
    </article>
  )
}

function ChartCard({ title, detail, children, className = '' }: { title: string; detail: string; children: ReactNode; className?: string }) {
  return (
    <section className={`sales-analytics-card min-w-0 rounded-2xl border border-[#E4EAF2] bg-white p-5 shadow-[0_8px_24px_rgba(27,44,74,0.04)] sm:p-6 ${className}`}>
      <div className="mb-4">
        <h2 className="text-base font-bold text-[#202E47]">{title}</h2>
        <p className="mt-1 text-xs text-[#8792A4]">{detail}</p>
      </div>
      {children}
    </section>
  )
}

function EmptyChart({ label }: { label: string }) {
  return <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-[#E1E6EE] text-center text-sm text-[#98A2B1]">{label}</div>
}

function UnavailableChart({ message }: { message: string }) {
  return (
    <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-[#E1E6EE] bg-[#FAFBFD] px-5 text-center text-sm leading-6 text-[#8792A4]">
      {message}
    </div>
  )
}

function MetricStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid min-h-44 place-items-center rounded-xl bg-[#F7F9FC] text-center">
      <div><p className="text-4xl font-bold tracking-tight text-[#17233B]">{value}</p><p className="mt-2 text-sm text-[#738096]">{label}</p></div>
    </div>
  )
}

function MetricBarChart({ data }: { data: Array<{ label: string; value: number; display: string }> }) {
  if (!data.length) return <EmptyChart label="No records are available for this period." />
  const maximum = Math.max(...data.map((row) => Math.abs(row.value)), 1)
  return (
    <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
      {data.slice(0, 10).map((row, index) => (
        <div key={row.label} className="grid grid-cols-[minmax(75px,1fr)_2fr_auto] items-center gap-3 text-xs">
          <span className="truncate font-medium text-[#5E6B80]" title={row.label}>{row.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF1F5]" role="img" aria-label={`${row.label}: ${row.display}`}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Math.abs(row.value) / maximum * 100, 100)}%`, backgroundColor: palette[index % palette.length] }} />
          </div>
          <span className="min-w-[72px] text-right font-semibold tabular-nums text-[#33415C]">{row.display}</span>
        </div>
      ))}
    </div>
  )
}

function FinancialBars({ data }: { data: SalesAnalytics['charts']['revenueMarginByMonth'] }) {
  if (!data.length) return <EmptyChart label="No revenue records in this period." />
  const maximum = Math.max(...data.flatMap((row) => [Math.abs(row.revenue), Math.abs(row.margin)]), 1)
  return (
    <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
      {data.map((row) => (
        <div key={row.label} className="space-y-2">
          <p className="text-xs font-semibold text-[#52617A]">{row.label}</p>
          {[{ label: 'Revenue', value: row.revenue, color: '#3155A6' }, { label: 'Margin', value: row.margin, color: '#20A39E' }].map((item) => (
            <div key={item.label} className="grid grid-cols-[56px_1fr_auto] items-center gap-2 text-[11px]">
              <span className="text-[#8792A4]">{item.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-[#EEF1F5]" title={`${item.label}: ${formatCurrency(item.value)}`}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(Math.abs(item.value) / maximum * 100, 100)}%`, backgroundColor: item.color }} />
              </div>
              <span className="min-w-[82px] text-right font-semibold tabular-nums text-[#33415C]">{formatCompactCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="flex gap-4 border-t border-[#EDF0F5] pt-3 text-[11px] text-[#738096]">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#3155A6]" /> Revenue</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#20A39E]" /> Margin</span>
      </div>
    </div>
  )
}

function RevenueArea({ data }: { data: Array<{ label: string; revenue: number }> }) {
  if (!data.length) return <EmptyChart label="No revenue records in this period." />
  const maximum = Math.max(...data.map((row) => row.revenue), 1)
  const points = data.map((row, index) => ({
    ...row,
    x: data.length === 1 ? 320 : 70 + index / (data.length - 1) * 500,
    y: 170 - Math.max(row.revenue, 0) / maximum * 140,
  }))
  const areaPath = `M ${points[0].x},180 L ${points.map((point) => `${point.x},${point.y}`).join(' L ')} L ${points[points.length - 1].x},180 Z`
  return (
    <div>
      <svg role="img" aria-label="Monthly revenue area chart" viewBox="0 0 600 220" className="h-56 w-full">
        <defs><linearGradient id="sales-revenue-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3155A6" stopOpacity=".28" /><stop offset="100%" stopColor="#3155A6" stopOpacity=".02" /></linearGradient></defs>
        {[0, 1, 2, 3].map((line) => <line key={line} x1="60" x2="570" y1={30 + line * 45} y2={30 + line * 45} stroke="#EDF0F5" strokeDasharray="4 5" />)}
        <text x="2" y="26" fill="#8792A4" fontSize="10">{formatCompactCurrency(maximum)}</text>
        <text x="2" y="116" fill="#8792A4" fontSize="10">{formatCompactCurrency(maximum / 2)}</text>
        <text x="2" y="174" fill="#8792A4" fontSize="10">₹0</text>
        <path d={areaPath} fill="url(#sales-revenue-area)" />
        <path d={`M ${points.map((point) => `${point.x},${point.y}`).join(' L ')}`} fill="none" stroke="#3155A6" strokeWidth="2.5" />
        {points.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#3155A6" strokeWidth="2"><title>{`${point.label}: ${formatCurrency(point.revenue)}`}</title></circle><text x={point.x} y="202" textAnchor="middle" fill="#8792A4" fontSize="10">{point.label.slice(5)}</text></g>)}
      </svg>
      <div className="flex items-center gap-2 text-xs text-[#738096]"><span className="h-2 w-2 rounded-full bg-[#3155A6]" /> Revenue</div>
    </div>
  )
}

function ProductTrend({ data }: { data: SalesAnalytics['charts']['productTrend'] }) {
  const series = data.filter((product) => product.values.some((row) => row.revenue > 0))
  if (!series.length) return <EmptyChart label="No product revenue records in this period." />
  const rowCount = Math.max(...series.map((product) => product.values.length))
  const maximum = Math.max(...series.flatMap((product) => product.values.map((row) => row.revenue)), 1)
  return (
    <div>
      <svg role="img" aria-label="Product revenue trend line chart" viewBox="0 0 600 220" className="h-56 w-full">
        {[0, 1, 2, 3].map((line) => <line key={line} x1="60" x2="570" y1={30 + line * 45} y2={30 + line * 45} stroke="#EDF0F5" strokeDasharray="4 5" />)}
        <text x="2" y="26" fill="#8792A4" fontSize="10">{formatCompactCurrency(maximum)}</text>
        <text x="2" y="116" fill="#8792A4" fontSize="10">{formatCompactCurrency(maximum / 2)}</text>
        <text x="2" y="174" fill="#8792A4" fontSize="10">₹0</text>
        {series.map((product, seriesIndex) => {
          const points = product.values.map((row, index) => ({
            ...row,
            x: rowCount === 1 ? 320 : 70 + index / (rowCount - 1) * 500,
            y: 170 - row.revenue / maximum * 140,
          }))
          return <g key={product.product}>
            <path d={`M ${points.map((point) => `${point.x},${point.y}`).join(' L ')}`} fill="none" stroke={palette[seriesIndex % palette.length]} strokeWidth="2.5" />
            {points.map((point) => <circle key={`${product.product}-${point.label}`} cx={point.x} cy={point.y} r="3" fill="#fff" stroke={palette[seriesIndex % palette.length]} strokeWidth="2"><title>{`${product.product} · ${point.label}: ${formatCurrency(point.revenue)}`}</title></circle>)}
          </g>
        })}
        {series[0].values.filter((_, index) => rowCount <= 8 || index % 2 === 0).map((row) => {
          const x = rowCount === 1 ? 320 : 70 + series[0].values.indexOf(row) / (rowCount - 1) * 500
          return <text key={row.label} x={x} y="202" textAnchor="middle" fill="#8792A4" fontSize="10">{row.label.slice(5)}</text>
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[#738096]">
        {series.map((product, index) => <span key={product.product} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />{product.product}</span>)}
      </div>
    </div>
  )
}

function CountTrend({ data, seriesLabel }: { data: Array<{ label: string; count: number }>; seriesLabel: string }) {
  if (!data.length || data.every((row) => row.count === 0)) return <EmptyChart label={`No ${seriesLabel.toLowerCase()} recorded in this period.`} />
  const maximum = Math.max(...data.map((row) => row.count), 1)
  const points = data.map((row, index) => ({
    ...row,
    x: data.length === 1 ? 320 : 70 + index / (data.length - 1) * 500,
    y: 170 - row.count / maximum * 140,
  }))
  return (
    <div>
      <svg role="img" aria-label={`${seriesLabel} trend line chart`} viewBox="0 0 600 220" className="h-56 w-full">
        {[0, 1, 2, 3].map((line) => <line key={line} x1="60" x2="570" y1={30 + line * 45} y2={30 + line * 45} stroke="#EDF0F5" strokeDasharray="4 5" />)}
        <text x="2" y="26" fill="#8792A4" fontSize="10">{maximum}</text>
        <text x="2" y="116" fill="#8792A4" fontSize="10">{Math.round(maximum / 2)}</text>
        <text x="2" y="174" fill="#8792A4" fontSize="10">0</text>
        <path d={`M ${points.map((point) => `${point.x},${point.y}`).join(' L ')}`} fill="none" stroke="#20A39E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <g key={point.label}><circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#20A39E" strokeWidth="2"><title>{`${point.label}: ${point.count} ${seriesLabel.toLowerCase()}`}</title></circle>{(points.length <= 8 || index % 2 === 0) && <text x={point.x} y="202" textAnchor="middle" fill="#8792A4" fontSize="10">{point.label.slice(5)}</text>}</g>)}
      </svg>
      <div className="flex items-center gap-2 text-xs text-[#738096]"><span className="h-2 w-2 rounded-full bg-[#20A39E]" /> {seriesLabel}</div>
    </div>
  )
}

function DonutSummary({ data, colors = palette }: { data: Array<{ label: string; value: number }>; colors?: string[] }) {
  const validData = data.filter((row) => Number.isFinite(row.value) && row.value > 0)
  const total = validData.reduce((sum, row) => sum + row.value, 0)
  if (!validData.length || !total) return <EmptyChart label="No records are available for this period." />
  let current = 0
  const stops = validData.map((row, index) => {
    const start = current
    current += row.value / total * 100
    return `${colors[index % colors.length]} ${start}% ${current}%`
  })
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div role="img" aria-label={`Distribution total: ${total.toLocaleString('en-IN')}`} className="grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><p className="text-[10px] text-[#8792A4]">Total</p><p className="text-lg font-bold text-[#263650]">{total.toLocaleString('en-IN')}</p></div></div>
      </div>
      <div className="max-h-44 w-full space-y-2 overflow-y-auto">
        {validData.slice(0, 10).map((row, index) => <div key={row.label} className="flex min-w-0 items-center gap-2 text-xs" title={`${row.label}: ${row.value.toLocaleString('en-IN')} (${(row.value / total * 100).toFixed(1)}%)`}>
          <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} />
          <span className="min-w-0 flex-1 truncate text-[#5E6B80]">{row.label}</span>
          <span className="font-semibold tabular-nums text-[#33415C]">{row.value.toLocaleString('en-IN')}</span>
        </div>)}
      </div>
    </div>
  )
}

function MetricComparison({ items }: { items: Array<{ label: string; value: number; previous: number | null; color: string }> }) {
  const maximum = Math.max(...items.flatMap((item) => [Math.abs(item.value), Math.abs(item.previous || 0)]), 1)
  return (
    <div className="space-y-5">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex justify-between gap-2 text-xs"><span className="font-semibold text-[#52617A]">{item.label}</span><span className="font-bold text-[#273650]">{formatCurrency(item.value)}</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-[#EEF1F5]" title={`${item.label}: ${formatCurrency(item.value)}`}><div className="h-full rounded-full" style={{ width: `${Math.abs(item.value) / maximum * 100}%`, backgroundColor: item.color }} /></div>
          <p className="text-[11px] text-[#8792A4]">{item.previous === null ? 'Previous-period value unavailable' : `Previous period: ${formatCurrency(item.previous)}`}</p>
        </div>
      ))}
    </div>
  )
}

function EmployeeQuotationBars({ data }: { data: SalesAnalytics['charts']['employeeQuotations'] }) {
  if (!data.length) return <EmptyChart label="No quotation records are available for this period." />
  const maximum = Math.max(...data.flatMap((row) => [row.quotations, row.won]), 1)
  return (
    <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
      {data.map((row) => <div key={row.employee} className="space-y-2">
        <p className="truncate text-xs font-semibold text-[#52617A]" title={row.employee}>{row.employee}</p>
        {[{ label: 'Quotations', value: row.quotations, color: '#3155A6' }, { label: 'Won', value: row.won, color: '#3A8C58' }].map((item) => <div key={item.label} className="grid grid-cols-[58px_1fr_24px] items-center gap-2 text-[11px]">
          <span className="text-[#8792A4]">{item.label}</span><div className="h-2 overflow-hidden rounded-full bg-[#EEF1F5]" title={`${item.label}: ${item.value}`}><div className="h-full rounded-full" style={{ width: `${item.value / maximum * 100}%`, backgroundColor: item.color }} /></div><span className="text-right font-semibold text-[#33415C]">{item.value}</span>
        </div>)}
      </div>)}
      <div className="flex gap-4 border-t border-[#EDF0F5] pt-3 text-[11px] text-[#738096]"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#3155A6]" /> Quotations</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#3A8C58]" /> Won</span></div>
    </div>
  )
}

function FollowUpsTable({ data }: { data: SalesAnalytics['charts']['upcomingFollowUps'] }) {
  if (!data.length) return <EmptyChart label="No upcoming follow-ups in this period." />
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full min-w-[380px] text-left text-xs">
        <thead className="sticky top-0 bg-white text-[#8792A4]"><tr><th className="pb-2 pr-3 font-semibold">Customer</th><th className="pb-2 pr-3 font-semibold">Owner</th><th className="pb-2 pr-3 font-semibold">Due</th><th className="pb-2 font-semibold">Status</th></tr></thead>
        <tbody>{data.map((row, index) => <tr key={`${row.customer}-${row.followUpDate}-${index}`} className="border-t border-[#EDF0F5] text-[#52617A]"><td className="max-w-28 truncate py-2 pr-3" title={row.customer}>{row.customer}</td><td className="max-w-24 truncate py-2 pr-3" title={row.employee}>{row.employee}</td><td className="whitespace-nowrap py-2 pr-3">{row.followUpDate}</td><td className="py-2">{row.status}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function RevenueLine({ data }: { data: Array<{ label: string; revenue: number }> }) {
  if (!data.length) return <EmptyChart label="No revenue records in this period." />
  const max = Math.max(...data.map((row) => row.revenue), 1)
  const points = data.map((row, index) => {
    const x = data.length === 1 ? 320 : 70 + (index / (data.length - 1)) * 500
    const y = 172 - (row.revenue / max) * 145
    return { ...row, x, y }
  })
  return (
    <div>
      <svg role="img" aria-label="Revenue trend line chart" viewBox="0 0 600 220" className="h-56 w-full overflow-visible">
        {[0, 1, 2, 3].map((line) => <line key={line} x1="60" x2="570" y1={28 + line * 48} y2={28 + line * 48} stroke="#EDF0F5" strokeDasharray="4 5" />)}
        <text x="2" y="24" fill="#8792A4" fontSize="10">{formatCompactCurrency(max)}</text>
        <text x="2" y="120" fill="#8792A4" fontSize="10">{formatCompactCurrency(max / 2)}</text>
        <text x="2" y="174" fill="#8792A4" fontSize="10">₹0</text>
        <path d={`M ${points.map((point) => `${point.x},${point.y}`).join(' L ')}`} fill="none" stroke="#3155A6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#3155A6" strokeWidth="3"><title>{`${point.label}: ${formatCurrency(point.revenue)}`}</title></circle>
            {(data.length <= 8 || points.indexOf(point) % 2 === 0) && <text x={point.x} y="202" textAnchor="middle" fill="#8792A4" fontSize="10">{point.label.slice(5)}</text>}
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-2 text-xs text-[#738096]"><span className="h-2 w-2 rounded-full bg-[#3155A6]" /> Revenue</div>
    </div>
  )
}

function RevenueBars({ data }: { data: Array<{ label: string; revenue: number }> }) {
  if (!data.length) return <EmptyChart label="No performance records in this period." />
  const max = Math.max(...data.map((row) => row.revenue), 1)
  return (
    <div className="space-y-3">
      {data.map((row, index) => (
        <div key={row.label} className="grid grid-cols-[minmax(75px,1fr)_2fr_auto] items-center gap-3 text-xs">
          <span className="truncate font-medium text-[#5E6B80]" title={row.label}>{row.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF1F5]" role="img" aria-label={`${row.label}: ${formatCurrency(row.revenue)}`}>
            <div title={`${row.label}: ${formatCurrency(row.revenue)}`} className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max((row.revenue / max) * 100, row.revenue > 0 ? 2 : 0)}%`, backgroundColor: palette[index % palette.length] }} />
          </div>
          <span className="min-w-[75px] text-right font-semibold tabular-nums text-[#33415C]">{formatCompactCurrency(row.revenue)}</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#EDF0F5] pt-3 text-[11px] text-[#8792A4]">
        {[...new Set(data.map((_, index) => palette[index % palette.length]))].map((color, index) => <span key={color} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />{data[index]?.label || 'Revenue'}</span>)}
      </div>
    </div>
  )
}

function FunnelChart({ data }: { data: SalesAnalytics['charts']['funnel'] }) {
  if (!data.length) return <EmptyChart label="No funnel records in this period." />
  const max = Math.max(...data.map((row) => row.count), 1)
  return (
    <div className="space-y-3">
      {data.map((row, index) => (
        <div key={row.stage} className="grid grid-cols-[90px_1fr_32px] items-center gap-2 text-xs">
          <span className="truncate font-medium text-[#5E6B80]">{row.stage}</span>
          <div className="h-7 overflow-hidden rounded-md bg-[#F0F3F8]" title={`${row.stage}: ${row.count} deals`}>
            <div className="flex h-full items-center rounded-md px-2 text-[10px] font-semibold text-white transition-all" style={{ width: `${Math.max((row.count / max) * 100, 8)}%`, backgroundColor: palette[index % palette.length] }}>{row.count}</div>
          </div>
          <span className="text-right font-bold text-[#33415C]">{row.count}</span>
        </div>
      ))}
    </div>
  )
}

function RevenueDonut({ data }: { data: SalesAnalytics['charts']['customerRevenue'] }) {
  const total = data.reduce((sum, row) => sum + row.revenue, 0)
  if (!data.length || total <= 0) return <EmptyChart label="No customer revenue records in this period." />
  let current = 0
  const stops = data.map((row, index) => {
    const start = current
    current += (row.revenue / total) * 100
    return `${palette[index % palette.length]} ${start}% ${current}%`
  })
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div role="img" aria-label="Customer revenue distribution" className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center">
          <div><p className="text-[10px] text-[#8792A4]">Top customers</p><p className="text-sm font-bold text-[#263650]">{formatCompactCurrency(total)}</p></div>
        </div>
        {data.map((row, index) => <span key={row.customer} className="sr-only">{row.customer}: {formatCurrency(row.revenue)} ({Math.round((row.revenue / total) * 100)}%)</span>)}
      </div>
      <div className="w-full space-y-2">
        {data.slice(0, 6).map((row, index) => (
          <div key={row.customer} className="flex min-w-0 items-center gap-2 text-xs">
            <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: palette[index % palette.length] }} />
            <span className="min-w-0 flex-1 truncate text-[#5E6B80]" title={`${row.customer}: ${formatCurrency(row.revenue)} (${Math.round((row.revenue / total) * 100)}%)`}>{row.customer}</span>
            <span className="font-semibold tabular-nums text-[#33415C]">{formatCompactCurrency(row.revenue)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Leaderboard({ data }: { data: SalesAnalytics['charts']['employeeRevenue'] }) {
  if (!data.length) return <EmptyChart label="No employee revenue records in this period." />
  const max = Math.max(...data.map((row) => row.revenue), 1)
  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((row, index) => (
        <div key={row.employee} className="flex items-center gap-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? 'bg-[#FFF3DB] text-[#BD7C16]' : 'bg-[#F0F3F8] text-[#65738A]'}`}>{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-[#40506B]">{row.employee}</span>
              <span className="shrink-0 font-bold text-[#273650]">{formatCompactCurrency(row.revenue)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF1F5]" title={`${row.deals} order forms`}>
              <div className="h-full rounded-full bg-[#20A39E]" style={{ width: `${row.revenue ? Math.max((row.revenue / max) * 100, 2) : 0}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-[#98A2B1]">{row.deals} order forms</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function TargetGauge({ target, achieved }: { target: number | null; achieved: number }) {
  if (target === null || target <= 0) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl bg-[#F7F9FC] px-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-[#EAF0FC] text-[#3155A6]"><Target className="h-6 w-6" /></div>
        <p className="mt-3 text-sm font-semibold text-[#33415C]">Target not configured</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-[#8792A4]">Sales achievement: {formatCurrency(achieved)}. Add targets to employee records to calculate attainment.</p>
      </div>
    )
  }
  const percent = Math.min(achieved / target, 1)
  return (
    <div className="flex min-h-44 flex-col items-center justify-center text-center">
      <div className="grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(#20A39E ${percent * 100}%, #E9EDF3 0)` }}>
        <div className="grid h-28 w-28 place-items-center rounded-full bg-white"><div><p className="text-2xl font-bold text-[#17233B]">{Math.round((achieved / target) * 100)}%</p><p className="text-[10px] text-[#8792A4]">of target</p></div></div>
      </div>
      <p className="mt-3 text-xs text-[#738096]">{formatCurrency(achieved)} of {formatCurrency(target)}</p>
    </div>
  )
}

function ActivityHeatmap({ data }: { data: SalesAnalytics['charts']['activityHeatmap'] }) {
  if (!data.length || data.every((item) => item.count === 0)) return <EmptyChart label="No logged sales activities in this period." />
  const max = Math.max(...data.map((item) => item.count), 1)
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-1.5">
        {data.map((item) => {
          const intensity = item.count ? Math.max(0.18, item.count / max) : 0
          return <div key={item.date} title={`${item.date}: ${item.count} activities`} aria-label={`${item.date}: ${item.count} activities`} className="aspect-square min-w-0 rounded-[4px] border border-[#E7ECF2]" style={{ backgroundColor: item.count ? `rgba(49, 85, 166, ${intensity})` : '#F6F8FB' }} />
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[#8792A4]">
        <span>{data[0]?.date}</span><span>{data[data.length - 1]?.date}</span>
        <span className="inline-flex items-center gap-1.5"><span>Less</span>{[0.12, 0.35, 0.65, 1].map((opacity) => <i key={opacity} className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: `rgba(49, 85, 166, ${opacity})` }} />)}<span>More</span></span>
      </div>
    </div>
  )
}

function AssistantChart({ chartKey, data }: { chartKey: AnalyticsChartKey; data: SalesAnalytics }) {
  if (chartKey === 'revenueTrend') return <div className="rounded-xl border border-[#E4EAF2] bg-white p-3"><RevenueLine data={data.charts.revenueTrend} /></div>
  if (chartKey === 'customers') return <div className="rounded-xl border border-[#E4EAF2] bg-white p-4"><RevenueDonut data={data.charts.customerRevenue} /></div>
  if (chartKey === 'employees') return <div className="rounded-xl border border-[#E4EAF2] bg-white p-4"><Leaderboard data={data.charts.employeeRevenue} /></div>
  if (chartKey === 'funnel') return <div className="rounded-xl border border-[#E4EAF2] bg-white p-4"><FunnelChart data={data.charts.funnel} /></div>
  if (chartKey === 'products') return <div className="rounded-xl border border-[#E4EAF2] bg-white p-4"><RevenueBars data={data.charts.productRevenue.map((row) => ({ label: row.product, revenue: row.revenue }))} /></div>
  if (chartKey === 'activities') return <div className="rounded-xl border border-[#E4EAF2] bg-white p-4"><DonutSummary data={data.charts.activityByStatus.map((row) => ({ label: row.status, value: row.count }))} /></div>
  return null
}
