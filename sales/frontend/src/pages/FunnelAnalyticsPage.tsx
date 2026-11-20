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
  RefreshCw,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { fetchFunnelAnalytics, type FunnelAnalyticsData, type FunnelAnalyticsFilters, type FunnelGranularity } from '@/lib/funnelAnalyticsApi'

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })
const currencyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
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
const money = (value: number | null | undefined) => value === null || value === undefined ? '—' : currencyFormat.format(value)
const count = (value: number | null | undefined) => value === null || value === undefined ? '—' : numberFormat.format(value)
const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function FilterSelect({ label, value, options, onChange }: {
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

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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

function Empty({ children }: { children: string }) {
  return <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-slate-50 px-5 text-center text-sm text-slate-500">{children}</div>
}

function BarRows({ rows, label, value, format = count, color = 'bg-indigo-500' }: {
  rows: Array<Record<string, string | number | null>>
  label: string
  value: string
  format?: (value: number | null) => string
  color?: string
}) {
  const max = Math.max(0, ...rows.map((row) => Math.abs(Number(row[value]) || 0)))
  if (!rows.length) return <Empty>No matching records are available.</Empty>
  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const numeric = row[value] === null ? null : Number(row[value])
        return (
          <div key={`${String(row[label])}-${index}`} className="grid grid-cols-[minmax(90px,130px)_minmax(50px,1fr)_auto] items-center gap-2 text-xs">
            <span className="truncate font-medium text-slate-700" title={String(row[label])}>{String(row[label])}</span>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${max && numeric !== null ? Math.max(2, Math.abs(numeric) / max * 100) : 0}%` }} />
            </div>
            <span className="whitespace-nowrap text-right text-slate-600">{format(numeric)}</span>
          </div>
        )
      })}
    </div>
  )
}

function downloadCsv(data: FunnelAnalyticsData) {
  const rows: unknown[][] = [
    ['Section', 'Metric', 'Count', 'Revenue (INR)', 'Margin (INR)', 'Details'],
    ...Object.entries(data.kpis).map(([key, value]) => ['Summary', key, value, '', '', '']),
    ...data.stages.map((row) => ['Stage conversion', row.stage, row.count, row.revenue, row.margin, `${count(row.conversionPercent)}% stage share`]),
    ...data.trend.map((row) => ['Creation trend', row.label, row.current, '', '', `Previous period: ${row.previous ?? 'not available'}`]),
    ...data.sbuAnalytics.map((row) => ['SBU', row.sbu, row.count, row.revenue, '', '']),
    ...data.topCustomers.map((row) => ['Top customer', row.customer, row.count, row.revenue, row.margin, '']),
    ...data.topProducts.map((row) => ['Top product', row.product, row.funnelCount, row.revenue, row.margin, '']),
    ...data.leaderboard.map((row) => ['Leaderboard', row.employee, row.deals, row.revenue, '', `Rank ${row.rank}`]),
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

function downloadExcelXml(data: FunnelAnalyticsData) {
  const rows = [
    ['Section', 'Metric', 'Count', 'Revenue (INR)', 'Margin (INR)', 'Details'],
    ...Object.entries(data.kpis).map(([key, value]) => ['Summary', key, value, '', '', '']),
    ...data.stages.map((row) => ['Stage conversion', row.stage, row.count, row.revenue ?? '', row.margin ?? '', `${count(row.conversionPercent)}% stage share; drop-off unavailable`]),
    ...data.trend.map((row) => ['Creation trend', row.label, row.current ?? '', '', '', `Previous period: ${row.previous ?? 'not available'}`]),
    ...data.sbuAnalytics.map((row) => ['SBU', row.sbu, row.count, row.revenue ?? '', '', '']),
    ...data.topCustomers.map((row) => ['Top customer', row.customer, row.count, row.revenue ?? '', row.margin ?? '', '']),
    ...data.topProducts.map((row) => ['Top product', row.product, row.funnelCount, row.revenue ?? '', row.margin ?? '', '']),
    ...data.leaderboard.map((row) => ['Leaderboard', row.employee, row.deals, row.revenue ?? '', '', `Rank ${row.rank}`]),
  ]
  const xmlRows = rows.map((row) => `<Row>${row.map((cell) => {
    const type = typeof cell === 'number' ? 'Number' : 'String'
    return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`
  }).join('')}</Row>`).join('')
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Funnel Analytics"><Table>${xmlRows}</Table></Worksheet></Workbook>`
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `funnel-analytics-${data.range.start}-to-${data.range.end}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function FunnelAnalyticsPage() {
  const navigate = useNavigate()
  const reportRef = useRef<HTMLDivElement>(null)
  const today = todayDateKey()
  const [startDate, setStartDate] = useState(`${today.slice(0, 4)}-01-01`)
  const [endDate, setEndDate] = useState(today)
  const [granularity, setGranularity] = useState<FunnelGranularity>('monthly')
  const [stage, setStage] = useState('')
  const [resource, setResource] = useState('')
  const [accountManager, setAccountManager] = useState('')
  const [sbu, setSbu] = useState('')
  const [oem, setOem] = useState('')
  const [branch, setBranch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<FunnelAnalyticsData>()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const filters = useMemo<FunnelAnalyticsFilters>(() => ({
    startDate, endDate, granularity, stage, resource, accountManager, sbu, oem, branch,
  }), [startDate, endDate, granularity, stage, resource, accountManager, sbu, oem, branch])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await fetchFunnelAnalytics(filters)
        if (active) setData(result)
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
  }, [filters, refreshKey])

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
      setError(cause instanceof Error ? cause.message : 'Unable to create the Funnel analytics PDF.')
    } finally {
      setExporting(false)
    }
  }

  const kpis = data ? [
    { label: 'Total Funnels', value: count(data.kpis.totalFunnels), icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
    { label: 'Open Funnels', value: count(data.kpis.openFunnels), icon: Target, color: 'bg-amber-50 text-amber-600' },
    { label: 'Quotations Generated', value: count(data.kpis.quotationsGenerated), icon: FileSpreadsheet, color: 'bg-violet-50 text-violet-600' },
    { label: 'Closed Funnels', value: count(data.kpis.closedFunnels), icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Lost Funnels', value: count(data.kpis.lostFunnels), icon: Target, color: 'bg-rose-50 text-rose-600' },
    { label: 'Total Revenue', value: money(data.kpis.totalRevenue), icon: CircleDollarSign, color: 'bg-cyan-50 text-cyan-700' },
    { label: 'Total Margin', value: money(data.kpis.totalMargin), icon: CircleDollarSign, color: 'bg-green-50 text-green-700' },
    { label: 'Expired Funnels', value: count(data.kpis.expiredFunnels), icon: CalendarDays, color: 'bg-orange-50 text-orange-600' },
    { label: 'Demo Conducted', value: count(data.kpis.demoConducted), icon: Users, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Conversion Rate', value: `${count(data.kpis.conversionRate)}%`, icon: Trophy, color: 'bg-pink-50 text-pink-600' },
  ] : []
  const maxTrend = Math.max(1, ...(data?.trend.flatMap((item) => [item.current || 0, item.previous || 0]) || []))
  const currentPoints = data?.trend.map((item, index) => {
    const x = data.trend.length > 1 ? index / (data.trend.length - 1) * 100 : 50
    const y = 100 - (item.current || 0) / maxTrend * 90
    return `${x},${y}`
  }).join(' ') || ''
  const previousPoints = data?.trend.map((item, index) => {
    const x = data.trend.length > 1 ? index / (data.trend.length - 1) * 100 : 50
    const y = 100 - (item.previous || 0) / maxTrend * 90
    return `${x},${y}`
  }).join(' ') || ''

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/sales/funnels')} aria-label="Back to Funnel dashboard" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#EFECE5] bg-white text-gray-700 shadow-sm hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="crm-page-heading !text-xl">Funnel Analytics Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-3 text-sm font-medium text-gray-700 shadow-sm disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          <button type="button" onClick={() => data && downloadCsv(data)} disabled={loading || !data} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-3 text-sm font-medium text-gray-700 shadow-sm disabled:opacity-60"><Download className="h-4 w-4" />Export CSV</button>
          <button type="button" onClick={() => data && downloadExcelXml(data)} disabled={loading || !data} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-3 text-sm font-medium text-gray-700 shadow-sm disabled:opacity-60"><FileSpreadsheet className="h-4 w-4" />Export Excel</button>
          <button type="button" onClick={() => window.print()} disabled={loading || !data} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-3 text-sm font-medium text-gray-700 shadow-sm disabled:opacity-60"><Download className="h-4 w-4" />Print</button>
          <button type="button" onClick={() => void exportPdf()} disabled={loading || exporting || !data} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111827] px-3.5 text-sm font-medium text-white shadow-sm disabled:opacity-60"><Download className="h-4 w-4" />{exporting ? 'Exporting...' : 'Export PDF'}</button>
        </div>
      </header>

      <section aria-label="Funnel analytics filters" className="grid grid-cols-1 gap-3 rounded-xl border border-[#EFECE5] bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 print:hidden">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Start Date<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">End Date<input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
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
      {loading ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Loading Funnel analytics">{Array.from({ length: 10 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-[#EFECE5] bg-white" />)}</div> : null}
      {!loading && data ? (
        <div ref={reportRef} className="space-y-4">
          <div className="rounded-xl border border-[#EFECE5] bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Funnel Analytics Dashboard</p>
            <p className="mt-1 text-xs text-slate-500">Reporting period: {data.range.start} to {data.range.end} · Stage: {stage || 'All'} · Resource: {resource || 'All'} · Account Manager: {data.filterOptions.accountManagers.find((item) => item.id === accountManager)?.name || 'All'} · SBU: {sbu || 'All'} · OEM: {oem || 'All'} · Branch: {branch || 'All'}</p>
            <p className="mt-1 text-[11px] text-slate-500">Margin is calculated from recorded revenue and margin percentage. Stage drop-off is unavailable because historical exits are not consistently recorded.</p>
          </div>

          <section aria-label="Funnel KPI summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map(({ label, value, icon: Icon, color }) => <article key={label} className="flex min-h-[88px] items-center gap-3 rounded-xl border border-[#EFECE5] bg-white px-4 py-3 shadow-sm"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p></div></article>)}
          </section>
          {data.kpis.totalFunnels === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">No Funnel records were found for the selected filters and date range.</div> : null}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Funnel Creation Trend" subtitle="Current period compared with the previous equivalent period">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-3 text-xs"><span className="text-indigo-600">● Current period</span><span className="text-teal-600">● Previous period</span></div>
                <div className="flex gap-1">{(['daily', 'weekly', 'monthly'] as const).map((value) => <button key={value} type="button" onClick={() => setGranularity(value)} className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${granularity === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{value}</button>)}</div>
              </div>
              {data.trend.length ? <div className="h-64">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[210px] w-full overflow-visible">
                  {[0, 25, 50, 75, 100].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />)}
                  <polyline points={previousPoints} fill="none" stroke="#14B8A6" strokeWidth="1.4" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                  <polyline points={currentPoints} fill="none" stroke="#4F46E5" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="flex justify-between gap-2 text-[10px] text-slate-500">{data.trend.map((item, index) => (index === 0 || index === data.trend.length - 1 || index % Math.ceil(data.trend.length / 6) === 0) ? <span key={item.label} className="truncate">{item.label}</span> : null)}</div>
              </div> : <Empty>No funnel creation records are available for this period.</Empty>}
            </Panel>
            <Panel title="Funnel Stage Conversion" subtitle="Stage counts and share, based on actual CRM statuses">
              {data.stages.length ? <div className="space-y-4">
                <BarRows rows={data.stages as unknown as Array<Record<string, string | number | null>>} label="stage" value="count" color="bg-violet-500" />
                <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 text-[11px] uppercase text-slate-500"><tr><th className="py-2">Stage</th><th>Count</th><th>Stage share</th><th>Drop-off</th><th>Revenue</th><th>Margin</th><th>Avg. days</th></tr></thead>
                  <tbody>{data.stages.map((row) => <tr key={row.stage} className="border-b border-slate-100"><td className="py-2 font-medium text-slate-800">{row.stage}</td><td>{count(row.count)}</td><td>{count(row.conversionPercent)}%</td><td title="Stage exit history is not available">—</td><td>{money(row.revenue)}</td><td>{money(row.margin)}</td><td>{count(row.averageDaysInStage)}</td></tr>)}</tbody>
                </table><p className="mt-2 text-[11px] text-slate-500">Stage drop-off cannot be calculated from current CRM history.</p></div>
              </div> : <Empty>No stage data is available for the selected filters.</Empty>}
            </Panel>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Panel title="Stage-wise Revenue"><p className="mb-4 text-2xl font-semibold text-slate-900">{money(data.kpis.totalRevenue)}</p><BarRows rows={data.revenueByStage as unknown as Array<Record<string, string | number | null>>} label="stage" value="revenue" format={money} color="bg-sky-500" /></Panel>
            <Panel title="Stage-wise Margin"><p className="mb-4 text-2xl font-semibold text-slate-900">{money(data.kpis.totalMargin)}</p><BarRows rows={data.stages as unknown as Array<Record<string, string | number | null>>} label="stage" value="margin" format={money} color="bg-emerald-500" /></Panel>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Revenue by Funnel Stage" subtitle="Actual revenue amounts, formatted in Indian currency"><BarRows rows={data.revenueByStage as unknown as Array<Record<string, string | number | null>>} label="stage" value="revenue" format={money} color="bg-cyan-500" /></Panel>
            <Panel title="SBU-wise Analytics" subtitle="Funnel count and recorded revenue by SBU">{data.sbuAnalytics.length ? <div className="space-y-4">{data.sbuAnalytics.map((row) => <div key={row.sbu} className="grid grid-cols-[minmax(80px,130px)_minmax(60px,1fr)_auto_auto] items-center gap-2 text-xs"><span className="truncate font-medium text-slate-700">{row.sbu}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, row.count / Math.max(1, ...data.sbuAnalytics.map((item) => item.count)) * 100)}%` }} /></div><span>{count(row.count)} funnels</span><span>{money(row.revenue)}</span></div>)}</div> : <Empty>No SBU values are recorded.</Empty>}</Panel>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Top Customers by Funnel Value" subtitle="Top 10 customers ranked by recorded funnel revenue"><BarRows rows={data.topCustomers as unknown as Array<Record<string, string | number | null>>} label="customer" value="revenue" format={money} color="bg-emerald-500" /></Panel>
            <Panel title="Top Products by Funnel Count" subtitle="Top 10 products ranked by distinct funnel count">{data.topProducts.length ? <div className="space-y-3">{data.topProducts.map((row) => <div key={row.product} className="grid grid-cols-[minmax(90px,130px)_minmax(50px,1fr)_auto] items-center gap-2 text-xs"><span className="truncate font-medium text-slate-700" title={row.product}>{row.product}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(3, row.funnelCount / Math.max(1, ...data.topProducts.map((item) => item.funnelCount)) * 100)}%` }} /></div><span>{count(row.funnelCount)} · {money(row.revenue)} · {money(row.margin)}</span></div>)}</div> : <Empty>No product funnel records are available.</Empty>}</Panel>
          </section>

          <Panel title="Top Sales Representatives Leaderboard" subtitle="Ranked by total recorded funnel revenue, then deal count">
            {data.leaderboard.length ? <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm text-slate-600"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="py-3">Rank</th><th>Sales Representative</th><th>Deals</th><th>Funnel Revenue</th></tr></thead><tbody>{data.leaderboard.map((row) => <tr key={`${row.employeeId}-${row.employee}`} className="border-b border-slate-100"><td className="py-3 font-semibold">#{row.rank}</td><td className="font-medium text-slate-800">{row.employee}</td><td>{count(row.deals)}</td><td className="font-semibold text-slate-800">{money(row.revenue)}</td></tr>)}</tbody></table></div> : <Empty>No sales representative records are available.</Empty>}
          </Panel>
        </div>
      ) : null}
    </div>
  )
}
