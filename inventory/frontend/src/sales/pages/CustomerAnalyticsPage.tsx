import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarDays, Users } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchCustomerAnalytics, type CustomerAnalytics } from '@/sales/lib/customerApi'

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const defaultStartDate = () => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() - 11)
  return dateKey(date)
}
const defaultEndDate = () => dateKey(new Date())
const numberFormat = new Intl.NumberFormat('en-IN')
const currencyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const STATUS_COLORS = ['#10B981', '#F59E0B']
const CONVERSION_COLORS = ['#6366F1', '#CBD5E1']

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

function Comparison({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-slate-500">No prior-period baseline</span>
  const increase = value >= 0
  return (
    <span className={`text-xs font-medium ${increase ? 'text-emerald-700' : 'text-rose-700'}`}>
      {increase ? '+' : ''}{value.toFixed(1)}% vs previous period
    </span>
  )
}

function LoadingDashboard() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading customer analytics" aria-live="polite">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="h-[110px] animate-pulse rounded-xl border border-[#EFECE5] bg-white p-4">
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="mt-5 h-7 w-1/2 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export default function CustomerAnalyticsPage() {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [data, setData] = useState<CustomerAnalytics>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!startDate || !endDate) {
        setData(undefined)
        setError('Select both a start date and an end date.')
        setLoading(false)
        return
      }
      if (startDate > endDate) {
        setData(undefined)
        setError('Start Date must be on or before End Date.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const result = await fetchCustomerAnalytics({ startDate, endDate })
        if (active) setData(result)
      } catch (cause) {
        if (active) {
          setData(undefined)
          setError(cause instanceof Error ? cause.message : 'Unable to load customer analytics.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [startDate, endDate])

  const totalWithStatus = data ? data.kpis.activeCustomers + data.kpis.inactiveCustomers : 0
  const activePercent = totalWithStatus
    ? (data!.kpis.activeCustomers / totalWithStatus) * 100
    : 0
  const hasCustomers = Boolean(data?.kpis.totalCustomers)
  const hasRevenue = Boolean(data?.charts.topCustomers.length)
  const conversionData = data ? [
    { name: 'Converted Leads', value: data.charts.conversionOverview.convertedLeads },
    { name: 'Direct Customers', value: data.charts.conversionOverview.directCustomers },
  ] : []

  return (
    <div className="min-h-full space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/sales/customers')}
            aria-label="Back to customers"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EFECE5] bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="crm-page-heading">Customer Analytics Dashboard</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Start Date
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            End Date
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </label>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? <LoadingDashboard /> : data ? (
        <>
          <section aria-label="Customer analytics summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="min-w-0 rounded-xl border border-[#EFECE5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Users className="h-4 w-4 text-blue-600" /> Total Customers
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{numberFormat.format(data.kpis.totalCustomers)}</p>
              <div className="mt-1"><Comparison value={data.kpis.totalChangePercent} /></div>
            </article>

            <article className="min-w-0 rounded-xl border border-[#EFECE5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Building2 className="h-4 w-4 text-violet-600" /> Sector with Most Customers
              </div>
              {data.kpis.leadingSector ? (
                <>
                  <p className="mt-3 truncate text-lg font-semibold text-slate-900" title={data.kpis.leadingSector.name}>{data.kpis.leadingSector.name}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{numberFormat.format(data.kpis.leadingSector.count)} customers</span>
                    <Comparison value={data.kpis.leadingSector.changePercent} />
                  </div>
                </>
              ) : <p className="mt-3 text-sm text-slate-500">Data not available</p>}
            </article>

            <article className="min-w-0 rounded-xl border border-[#EFECE5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <CalendarDays className="h-4 w-4 text-emerald-600" /> Industry Highest Revenue
              </div>
              {data.kpis.leadingIndustryRevenue ? (
                <>
                  <p className="mt-3 truncate text-lg font-semibold text-slate-900" title={data.kpis.leadingIndustryRevenue.industry}>{data.kpis.leadingIndustryRevenue.industry}</p>
                  <p className="mt-1 text-sm font-medium text-emerald-700">{currencyFormat.format(data.kpis.leadingIndustryRevenue.revenue)}</p>
                </>
              ) : <p className="mt-3 text-sm text-slate-500">Revenue data not available</p>}
            </article>

            <article className="min-w-0 rounded-xl border border-[#EFECE5] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">Active vs Inactive</span>
                <span className="text-xs font-semibold text-slate-700">{activePercent.toFixed(0)}% active</span>
              </div>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-amber-100" aria-label={`${activePercent.toFixed(0)} percent active customers`}>
                <div className="rounded-full bg-emerald-500 transition-all" style={{ width: `${activePercent}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-xs text-slate-600">
                <span>Active {numberFormat.format(data.kpis.activeCustomers)}</span>
                <span>Inactive {numberFormat.format(data.kpis.inactiveCustomers)}</span>
              </div>
            </article>
          </section>

          <section aria-label="Customer analytics charts" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="Nature of Business / Sector-wise Split" subtitle="Customer count by recorded industry">
              {data.charts.sectorDistribution.length ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.sectorDistribution} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="industry" width={116} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [numberFormat.format(Number(value || 0)), 'Customers']} />
                      <Bar dataKey="count" name="Customers" fill="#6366F1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No industry or nature-of-business records are available in this period.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Top Customers Performance" subtitle={data.charts.marginAvailable ? 'Revenue and recorded margin percentage' : 'Revenue from linked OPF records'}>
              {hasRevenue ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.charts.topCustomers} margin={{ top: 6, right: 10, bottom: 35, left: 6 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="customer" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={64} />
                      <YAxis yAxisId="revenue" tick={{ fontSize: 10 }} tickFormatter={(value) => numberFormat.format(Number(value))} width={54} />
                      {data.charts.marginAvailable ? <YAxis yAxisId="margin" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}%`} width={42} /> : null}
                      <Tooltip formatter={(value, name) => name === 'Margin'
                        ? [`${Number(value || 0).toFixed(1)}%`, name]
                        : [currencyFormat.format(Number(value || 0)), name]} />
                      <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      {data.charts.marginAvailable ? <Line yAxisId="margin" type="monotone" dataKey="marginPercent" name="Margin" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} /> : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No customer-linked revenue records are available in this period.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Customer Growth Trend" subtitle="Monthly customer registrations in the selected date range">
              {hasCustomers ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.charts.growthTrend} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={12} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                      <Tooltip formatter={(value) => [numberFormat.format(Number(value || 0)), 'New customers']} />
                      <Line type="monotone" dataKey="customers" name="New Customers" stroke="#0EA5E9" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No customers were registered in the selected date range.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Customer Status Distribution" subtitle="Active and inactive customers registered in this period">
              {hasCustomers ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.charts.statusDistribution} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={96} label={({ name, value, percent }) => `${name}: ${numberFormat.format(Number(value || 0))} (${((percent || 0) * 100).toFixed(1)}%)`}>
                        {data.charts.statusDistribution.map((item, index) => <Cell key={item.status} fill={STATUS_COLORS[index]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No customer status records are available in this period.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Conversion Overview" subtitle="Customers linked to converted leads versus direct customer records">
              {hasCustomers ? (
                <>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={conversionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={94} label={({ name, value, percent }) => `${name}: ${numberFormat.format(Number(value || 0))} (${((percent || 0) * 100).toFixed(1)}%)`}>
                          {conversionData.map((item, index) => <Cell key={item.name} fill={CONVERSION_COLORS[index]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => numberFormat.format(Number(value || 0))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-center text-xs text-slate-500">
                    Activity-to-customer conversion is not separately linked in the CRM data.
                  </p>
                </>
              ) : <EmptyChart>No customers are available for conversion analysis in this period.</EmptyChart>}
            </ChartCard>

            <ChartCard title="Lead Acquisition Channels" subtitle="Sources recorded on leads linked to customers in this period">
              {data.charts.leadAcquisitionSources.length ? (
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.leadAcquisitionSources} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="source" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                      <Tooltip formatter={(value) => [numberFormat.format(Number(value || 0)), 'Customers']} />
                      <Bar dataKey="count" name="Customers" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart>No linked lead-source records are available in this period.</EmptyChart>}
            </ChartCard>
          </section>
        </>
      ) : null}
    </div>
  )
}
