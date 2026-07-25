'use client'

import type { LineItem } from '@crm/shared'
import { Trash2, Layers, List, Calculator } from 'lucide-react'
import { formatDDMonYY } from '@/lib/dates'
import {
  groupIdentical,
  flattenLines,
  prorateReturned,
} from '@/lib/groupLines'

interface Props {
  rows: LineItem[]
  onChange: (rows: LineItem[]) => void
  /** Invoice-level prorate rate and billing-month start, used by the action. */
  returnedBillingRate: number
  billingMonthFrom: string
  /** When on, a Disc column appears (off by default). */
  showDiscount: boolean
  /** Whether rows are currently in grouped form. */
  grouped: boolean
  onToggleGrouped: (v: boolean) => void
}

/**
 * Flat-ish editable review table with the line-level actions:
 *  - "Group identical" / "Flat" toggle (grouping key = make+model+price,
 *    configuration excluded; returned rows never absorbed).
 *  - Per-row "Returned → prorate" action using the invoice-level rate.
 *  - Optional Disc column (toggle).
 *  - Editable Amount + remove.
 */
export function LineItemsTable({
  rows,
  onChange,
  returnedBillingRate,
  billingMonthFrom,
  showDiscount,
  grouped,
  onToggleGrouped,
}: Props) {
  const update = (idx: number, patch: Partial<LineItem>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx))

  const doGroup = () => {
    if (grouped) {
      onChange(flattenLines(rows))
      onToggleGrouped(false)
    } else {
      onChange(groupIdentical(rows))
      onToggleGrouped(true)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">
          {rows.length} row{rows.length === 1 ? '' : 's'}
          {grouped ? ' · grouped' : ' · flat'}
        </div>
        <button
          type="button"
          onClick={doGroup}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {grouped ? <List className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
          {grouped ? 'Flat rows' : 'Group identical'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E7E3DA] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F5F2] text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-2 py-2 text-left">SL</th>
              <th className="px-2 py-2 text-left">Make / Model</th>
              <th className="px-2 py-2 text-left">Serial</th>
              <th className="px-2 py-2 text-left">Configuration</th>
              <th className="px-2 py-2 text-right">Price</th>
              <th className="px-2 py-2 text-center">Returned</th>
              <th className="px-2 py-2 text-right">Amount</th>
              {showDiscount && <th className="px-2 py-2 text-right">Disc</th>}
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.rowRef}-${i}`}
                className={`border-t border-[#EFECE5] ${
                  r.isReturned ? 'bg-amber-50/40' : ''
                }`}
              >
                <td className="px-2 py-2 text-gray-500">
                  {r.quantity > 1 ? `${r.quantity}×` : r.rowRef}
                </td>
                <td className="px-2 py-2">
                  <div className="font-medium">{r.make}</div>
                  <div className="text-gray-500 text-xs">{r.model}</div>
                </td>
                <td className="px-2 py-2 font-mono text-xs">
                  {Array.isArray(r.serial) ? r.serial.join(' / ') : r.serial}
                </td>
                <td className="px-2 py-2 text-gray-600 max-w-[220px] truncate" title={r.configuration}>
                  {r.configuration}
                </td>
                <td className="px-2 py-2 text-right">{r.price.toFixed(2)}</td>
                <td className="px-2 py-2 text-center">
                  {r.isReturned ? (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      {r.to ? formatDDMonYY(r.to) : 'yes'}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={r.amount}
                    onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })}
                    className="w-24 text-right px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </td>
                {showDiscount && (
                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={r.discount ?? 0}
                      onChange={(e) =>
                        update(i, {
                          discount: Number(e.target.value) || 0,
                        })
                      }
                      className="w-20 text-right px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </td>
                )}
                <td className="px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {r.isReturned && (
                      <button
                        type="button"
                        title="Returned → prorate"
                        onClick={() =>
                          update(i, prorateReturned(r, { returnedBillingRate, billingMonthFrom }))
                        }
                        className="text-gray-400 hover:text-amber-700"
                      >
                        <Calculator className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label="Remove row"
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showDiscount ? 9 : 8} className="px-2 py-6 text-center text-gray-400">
                  No rows yet — drop the ledger .xlsx above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}