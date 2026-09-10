'use client'

import { useState } from 'react'
import type { LineItem } from '@crm/shared'
import { Trash2, Layers, List, Calculator, Pencil } from 'lucide-react'
import { formatDDMonYY } from '@/lib/dates'
import { groupIdentical, flattenLines, prorateReturned } from '@/lib/groupLines'

interface Props {
  rows: LineItem[]
  onChange: (rows: LineItem[]) => void
  returnedBillingRate: number
  billingMonthFrom: string
  showDiscount: boolean
  grouped: boolean
  onToggleGrouped: (v: boolean) => void
}

/** Editable invoice review: configuration groups retain independently editable
 * serial records, including returned rows and their part-billing amounts. */
export function LineItemsTable({ rows, onChange, returnedBillingRate, billingMonthFrom, showDiscount, grouped, onToggleGrouped }: Props) {
  const [editingRef, setEditingRef] = useState<number | null>(null)
  const flatRows = () => flattenLines(rows)
  const saveFlat = (next: LineItem[]) => onChange(grouped ? groupIdentical(next) : next)
  const update = (rowRef: number, patch: Partial<LineItem>) => saveFlat(flatRows().map(r => r.rowRef === rowRef ? { ...r, ...patch } : r))
  const remove = (rowRef: number) => saveFlat(flatRows().filter(r => r.rowRef !== rowRef))
  const editing = editingRef == null ? undefined : flatRows().find(r => r.rowRef === editingRef)
  const doGroup = () => {
    if (grouped) { onChange(flatRows()); onToggleGrouped(false) }
    else { onChange(groupIdentical(rows)); onToggleGrouped(true) }
  }

  return <div>
    <div className="mb-2 flex items-center justify-between">
      <div className="text-xs text-gray-500">{flatRows().length} serial{flatRows().length === 1 ? '' : 's'} · {grouped ? `${rows.length} configuration${rows.length === 1 ? '' : 's'}` : 'flat'}</div>
      <button type="button" onClick={doGroup} disabled={!rows.length} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        {grouped ? <List className="h-3.5 w-3.5"/> : <Layers className="h-3.5 w-3.5"/>}{grouped ? 'Flat rows' : 'Group by configuration'}
      </button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-[#E7E3DA] bg-white">
      <table className="w-full text-sm"><thead className="bg-[#F7F5F2] text-xs uppercase tracking-wide text-gray-600"><tr>
        <th className="px-2 py-2 text-left">SL</th><th className="px-2 py-2 text-left">Make / Model</th><th className="px-2 py-2 text-left">Serial number(s)</th><th className="px-2 py-2 text-left">Configuration</th><th className="px-2 py-2 text-right">Price</th><th className="px-2 py-2 text-center">Returned</th><th className="px-2 py-2 text-right">Amount</th>{showDiscount && <th className="px-2 py-2 text-right">Disc</th>}<th className="px-2 py-2"/>
      </tr></thead><tbody>{rows.map((row, index) => {
        const members = row.members?.length ? row.members : [{ rowRef: row.rowRef, serial: String(row.serial), configuration: row.configuration, price: row.price, amount: row.amount, discount: row.discount, from: row.from, to: row.to, isReturned: row.isReturned }]
        return <tr key={`${row.rowRef}-${index}`} className="align-top border-t border-[#EFECE5]">
          <td className="px-2 py-2 text-gray-500">{grouped ? `${row.quantity}×` : row.rowRef}</td>
          <td className="px-2 py-2"><div className="font-medium">{row.make}</div><div className="text-xs text-gray-500">{row.model}</div></td>
          <td className="px-2 py-2 font-mono text-xs">{members.map(m => <div key={m.rowRef} className="mb-1 flex items-center gap-1 whitespace-nowrap"><span>{m.serial}</span><button type="button" title="Edit this serial" onClick={() => setEditingRef(m.rowRef)} className="text-gray-400 hover:text-gray-900"><Pencil className="h-3.5 w-3.5"/></button></div>)}</td>
          <td className="max-w-[260px] px-2 py-2 text-gray-600"><div className="flex gap-1"><span className="truncate" title={row.configuration}>{row.configuration}</span>{!grouped && <button type="button" title="Edit item" onClick={() => setEditingRef(row.rowRef)} className="text-gray-400 hover:text-gray-900"><Pencil className="h-3.5 w-3.5"/></button>}</div></td>
          <td className="px-2 py-2 text-right">{row.price.toFixed(2)}</td>
          <td className="px-2 py-2 text-center">{members.some(m => m.isReturned) ? <div className="space-y-1">{members.filter(m => m.isReturned).map(m => <div key={m.rowRef} className="rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{m.to ? formatDDMonYY(m.to) : 'yes'}</div>)}</div> : <span className="text-gray-300">—</span>}</td>
          <td className="px-2 py-2 text-right">{grouped ? row.amount.toFixed(2) : <input type="number" step="0.01" value={row.amount} onChange={e => update(row.rowRef, { amount: Number(e.target.value) || 0 })} className="w-24 rounded border border-gray-200 px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-gray-300"/>}</td>
          {showDiscount && <td className="px-2 py-2 text-right">{grouped ? (row.discount ?? 0).toFixed(2) : <input type="number" step="0.01" value={row.discount ?? 0} onChange={e => update(row.rowRef, { discount: Number(e.target.value) || 0 })} className="w-20 rounded border border-gray-200 px-2 py-1 text-right"/>}</td>}
          <td className="px-2 py-2 text-right">{!grouped && <div className="flex justify-end gap-1">{row.isReturned && <button type="button" title="Calculate returned part billing" onClick={() => update(row.rowRef, prorateReturned(row, { returnedBillingRate, billingMonthFrom }))} className="text-gray-400 hover:text-amber-700"><Calculator className="h-4 w-4"/></button>}<button type="button" onClick={() => remove(row.rowRef)} aria-label="Remove row" className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4"/></button></div>}</td>
        </tr>
      })}{!rows.length && <tr><td colSpan={showDiscount ? 9 : 8} className="px-2 py-6 text-center text-gray-400">No rows yet — drop the ledger .xlsx above.</td></tr>}</tbody></table>
    </div>
    {editing && (
      <ItemEditor row={editing} showDiscount={showDiscount} billingMonthFrom={billingMonthFrom} returnedBillingRate={returnedBillingRate} onClose={() => setEditingRef(null)} onSave={next => { update(editing.rowRef, next); setEditingRef(null) }}/>
    )}
  </div>
}

function ItemEditor({ row, showDiscount, billingMonthFrom, returnedBillingRate, onClose, onSave }: { row: LineItem; showDiscount: boolean; billingMonthFrom: string; returnedBillingRate: number; onClose: () => void; onSave: (patch: Partial<LineItem>) => void }) {
  const [value, setValue] = useState(row)
  const set = <K extends keyof LineItem>(key: K, next: LineItem[K]) => setValue(v => ({ ...v, [key]: next }))
  const partBill = () => setValue(prorateReturned({ ...value, isReturned: true }, { returnedBillingRate, billingMonthFrom }))
  const input = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm'
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/30 p-4"><div className="mx-auto my-8 max-w-2xl rounded-lg bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Edit invoice item</h2><button type="button" onClick={onClose} className="text-sm text-gray-500">Cancel</button></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
    <Field label="Make"><input className={input} value={value.make} onChange={e => set('make', e.target.value)}/></Field><Field label="Model"><input className={input} value={value.model} onChange={e => set('model', e.target.value)}/></Field><Field label="Serial number"><input className={input} value={String(value.serial)} onChange={e => set('serial', e.target.value)}/></Field><Field label="Monthly price"><input type="number" className={input} value={value.price} onChange={e => set('price', Number(e.target.value) || 0)}/></Field><Field label="Configuration"><input className={input} value={value.configuration} onChange={e => set('configuration', e.target.value)}/></Field><Field label="Billing amount"><input type="number" step="0.01" className={input} value={value.amount} onChange={e => set('amount', Number(e.target.value) || 0)}/></Field>
    {showDiscount && <Field label="Discount"><input type="number" step="0.01" className={input} value={value.discount ?? 0} onChange={e => set('discount', Number(e.target.value) || 0)}/></Field>}
    <Field label="Billing from"><input type="date" className={input} value={value.from ?? ''} onChange={e => set('from', e.target.value || undefined)}/></Field><Field label="Returned / billing to"><input type="date" className={input} value={value.to ?? ''} onChange={e => set('to', e.target.value || undefined)}/></Field>
  </div><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={value.isReturned} onChange={e => set('isReturned', e.target.checked)}/> Returned item — use part billing</label>{value.isReturned && <button type="button" onClick={partBill} className="mt-3 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-amber-800"><Calculator className="h-4 w-4"/>Calculate part billing at ₹{returnedBillingRate}/month</button>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-2 text-sm">Cancel</button><button type="button" onClick={() => onSave(value)} className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Save item</button></div>
  </div></div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-gray-700">{label}{children}</label> }
