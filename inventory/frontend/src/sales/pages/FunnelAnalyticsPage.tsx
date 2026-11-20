import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Filter,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import { fetchFunnelAnalytics, type FunnelAnalyticsData, type FunnelAnalyticsFilters, type FunnelGranularity } from '@/sales/lib/funnelAnalyticsApi'

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })
const currencyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateKeyToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}
const formatCurrency = (value: number | null | undefined) => value === null || value === undefined ? '—' : currencyFormat.format(value)
const formatNumber = (value: number | null | undefined) => value === null || value === undefined ? '—' : numberFormat.format(value)

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 rounded-xl border border-[#EFECE5] bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}

function EmptyChart({ children }: { children: string }) {
  return <div className="flex h-[280px] items-center justify-center rounded-lg bg-slate-50 px-5 text-center text-sm text-slate-500">{children}</div>
}

function StageSummaryCard({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: string }) {
  const Icon = title === 'Average Days in Stage' ? CalendarDays : CircleDollarSign
  return (
    <article className="rounded-xl border border-[#EFECE5] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <span className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </article>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">
        <option value="">All</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function makeExportRows(data: FunnelAnalyticsData) {
  const rows: Array<Array<string | number | null>> = []
  const add = (section: string, label: string, count: number | null, revenue: number | null, margin: number | null, detail = '') => {
    rows.push([section, label, count, revenue, margin, detail])
  }
  Object.entries(data.kpis).forEach(([key, value]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase())
    add('Summary', label, typeof value === 'number' ? value : null, null, null)
  })
  data.trend.forEach((row) => add('Creation trend', row.label, row.current, null, null, `Previous period: ${row.previous ?? 'not available'}`))
  data.stages.forEach((row) => add('Stage conversion', row.stage, row.count, row.revenue, row.margin, `Current-stage share: ${numberFormat.format(row.conversionPercent)}%; drop-off: ${formatNumber(row.dropOffPercent)}%; average days in current stage: ${formatNumber(row.averageDaysInStage)} from ${row.averageDaysInStageCount} funnel(s)`))
  data.sbuAnalytics.forEach((row) => add('SBU', row.sbu, row.count, row.revenue, null))
  data.topCustomers.forEach((row) => add('Top customers', row.customer, row.count, row.revenue, row.margin))
  data.topProducts.forEach((row) => add('Top products', row.product, row.funnelCount, row.revenue, row.margin))
  data.leaderboard.forEach((row) => add('Sales representatives', `${row.rank}. ${row.employee}`, row.deals, row.revenue, null))
  return rows
}

function downloadCsv(data: FunnelAnalyticsData) {
  const rows: Array<Array<string | number | null>> = [
    ['Section', 'Metric', 'Count', 'Revenue (INR)', 'Margin (INR)', 'Details'],
    ...makeExportRows(data),
  ]
  const contents = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `funnel-analytics-${data.range.start}-to-${data.range.end}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function FunnelAnalyticsPage() {
  const navigate = useNavigate()
  const reportRef = useRef<HTMLDivElement>(null)
  const today = dateKeyToday()
  const defaultStartDate = `${today.slice(0, 4)}-01-01`
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(today)
  const [granularity, setGranularity] = useState<FunnelGranularity>('monthly')
  const [stage, setStage] = useState('')
  const [resource, setResource] = useState('')
  const [accountManager, setAccountManager] = useState('')
  const [sbu, setSbu] = useState('')
  const [oem, setOem] = useState('')
  const [branch, setBranch] = useState('')
  const [data, setData] = useState<FunnelAnalyticsData>()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const filters = useMemo<FunnelAnalyticsFilters>(() => ({
    startDate,
    endDate,
    granularity,
    stage,
    resource,
    accountManager,
    sbu,
    oem,
    branch,
  }), [startDate, endDate, granularity, stage, resource, accountManager, sbu, oem, branch])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetchFunnelAnalytics(filters)
        if (active) setData(response)
      } catch (cause) {
        if (active) {
          setData(undefined)
          setError(cause instanceof Error ? cause.message : 'Unable to load Funnel analytics.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [filters])

  const exportPdf = async () => {
    if (!reportRef.current || !data) return
    setExporting(true)
    setError('')
    try {
      await html2pdf().set({
        margin: 8,
        filename: `funnel-analytics-${data.range.start}-to-${data.range.end}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#f8fafc' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }).from(reportRef.current).save()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate the Funnel analytics PDF.')
    } finally {
      setExporting(false)
    }
  }

  const exportExcel = async () => {
    if (!data) return
    setExporting(true)
    setError('')
    try {
      await downloadExcelReport({
        fileName: `funnel-analytics-${data.range.start}-to-${data.range.end}.xlsx`,
        sheetName: 'Funnel Analytics',
        headers: ['Section', 'Metric', 'Count', 'Revenue (INR)', 'Margin (INR)', 'Details'],
        rows: makeExportRows(data),
        currencyColumns: [3, 4],
        textColumns: [0, 1, 5],
        wrapColumns: [1, 5],
        wideColumns: [1, 5],
        columnWidths: [24, 34, 14, 20, 20, 72],
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export Funnel analytics to Excel.')
    } finally {
      setExporting(false)
    }
  }

  const kpis = data ? [
    { label: 'Total Funnels', value: formatNumber(data.kpis.totalFunnels), icon: BarChart3, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Open Funnels', value: formatNumber(data.kpis.openFunnels), icon: Target, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Quotations Generated', value: formatNumber(data.kpis.quotationsGenerated), icon: FileSpreadsheet, tone: 'bg-violet-50 text-violet-600' },
    { label: 'Closed Funnels', value: formatNumber(data.kpis.closedFunnels), icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Lost Funnels', value: formatNumber(data.kpis.lostFunnels), icon: Filter, tone: 'bg-rose-50 text-rose-600' },
    { label: 'Total Revenue', value: formatCurrency(data.kpis.totalRevenue), icon: CircleDollarSign, tone: 'bg-cyan-50 text-cyan-700' },
    { label: 'Total Margin', value: formatCurrency(data.kpis.totalMargin), icon: CircleDollarSign, tone: 'bg-green-50 text-green-700' },
    { label: 'Expired Funnels', value: formatNumber(data.kpis.expiredFunnels), icon: CalendarDays, tone: 'bg-orange-50 text-orange-600' },
    { label: 'Demo Conducted', value: formatNumber(data.kpis.demoConducted), icon: Users, tone: 'bg-indigo-50 text-indigo-600' },
    { label: 'Conversion Rate', value: `${numberFormat.format(data.kpis.conversionRate)}%`, icon: Trophy, tone: 'bg-pink-50 text-pink-600' },
  ] : []

  const hasData = Boolean(data?.kpis.totalFunnels)
  const stageAgeCount = data?.stages.reduce((total, item) => total + item.averageDaysInStageCount, 0) || 0
  const averageStageDays = data && stageAgeCount
    ? data.stages.reduce((total, item) => total + (item.averageDaysInStage || 0) * item.averageDaysInStageCount, 0) / stageAgeCount
    : null

  return (
    <div className="space-y-4">
      <style>{'@media print {.funnel-analytics-no-print{display:none!important}.funnel-analytics-report{box-shadow:none!important;border-color:#ddd!important}}'}</style>
      <header className="flex flex-wrap items-center justify-between gap-3 funnel-analytics-no-print">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate('/sales/funnels')} aria-label="Back to Funnel dashboard" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EFECE5] bg-white text-gray-700 shadow-sm hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="crm-page-heading !text-xl">Funnel Analytics Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => data && downloadCsv(data)} disabled={loading || !data} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button type="button" onClick={() => void exportExcel()} disabled={loading || exporting || !data} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
          <button type="button" onClick={() => void exportPdf()} disabled={loading || exporting || !data} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111827] px-3.5 text-sm font-medium text-white shadow-sm hover:bg-[#1E293B] disabled:opacity-60">
            <Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </header>

      <section aria-label="Funnel analytics filters" className="grid grid-cols-1 gap-3 rounded-xl border border-[#EFECE5] bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 funnel-analytics-no-print">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Start Date
          <input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          End Date
          <input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800" />
        </label>
        <FilterSelect label="Funnel Stage" value={stage} onChange={setStage} options={(data?.filterOptions.stages || []).map((value) => ({ value, label: value }))} />
        <FilterSelect label="Resource / Employee" value={resource} onChange={setResource} options={(data?.filterOptions.resources || []).map((value) => ({ value, label: value }))} />
        <FilterSelect label="Account Manager" value={accountManager} onChange={setAccountManager} options={(data?.filterOptions.accountManagers || []).map(({ id, name }) => ({ value: id, label: name }))} />
        <FilterSelect label="SBU" value={sbu} onChange={setSbu} options={(data?.filterOptions.sbus || []).map((value) => ({ value, label: value }))} />
        <div className="grid grid-cols-2 gap-3">
          <FilterSelect label="OEM" value={oem} onChange={setOem} options={(data?.filterOptions.oems || []).map((value) => ({ value, label: value }))} />
          <FilterSelect label="Branch" value={branch} onChange={setBranch} options={(data?.filterOptions.branches || []).map((value) => ({ value, label: value }))} />
        </div>
      </section>

      {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {loading ? (
        <div className="space-y-5" aria-label="Loading Funnel analytics" aria-live="polite">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, index) => <div key={index} className="h-[96px] animate-pulse rounded-xl border border-[#EFECE5] bg-white p-4"><div className="h-3 w-2/3 rounded bg-slate-200" /><div className="mt-5 h-5 w-1/3 rounded bg-slate-100" /></div>)}
          </div>
          <div className="h-[320px] animate-pulse rounded-xl border border-[#EFECE5] bg-white p-5" />
        </div>
      ) : data ? (
        <div ref={reportRef} className="funnel-analytics-report space-y-4">
          <section aria-label="Funnel KPI summary" className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {kpis.slice(0, 5).map(({ label, value, icon: Icon, tone }) => (
                <article key={label} className="flex min-h-[88px] min-w-0 items-center gap-3 rounded-xl border border-[#EFECE5] bg-white px-4 py-3 shadow-sm">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold leading-tight text-slate-900">{value}</p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {kpis.slice(5).map(({ label, value, icon: Icon, tone }) => (
                <article key={label} className="flex min-h-[88px] min-w-0 items-center gap-3 rounded-xl border border-[#EFECE5] bg-white px-4 py-3 shadow-sm">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold leading-tight text-slate-900">{value}</p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {!hasData ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">No Funnel records were found for the selected filters and date range.</div> : null}

          <section aria-label="Funnel creation trend">
            <ChartPanel title="Funnel Creation Trend" subtitle="Current period compared with the previous equivalent period">
              {data.trend.some((item) => (item.current || 0) > 0 || (item.previous || 0) > 0) ? (
                <>
                  <div className="mb-3 flex items-center justify-end gap-2 text-xs">
                    <span className="text-slate-500">Group by</span>
                    {(['daily', 'weekly', 'monthly'] as const).map((value) => (
                      <button key={value} type="button" onClick={() => setGranularity(value)} className={`rounded-md px-2.5 py-1 font-medium capitalize ${granularity === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{value}</button>
                    ))}
                  </div>
                  <div className="h-[290px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trend} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="current" name="Current period" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="previous" name="Previous period" stroke="#14B8A6" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : <EmptyChart>No funnel creation records are available for this period.</EmptyChart>}
            </ChartPanel>
          </section>

          <section aria-label="Funnel stage conversion and summaries" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartPanel title="Funnel Stage Conversion" subtitle="Current counts and each stage's share of funnels, using recorded CRM stages">
                <div className="space-y-4">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.stages} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 12 }}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="stage" width={104} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value, name, item) => {
                          const row = item.payload as FunnelAnalyticsData['stages'][number]
                          return [name === 'count'
                            ? `${value} (${numberFormat.format(row.conversionPercent)}%)`
                            : formatNumber(row.dropOffPercent), name === 'count' ? 'Funnels' : String(name)]
                        }} />
                        <Bar dataKey="count" name="Funnels" fill="#6366F1" radius={[0, 5, 5, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs text-slate-600">
                      <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                        <tr><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Count</th><th className="py-2 pr-3">Stage share</th><th className="py-2 pr-3">Drop-off</th><th className="py-2 pr-3">Revenue</th><th className="py-2 pr-3">Margin</th><th className="py-2">Avg. days in stage</th></tr>
                      </thead>
                      <tbody>
                        {data.stages.map((row) => (
                          <tr key={row.stage} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 font-medium text-slate-800">{row.stage}</td>
                            <td className="py-2 pr-3">{numberFormat.format(row.count)}</td>
                            <td className="py-2 pr-3">{numberFormat.format(row.conversionPercent)}%</td>
                            <td className="py-2 pr-3" title={row.dropOffUnavailableReason}>{formatNumber(row.dropOffPercent)}{row.dropOffPercent === null ? '' : '%'}</td>
                            <td className="py-2 pr-3">{formatCurrency(row.revenue)}</td>
                            <td className="py-2 pr-3">{formatCurrency(row.margin)}</td>
                            <td className="py-2">{formatNumber(row.averageDaysInStage)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11px] text-slate-500">Stage drop-off is shown as N/A because historical exits are not consistently recorded. Average days uses recorded stage-change dates only; it is N/A when CRM history is unavailable.</p>
                  </div>
                </div>
              </ChartPanel>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <StageSummaryCard
                title="Stage-wise Revenue"
                value={formatCurrency(data.kpis.totalRevenue)}
                detail={`${numberFormat.format(data.kpis.revenueAvailableCount)} funnel record(s) with recorded revenue`}
                tone="text-sky-700 bg-sky-50"
              />
              <StageSummaryCard
                title="Stage-wise Margin"
                value={formatCurrency(data.kpis.totalMargin)}
                detail={`${numberFormat.format(data.kpis.marginAvailableCount)} funnel record(s) with recorded margin`}
                tone="text-emerald-700 bg-emerald-50"
              />
              <StageSummaryCard
                title="Average Days in Stage"
                value={formatNumber(averageStageDays)}
                detail={`${numberFormat.format(stageAgeCount)} funnel record(s) with recorded stage-change dates`}
                tone="text-violet-700 bg-violet-50"
              />
            </div>
          </section>

          <section aria-label="Revenue and SBU analysis" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartPanel title="Revenue by Funnel Stage" subtitle="Revenue amounts use the recorded funnel revenue or available product value">
              {data.revenueByStage.length ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.revenueByStage} margin={{ top: 10, right: 16, bottom: 8, left: 6 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="stage" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `₹${numberFormat.format(Number(value))}`} width={64} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
                      <Bar dataKey="revenue" name="Revenue" fill="#0EA5E9" radius={[5, 5, 0, 0]}>
                        <LabelList dataKey="revenue" position="top" formatter={(value) => value === null ? '' : `₹${numberFormat.format(Number(value))}`} className="fill-slate-600" fontSize={9} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No funnel revenue values are recorded for these filters.</EmptyChart>}
            </ChartPanel>

            <ChartPanel title="SBU-wise Analytics" subtitle="Funnel count and recorded revenue for each SBU">
              {data.sbuAnalytics.length ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.sbuAnalytics} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="sbu" tick={{ fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={48} />
                      <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 10 }} width={34} />
                      <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 9 }} tickFormatter={(value) => `₹${numberFormat.format(Number(value))}`} width={64} />
                      <Tooltip formatter={(value, name) => [name === 'Revenue' ? formatCurrency(Number(value)) : numberFormat.format(Number(value)), name]} />
                      <Legend />
                      <Bar yAxisId="count" dataKey="count" name="Funnels" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill="#F97316" radius={[4, 4, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No SBU values are recorded.</EmptyChart>}
            </ChartPanel>
          </section>

          <section aria-label="Top customers and products" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartPanel title="Top Customers by Funnel Value" subtitle="Top 10 customers ranked by recorded funnel revenue">
              {data.topCustomers.length && data.topCustomers.some((row) => row.revenue !== null) ? (
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topCustomers} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 8 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(value) => `₹${numberFormat.format(Number(value))}`} />
                      <YAxis type="category" dataKey="customer" width={120} tick={{ fontSize: 10 }} />
                      <Legend />
                      <Tooltip formatter={(value, name, item) => {
                        const row = item.payload as FunnelAnalyticsData['topCustomers'][number]
                        return [formatCurrency(Number(value)), `${String(name)} · Margin ${formatCurrency(row.margin)}`]
                      }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[0, 5, 5, 0]} />
                      <Bar dataKey="margin" name="Margin" fill="#8B5CF6" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No customer funnel revenue is available.</EmptyChart>}
            </ChartPanel>

            <ChartPanel title="Top Products by Funnel Count" subtitle="Top 10 recorded products ranked by distinct funnel count">
              {data.topProducts.length ? (
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topProducts} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 8 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(value) => `₹${numberFormat.format(Number(value))}`} />
                      <YAxis type="category" dataKey="product" width={120} tick={{ fontSize: 10 }} />
                      <Legend />
                      <Tooltip formatter={(value, name, item) => {
                        const row = item.payload as FunnelAnalyticsData['topProducts'][number]
                        return [
                          formatCurrency(Number(value)),
                          `${String(name)} · ${numberFormat.format(row.funnelCount)} funnel(s) · Revenue ${formatCurrency(row.revenue)} · Margin ${formatCurrency(row.margin)}`,
                        ]
                      }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#0EA5E9" radius={[0, 5, 5, 0]} />
                      <Bar dataKey="margin" name="Margin" fill="#10B981" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No product funnel records are available.</EmptyChart>}
            </ChartPanel>
          </section>

          <ChartPanel title="Top Sales Representatives Leaderboard" subtitle="Ranked by total recorded funnel revenue, then deal count">
            {data.leaderboard.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.leaderboard.map((row) => {
                  const highestRevenue = Math.max(0, ...data.leaderboard.map((leader) => leader.revenue || 0))
                  const revenueWidth = highestRevenue ? Math.max(0, (row.revenue || 0) / highestRevenue * 100) : 0
                  const rankTone = row.rank === 1 ? 'bg-amber-100 text-amber-800'
                    : row.rank === 2 ? 'bg-slate-100 text-slate-700'
                      : row.rank === 3 ? 'bg-orange-100 text-orange-800'
                        : 'bg-indigo-50 text-indigo-700'
                  return (
                    <article key={`${row.employeeId}-${row.employee}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankTone}`}>#{row.rank}</span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-slate-900">{row.employee}</h3>
                            <p className="mt-0.5 text-xs text-slate-500">{row.rank === 1 ? 'Top performer' : row.rank <= 3 ? 'Leading representative' : 'Sales representative'}</p>
                          </div>
                        </div>
                        <Trophy className={`h-4 w-4 shrink-0 ${row.rank <= 3 ? 'text-amber-500' : 'text-slate-300'}`} />
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Funnels</p>
                          <p className="mt-0.5 text-lg font-bold text-slate-900">{numberFormat.format(row.deals)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Revenue</p>
                          <p className="mt-0.5 text-sm font-bold text-slate-900">{formatCurrency(row.revenue)}</p>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${revenueWidth}%` }} />
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : <EmptyChart>No sales representative records are available.</EmptyChart>}
          </ChartPanel>
        </div>
      ) : null}
    </div>
  )
}
