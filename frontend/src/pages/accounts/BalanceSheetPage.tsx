import { useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useAccounting } from '@/components/accounts/accounting-context'
import { balanceSheet, exportCsv, ledgerEntries, money, today, type BalanceSheetRow } from '@/lib/accounting'

const input = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm'
const button = 'inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700'

export default function BalanceSheetPage() {
  const { companyName, data } = useAccounting()
  const [asOf, setAsOf] = useState(today())
  const [compareTo, setCompareTo] = useState('')
  const [drilldown, setDrilldown] = useState<BalanceSheetRow | null>(null)
  const current = useMemo(() => balanceSheet(data, asOf), [data, asOf])
  const previous = useMemo(() => compareTo ? balanceSheet(data, compareTo) : null, [data, compareTo])
  const previousAmounts = new Map(previous?.rows.map((row) => [row.account, row.amount]))
  if (previous) previousAmounts.set('Current-year profit / (loss)', previous.currentYearProfit)
  const groups = [
    { title: 'Non-current assets', nature: 'Asset' as const, classification: 'Non-current' as const },
    { title: 'Current assets', nature: 'Asset' as const, classification: 'Current' as const },
    { title: 'Equity', nature: 'Equity' as const, classification: 'Equity' as const },
    { title: 'Non-current liabilities', nature: 'Liability' as const, classification: 'Non-current' as const },
    { title: 'Current liabilities', nature: 'Liability' as const, classification: 'Current' as const },
  ]
  const csvRows = groups.flatMap((group) => {
    const rows = current.rows.filter((row) => row.nature === group.nature && row.classification === group.classification)
    if (group.title === 'Equity') rows.push({ account: 'Current-year profit / (loss)', nature: 'Equity', classification: 'Equity', amount: current.currentYearProfit })
    return rows.map((row) => [group.title, row.account, row.amount, previousAmounts.get(row.account) ?? 0])
  })

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900">Balance Sheet</h1>
        <p className="mt-1 text-sm text-gray-600">{companyName} · derived from posted accounting entries.</p>
      </div>
      <button className={button} onClick={() => exportCsv('balance-sheet.csv', ['Section', 'Account', `As at ${asOf}`, compareTo ? `As at ${compareTo}` : 'Previous'], csvRows)}><Download className="w-4"/>Export CSV</button>
    </div>

    <div className="grid gap-3 rounded-lg border border-[#EFECE5] bg-white p-4 md:grid-cols-3">
      <label className="text-sm font-medium text-gray-700">As at<input type="date" className={`mt-1 ${input}`} value={asOf} onChange={(event) => setAsOf(event.target.value || today())}/></label>
      <label className="text-sm font-medium text-gray-700">Compare with (optional)<input type="date" className={`mt-1 ${input}`} value={compareTo} max={asOf} onChange={(event) => setCompareTo(event.target.value)}/></label>
      <div className={`rounded-md px-3 py-2 text-sm font-medium ${current.balanced ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
        <div className="text-xs uppercase tracking-wide opacity-70">Books check</div>
        {current.balanced ? 'Assets = liabilities + equity' : `Difference: ${money(current.totalAssets - current.totalLiabilities - current.totalEquity)}`}
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <StatementColumn title="Assets" total={current.totalAssets} previousTotal={previous?.totalAssets} groups={groups.filter((group) => group.nature === 'Asset')} sheet={current} previousAmounts={previousAmounts} onDrilldown={setDrilldown}/>
      <StatementColumn title="Equity & liabilities" total={current.totalLiabilities + current.totalEquity} previousTotal={previous ? previous.totalLiabilities + previous.totalEquity : undefined} groups={groups.filter((group) => group.nature !== 'Asset')} sheet={current} previousAmounts={previousAmounts} onDrilldown={setDrilldown}/>
    </div>

    {!current.rows.length && <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">No posted balance-sheet entries exist for this date. Post opening balances or accounting vouchers to populate this statement.</div>}
    {drilldown && (
      <LedgerDrilldown account={drilldown.account} asOf={asOf} onClose={() => setDrilldown(null)}/>
    )}
  </div>
}

function StatementColumn({ title, total, previousTotal, groups, sheet, previousAmounts, onDrilldown }: { title: string; total: number; previousTotal?: number; groups: Array<{ title: string; nature: BalanceSheetRow['nature']; classification: BalanceSheetRow['classification'] }>; sheet: ReturnType<typeof balanceSheet>; previousAmounts: Map<string, number>; onDrilldown: (row: BalanceSheetRow) => void }) {
  return <section className="overflow-hidden rounded-lg border border-[#EFECE5] bg-white">
    <div className="border-b border-[#EFECE5] bg-[#F7F5F0] px-5 py-4"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl font-bold text-gray-900">{title}</h2><span className="font-semibold">{money(total)}</span></div></div>
    <div className="overflow-auto"><table className="min-w-full text-sm"><thead className="border-b border-[#EFECE5] text-left text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Particulars</th><th className="px-5 py-3 text-right">{sheet.asOf}</th>{previousTotal !== undefined && <th className="px-5 py-3 text-right">Previous</th>}</tr></thead><tbody>{groups.map((group) => <GroupRows key={group.title} group={group} sheet={sheet} previousAmounts={previousAmounts} showPrevious={previousTotal !== undefined} onDrilldown={onDrilldown}/>)}</tbody><tfoot className="border-t-2 border-gray-300 bg-[#F7F5F0] font-semibold"><tr><td className="px-5 py-3">Total {title}</td><td className="px-5 py-3 text-right">{money(total)}</td>{previousTotal !== undefined && <td className="px-5 py-3 text-right">{money(previousTotal)}</td>}</tr></tfoot></table></div>
  </section>
}

function GroupRows({ group, sheet, previousAmounts, showPrevious, onDrilldown }: { group: { title: string; nature: BalanceSheetRow['nature']; classification: BalanceSheetRow['classification'] }; sheet: ReturnType<typeof balanceSheet>; previousAmounts: Map<string, number>; showPrevious: boolean; onDrilldown: (row: BalanceSheetRow) => void }) {
  const rows = sheet.rows.filter((row) => row.nature === group.nature && row.classification === group.classification)
  if (group.classification === 'Equity') rows.push({ account: 'Current-year profit / (loss)', nature: 'Equity', classification: 'Equity', amount: sheet.currentYearProfit })
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  if (!rows.length) return null
  return <><tr className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500"><td className="px-5 py-2" colSpan={showPrevious ? 3 : 2}>{group.title}</td></tr>{rows.map((row) => <tr className="border-t border-gray-100" key={row.account}><td className="px-5 py-2.5">{row.account === 'Current-year profit / (loss)' ? row.account : <button className="text-left text-gray-900 underline decoration-dotted underline-offset-4 hover:text-blue-700" onClick={() => onDrilldown(row)}>{row.account}</button>}</td><td className="px-5 py-2.5 text-right tabular-nums">{money(row.amount)}</td>{showPrevious && <td className="px-5 py-2.5 text-right tabular-nums">{money(previousAmounts.get(row.account) ?? 0)}</td>}</tr>)}<tr className="border-t border-gray-200 font-medium"><td className="px-5 py-2.5">Total {group.title}</td><td className="px-5 py-2.5 text-right">{money(total)}</td>{showPrevious && <td className="px-5 py-2.5 text-right">{money(rows.reduce((sum, row) => sum + (previousAmounts.get(row.account) ?? 0), 0))}</td>}</tr></>
}

function LedgerDrilldown({ account, asOf, onClose }: { account: string; asOf: string; onClose: () => void }) {
  const { data } = useAccounting()
  const rows = ledgerEntries(data).filter((row) => row.account === account && row.date <= asOf)
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/30 p-4"><div className="mx-auto my-8 max-w-5xl rounded-lg bg-white p-6 shadow-xl"><button aria-label="Close" onClick={onClose} className="float-right"><X className="h-5 w-5"/></button><h2 className="text-2xl font-serif font-bold">{account} ledger</h2><p className="mt-1 text-sm text-gray-600">Posted entries through {asOf}</p><div className="mt-5 overflow-auto rounded-lg border border-[#EFECE5]"><table className="min-w-full text-left text-sm"><thead className="bg-[#F7F5F0] text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Narration</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr></thead><tbody>{rows.map((row, index) => <tr className="border-t border-gray-100" key={`${row.reference}-${index}`}><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2">{row.source}</td><td className="px-3 py-2">{row.reference}</td><td className="px-3 py-2">{row.narration || '—'}</td><td className="px-3 py-2 text-right">{money(row.debit)}</td><td className="px-3 py-2 text-right">{money(row.credit)}</td></tr>)}</tbody></table></div>{!rows.length && <p className="mt-4 text-sm text-gray-600">No posted entries found.</p>}</div></div>
}
