import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { useAccounting } from '@/components/accounts/accounting-context'
import { exportCsv, money, today } from '@/lib/accounting'
import { useBalanceSheet, useLedgerReport, type BalanceSheetRow, type BalanceSheetSnapshot } from '@/lib/queries/accounting'

const input = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm'
const button = 'inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700'

type Group = { title: string; nature: BalanceSheetRow['nature']; classification: 'current' | 'non_current' | 'equity' }
const GROUPS: Group[] = [
  { title: 'Non-current assets', nature: 'asset', classification: 'non_current' },
  { title: 'Current assets', nature: 'asset', classification: 'current' },
  { title: 'Equity', nature: 'equity', classification: 'equity' },
  { title: 'Non-current liabilities', nature: 'liability', classification: 'non_current' },
  { title: 'Current liabilities', nature: 'liability', classification: 'current' },
]
function rowsForGroup(rows: BalanceSheetRow[], group: Group) {
  return group.classification === 'equity'
    ? rows.filter((row) => row.nature === 'equity')
    : rows.filter((row) => row.nature === group.nature && row.currentClassification === group.classification)
}

export default function BalanceSheetPage() {
  const { companyId, companyName } = useAccounting()
  const [asOf, setAsOf] = useState(today())
  const [compareTo, setCompareTo] = useState('')
  const [drilldown, setDrilldown] = useState<BalanceSheetRow | null>(null)
  const { data: sheet, isLoading } = useBalanceSheet(companyId, asOf, compareTo || undefined)
  const current = sheet?.current
  const previous = sheet?.previous ?? null
  const previousAmounts = new Map(previous?.rows.map((row) => [row.ledgerId, Number(row.amount)]))
  if (previous) previousAmounts.set('current-year-profit', Number(previous.currentYearProfit))

  const csvRows = current ? GROUPS.flatMap((group) => {
    const rows = rowsForGroup(current.rows, group)
    const withProfit = group.title === 'Equity' ? [...rows, { ledgerId: 'current-year-profit', code: '', name: 'Current-year profit / (loss)', nature: 'equity' as const, currentClassification: 'not_applicable', scheduleIIIMap: null, amount: current.currentYearProfit }] : rows
    return withProfit.map((row) => [group.title, row.name, row.amount, previousAmounts.get(row.ledgerId) ?? 0])
  }) : []

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900">Balance Sheet</h1>
        <p className="mt-1 text-sm text-gray-600">{companyName} · derived from posted accounting entries.</p>
      </div>
      <button className={button} disabled={!csvRows.length} onClick={() => exportCsv('balance-sheet.csv', ['Section', 'Account', `As at ${asOf}`, compareTo ? `As at ${compareTo}` : 'Previous'], csvRows)}><Download className="w-4"/>Export CSV</button>
    </div>

    <div className="grid gap-3 rounded-lg border border-[#EFECE5] bg-white p-4 md:grid-cols-3">
      <label className="text-sm font-medium text-gray-700">As at<input type="date" className={`mt-1 ${input}`} value={asOf} onChange={(event) => setAsOf(event.target.value || today())}/></label>
      <label className="text-sm font-medium text-gray-700">Compare with (optional)<input type="date" className={`mt-1 ${input}`} value={compareTo} max={asOf} onChange={(event) => setCompareTo(event.target.value)}/></label>
      {current && (
        <div className={`rounded-md px-3 py-2 text-sm font-medium ${current.totals.balanced ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          <div className="text-xs uppercase tracking-wide opacity-70">Books check</div>
          {current.totals.balanced ? 'Assets = liabilities + equity' : `Difference: ${money(Number(current.totals.assets) - Number(current.totals.liabilities) - Number(current.totals.equity))}`}
        </div>
      )}
    </div>

    {isLoading && <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">Loading balance sheet…</div>}
    {current && (
      <div className="grid gap-5 xl:grid-cols-2">
        <StatementColumn title="Assets" total={Number(current.totals.assets)} previousTotal={previous ? Number(previous.totals.assets) : undefined} groups={GROUPS.filter((group) => group.nature === 'asset')} sheet={current} previousAmounts={previousAmounts} onDrilldown={setDrilldown}/>
        <StatementColumn title="Equity & liabilities" total={Number(current.totals.liabilities) + Number(current.totals.equity)} previousTotal={previous ? Number(previous.totals.liabilities) + Number(previous.totals.equity) : undefined} groups={GROUPS.filter((group) => group.nature !== 'asset')} sheet={current} previousAmounts={previousAmounts} onDrilldown={setDrilldown}/>
      </div>
    )}

    {current && !current.rows.length && <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">No posted balance-sheet entries exist for this date. Post opening balances or accounting vouchers to populate this statement.</div>}
    {drilldown && (
      <LedgerDrilldown ledgerId={drilldown.ledgerId} name={drilldown.name} asOf={asOf} onClose={() => setDrilldown(null)}/>
    )}
  </div>
}

function StatementColumn({ title, total, previousTotal, groups, sheet, previousAmounts, onDrilldown }: { title: string; total: number; previousTotal?: number; groups: Group[]; sheet: BalanceSheetSnapshot; previousAmounts: Map<string, number>; onDrilldown: (row: BalanceSheetRow) => void }) {
  return <section className="overflow-hidden rounded-lg border border-[#EFECE5] bg-white">
    <div className="border-b border-[#EFECE5] bg-[#F7F5F0] px-5 py-4"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl font-bold text-gray-900">{title}</h2><span className="font-semibold">{money(total)}</span></div></div>
    <div className="overflow-auto"><table className="min-w-full text-sm"><thead className="border-b border-[#EFECE5] text-left text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Particulars</th><th className="px-5 py-3 text-right">{sheet.asOf}</th>{previousTotal !== undefined && <th className="px-5 py-3 text-right">Previous</th>}</tr></thead><tbody>{groups.map((group) => <GroupRows key={group.title} group={group} sheet={sheet} previousAmounts={previousAmounts} showPrevious={previousTotal !== undefined} onDrilldown={onDrilldown}/>)}</tbody><tfoot className="border-t-2 border-gray-300 bg-[#F7F5F0] font-semibold"><tr><td className="px-5 py-3">Total {title}</td><td className="px-5 py-3 text-right">{money(total)}</td>{previousTotal !== undefined && <td className="px-5 py-3 text-right">{money(previousTotal)}</td>}</tr></tfoot></table></div>
  </section>
}

function GroupRows({ group, sheet, previousAmounts, showPrevious, onDrilldown }: { group: Group; sheet: BalanceSheetSnapshot; previousAmounts: Map<string, number>; showPrevious: boolean; onDrilldown: (row: BalanceSheetRow) => void }) {
  const baseRows = rowsForGroup(sheet.rows, group)
  const rows = group.classification === 'equity'
    ? [...baseRows, { ledgerId: 'current-year-profit', code: '', name: 'Current-year profit / (loss)', nature: 'equity' as const, currentClassification: 'not_applicable', scheduleIIIMap: null, amount: sheet.currentYearProfit }]
    : baseRows
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0)
  if (!rows.length) return null
  return <><tr className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500"><td className="px-5 py-2" colSpan={showPrevious ? 3 : 2}>{group.title}</td></tr>{rows.map((row) => <tr className="border-t border-gray-100" key={row.ledgerId}><td className="px-5 py-2.5">{row.ledgerId === 'current-year-profit' ? row.name : <button className="text-left text-gray-900 underline decoration-dotted underline-offset-4 hover:text-blue-700" onClick={() => onDrilldown(row as BalanceSheetRow)}>{row.name}</button>}</td><td className="px-5 py-2.5 text-right tabular-nums">{money(Number(row.amount))}</td>{showPrevious && <td className="px-5 py-2.5 text-right tabular-nums">{money(previousAmounts.get(row.ledgerId) ?? 0)}</td>}</tr>)}<tr className="border-t border-gray-200 font-medium"><td className="px-5 py-2.5">Total {group.title}</td><td className="px-5 py-2.5 text-right">{money(total)}</td>{showPrevious && <td className="px-5 py-2.5 text-right">{money(rows.reduce((sum, row) => sum + (previousAmounts.get(row.ledgerId) ?? 0), 0))}</td>}</tr></>
}

function LedgerDrilldown({ ledgerId, name, asOf, onClose }: { ledgerId: string; name: string; asOf: string; onClose: () => void }) {
  const { companyId } = useAccounting()
  const { data: report } = useLedgerReport(companyId, ledgerId, undefined, asOf)
  const rows = report?.rows ?? []
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/30 p-4"><div className="mx-auto my-8 max-w-5xl rounded-lg bg-white p-6 shadow-xl"><button aria-label="Close" onClick={onClose} className="float-right"><X className="h-5 w-5"/></button><h2 className="text-2xl font-serif font-bold">{name} ledger</h2><p className="mt-1 text-sm text-gray-600">Posted entries through {asOf}</p><div className="mt-5 overflow-auto rounded-lg border border-[#EFECE5]"><table className="min-w-full text-left text-sm"><thead className="bg-[#F7F5F0] text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Narration</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr></thead><tbody>{rows.map((row, index) => <tr className="border-t border-gray-100" key={`${row.voucherId}-${index}`}><td className="px-3 py-2">{row.voucherDate}</td><td className="px-3 py-2">{row.source}</td><td className="px-3 py-2">{row.invoiceReference || row.externalReference || row.voucherNumber}</td><td className="px-3 py-2">{row.narration || row.voucherNarration || '—'}</td><td className="px-3 py-2 text-right">{money(Number(row.debit))}</td><td className="px-3 py-2 text-right">{money(Number(row.credit))}</td></tr>)}</tbody></table></div>{!rows.length && <p className="mt-4 text-sm text-gray-600">No posted entries found.</p>}</div></div>
}
