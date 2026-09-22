import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAccounting } from '@/components/accounts/accounting-context'
import { exportCsv, money, today } from '@/lib/accounting'
import {
  useBankPayments,
  usePurchaseInvoices,
  useTrialBalance,
  type BankPayment,
  type PurchaseInvoice,
  type TrialBalanceRow,
} from '@/lib/queries/accounting'

const input =
  'mt-1.5 h-11 w-full rounded-xl border border-[#DCD7CD] bg-white px-3.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 hover:border-[#C9C2B5] focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10'
const button =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', style: 'currency', currency: 'INR', maximumFractionDigits: 1 })
const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const TABS = ['Trial Balance', 'Purchase Register', 'Bank Payment Register', 'Accounts Payable', 'Account Balances'] as const
type Tab = (typeof TABS)[number]

// --- pure aggregation helpers (exported for tests) --------------------------

export function groupByMonth(dates: { date: string; amount: number }[]) {
  const byMonth = new Map<string, number>()
  for (const { date, amount } of dates) {
    const key = date.slice(0, 7) // YYYY-MM, avoids Date() timezone shifts
    byMonth.set(key, (byMonth.get(key) ?? 0) + amount)
  }
  return byMonth
}

export function monthlyCashFlow(purchases: PurchaseInvoice[], payments: BankPayment[], asOf: string) {
  const months: string[] = []
  const end = new Date(`${asOf}T00:00:00`)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const purchaseByMonth = groupByMonth(purchases.map((p) => ({ date: p.invoiceDate, amount: p.totals.total })))
  const paidByMonth = groupByMonth(payments.map((p) => ({ date: p.paymentDate, amount: Number(p.amount) })))
  return months.map((m) => ({
    month: new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    purchases: purchaseByMonth.get(m) ?? 0,
    payments: paidByMonth.get(m) ?? 0,
  }))
}

const AGING_BUCKETS = ['Not due', '0-30 days', '31-60 days', '61-90 days', '90+ days'] as const
export function agingBuckets(purchases: PurchaseInvoice[], asOf: string) {
  const buckets = new Map<string, number>(AGING_BUCKETS.map((b) => [b, 0]))
  const asOfMs = Date.parse(asOf)
  for (const p of purchases) {
    if (p.outstanding <= 0) continue
    const dueMs = Date.parse(p.dueDate ?? p.invoiceDate)
    const daysOverdue = Math.floor((asOfMs - dueMs) / 86_400_000)
    const bucket =
      daysOverdue <= 0 ? 'Not due'
        : daysOverdue <= 30 ? '0-30 days'
        : daysOverdue <= 60 ? '31-60 days'
        : daysOverdue <= 90 ? '61-90 days'
        : '90+ days'
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + p.outstanding)
  }
  return AGING_BUCKETS.map((bucket) => ({ bucket, amount: buckets.get(bucket) ?? 0 }))
}

export function topN<T>(items: T[], keyOf: (item: T) => string, amountOf: (item: T) => number, n: number) {
  const totals = new Map<string, number>()
  for (const item of items) totals.set(keyOf(item), (totals.get(keyOf(item)) ?? 0) + amountOf(item))
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, n)
  const others = sorted.slice(n).reduce((s, [, v]) => s + v, 0)
  return others > 0 ? [...top, ['Others', others] as const] : top
}

export default function ReportsPage() {
  const { companyId } = useAccounting()
  const [tab, setTab] = useState<Tab>('Trial Balance')
  const [asOf, setAsOf] = useState(today())
  const { data: tb } = useTrialBalance(companyId, asOf)
  const { data: invoices } = usePurchaseInvoices(companyId)
  const { data: payments } = useBankPayments(companyId)

  const purchases = useMemo(() => (invoices ?? []).filter((i) => i.status === 'posted' && i.invoiceDate <= asOf), [invoices, asOf])
  const pays = useMemo(() => (payments ?? []).filter((p) => p.status === 'posted' && p.paymentDate <= asOf), [payments, asOf])
  const tbRows = tb?.rows ?? []

  // KPIs
  const totalPurchases = purchases.reduce((s, p) => s + p.totals.total, 0)
  const paidOut = pays.reduce((s, p) => s + Number(p.amount), 0)
  const pendingClearance = pays.filter((p) => p.clearance === 'Pending').length
  const outstandingPayables = purchases.reduce((s, p) => s + p.outstanding, 0)
  const overdueCount = purchases.filter((p) => p.outstanding > 0 && Date.parse(p.dueDate ?? p.invoiceDate) < Date.parse(asOf)).length
  const tbDiff = Number(tb?.totals.debit ?? 0) - Number(tb?.totals.credit ?? 0)

  // charts
  const cashFlow = useMemo(() => monthlyCashFlow(purchases, pays, asOf), [purchases, pays, asOf])
  const aging = useMemo(() => agingBuckets(purchases, asOf), [purchases, asOf])
  const topVendors = useMemo(
    () => topN(purchases, (p) => p.vendor, (p) => p.totals.total, 6).map(([name, amount]) => ({ name, amount })),
    [purchases],
  )
  const accountMix = useMemo(() => {
    const totals = new Map<string, number>()
    for (const r of tbRows) totals.set(r.nature, (totals.get(r.nature) ?? 0) + Math.abs(Number(r.balance)))
    return [...totals.entries()].filter(([, v]) => v > 0).map(([nature, value]) => ({ nature, value }))
  }, [tbRows])
  const paymentModes = useMemo(
    () => topN(pays, (p) => p.mode || 'Other', (p) => Number(p.amount), 5).map(([mode, amount]) => ({ mode, amount })),
    [pays],
  )

  const headers: Record<Tab, string[]> = {
    'Trial Balance': ['Account', 'Debit', 'Credit'],
    'Purchase Register': ['Invoice', 'Vendor', 'Date', 'Due', 'Taxable', 'GST', 'Total', 'Paid', 'Outstanding'],
    'Bank Payment Register': ['Payment', 'Date', 'Payee', 'Mode', 'Reference', 'Amount', 'Clearance'],
    'Accounts Payable': ['Vendor', 'Invoice', 'Date', 'Due', 'Total', 'Paid', 'Outstanding', 'Days overdue'],
    'Account Balances': ['Account', 'Type', 'Debit', 'Credit', 'Closing'],
  }

  const csv: (string | number)[][] =
    tab === 'Trial Balance' ? tbRows.map((r) => [r.name, r.debit, r.credit])
    : tab === 'Purchase Register' ? purchases.map((r) => [r.vendorInvoiceNumber, r.vendor, r.invoiceDate, r.dueDate ?? '', r.totals.taxable, r.totals.gst, r.totals.total, r.paidAmount, r.outstanding])
    : tab === 'Bank Payment Register' ? pays.map((p) => [p.number, p.paymentDate, p.payee, p.mode, p.reference, Number(p.amount), p.clearance])
    : tab === 'Accounts Payable' ? purchases.filter((i) => i.outstanding > 0).map((r) => [r.vendor, r.vendorInvoiceNumber, r.invoiceDate, r.dueDate ?? '', r.totals.total, r.paidAmount, r.outstanding, Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(r.dueDate ?? asOf)) / 86400000))])
    : tbRows.map((r) => [r.name, r.nature, r.debit, r.credit, r.balance])

  const rowCount = csv.length
  const moneyColumns: Record<Tab, number[]> = {
    'Trial Balance': [1, 2],
    'Purchase Register': [4, 5, 6, 7, 8],
    'Bank Payment Register': [5],
    'Accounts Payable': [4, 5, 6],
    'Account Balances': [2, 3, 4],
  }
  const totalsRow = moneyColumns[tab].length
    ? headers[tab].map((_, i) => (moneyColumns[tab].includes(i) ? money(csv.reduce((s, row) => s + Number(row[i] || 0), 0)) : i === 0 ? 'Total' : ''))
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-600">Registers, balances, and statutory-ready summaries.</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-xs font-semibold text-gray-600">As of<input type="date" className={`${input} max-w-44`} value={asOf} onChange={(e) => setAsOf(e.target.value || today())} /></label>
          <button className={button} disabled={!rowCount} onClick={() => exportCsv(`${tab.replaceAll(' ', '-').toLowerCase()}.csv`, headers[tab], csv)}>
            <Download className="w-4" />Export CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Total purchases" value={money(totalPurchases)} sub={`${purchases.length} invoices`} />
        <Kpi label="Paid out" value={money(paidOut)} sub={`${pays.length} payments · ${pendingClearance} pending clearance`} />
        <Kpi label="Outstanding payables" value={money(outstandingPayables)} sub={`${overdueCount} overdue`} tone={outstandingPayables > 0 ? 'warn' : 'ok'} />
        <Kpi
          label="Trial balance"
          value={tb?.totals.balanced ? 'Balanced' : `Off by ${money(Math.abs(tbDiff))}`}
          sub={`as of ${asOf}`}
          tone={tb ? (tb.totals.balanced ? 'ok' : 'bad') : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly cash flow" description="Purchases posted vs. payments made, last 12 months.">
          {cashFlow.some((m) => m.purchases || m.payments) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cashFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => compact.format(v)} width={56} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, borderColor: '#EFECE5', fontSize: 12 }} />
                <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="payments" name="Payments" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No posted purchases or payments yet." />}
        </ChartCard>

        <ChartCard title="Payables aging" description="Outstanding purchase invoices by days overdue.">
          {aging.some((b) => b.amount > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={aging} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => compact.format(v)} />
                <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, borderColor: '#EFECE5', fontSize: 12 }} />
                <Bar dataKey="amount" name="Outstanding" radius={[0, 4, 4, 0]}>
                  {aging.map((b, i) => <Cell key={b.bucket} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No outstanding payables." />}
        </ChartCard>

        <ChartCard title="Top vendors" description="Purchase total by vendor, as of the selected date.">
          {topVendors.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topVendors} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => compact.format(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, borderColor: '#EFECE5', fontSize: 12 }} />
                <Bar dataKey="amount" name="Purchases" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No posted purchases yet." />}
        </ChartCard>

        <ChartCard title="Account mix" description="Trial balance totals grouped by account type.">
          {accountMix.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={accountMix} dataKey="value" nameKey="nature" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {accountMix.map((d, i) => <Cell key={d.nature} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, borderColor: '#EFECE5', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty text="No trial balance entries yet." />}
          {accountMix.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
              {accountMix.map((d, i) => (
                <span key={d.nature} className="inline-flex items-center gap-1.5 capitalize">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{d.nature}
                </span>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Payment modes" description="Bank payments by mode, as of the selected date.">
          {paymentModes.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={paymentModes} dataKey="amount" nameKey="mode" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {paymentModes.map((d, i) => <Cell key={d.mode} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, borderColor: '#EFECE5', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty text="No posted payments yet." />}
          {paymentModes.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
              {paymentModes.map((d, i) => (
                <span key={d.mode} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{d.mode}
                </span>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="GST paid" description="GST on posted purchase invoices, by month.">
          {cashFlow.some((m) => m.purchases) ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={useMemo(() => {
                const byMonth = groupByMonth(purchases.map((p) => ({ date: p.invoiceDate, amount: p.totals.gst })))
                return cashFlow.map((m, i) => ({ month: m.month, gst: [...byMonth.values()][i] ?? 0 }))
              }, [purchases, cashFlow])}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => compact.format(v)} width={56} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, borderColor: '#EFECE5', fontSize: 12 }} />
                <Area type="monotone" dataKey="gst" name="GST" stroke={CHART_COLORS[3]} fill={CHART_COLORS[3]} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty text="No posted purchases yet." />}
        </ChartCard>
      </div>

      <section className="rounded-2xl border border-[#E7E2D8] bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5">
        <div className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border border-[#E7E2D8] bg-[#F7F5F0] p-1">
          {TABS.map((x) => (
            <button
              key={x}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${x === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setTab(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <Table headers={headers[tab]} moneyColumns={moneyColumns[tab]} totalsRow={rowCount ? totalsRow : null}>
          <>
            {tab === 'Bank Payment Register'
              ? pays.map((p, i) => (
                  <tr key={i} className="hover:bg-[#FAF8F4]">
                    <td className="px-3 py-2.5">{p.number}</td>
                    <td className="px-3 py-2.5">{p.paymentDate}</td>
                    <td className="px-3 py-2.5">{p.payee}</td>
                    <td className="px-3 py-2.5">{p.mode}</td>
                    <td className="px-3 py-2.5">{p.reference}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(Number(p.amount))}</td>
                    <td className="px-3 py-2.5"><StatusPill value={p.clearance} /></td>
                  </tr>
                ))
              : csv.map((row, i) => (
                  <tr key={i} className="hover:bg-[#FAF8F4]">
                    {row.map((v, j) => (
                      <td key={j} className={`px-3 py-2.5 ${moneyColumns[tab].includes(j) ? 'text-right tabular-nums' : ''}`}>
                        {typeof v === 'number' ? money(v) : v}
                      </td>
                    ))}
                  </tr>
                ))}
          </>
        </Table>
        {!rowCount && <Empty text="Post accounting transactions to populate reports." />}
      </section>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-gray-900'
  return (
    <div className="rounded-2xl border border-[#E7E2D8] bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-gray-500">{sub}</div>
    </div>
  )
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E7E2D8] bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  )
}

function StatusPill({ value }: { value: string }) {
  const c = value === 'Cleared' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs ${c}`}>{value}</span>
}

function Table({ headers, children, moneyColumns, totalsRow }: { headers: string[]; children: React.ReactNode; moneyColumns: number[]; totalsRow?: string[] | null }) {
  return (
    <div className="overflow-auto rounded-lg border border-[#EFECE5] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#F7F5F0] text-xs uppercase text-gray-500">
          <tr>{headers.map((h, i) => <th className={`whitespace-nowrap px-3 py-2 ${moneyColumns.includes(i) ? 'text-right' : ''}`} key={h}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100"><>{children}</></tbody>
        {totalsRow && (
          <tfoot className="border-t-2 border-gray-200 bg-[#F7F5F0] font-semibold">
            <tr>{totalsRow.map((v, i) => <td key={i} className={`px-3 py-2.5 ${moneyColumns.includes(i) ? 'text-right tabular-nums' : ''}`}>{v}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">{text}</div>
}
