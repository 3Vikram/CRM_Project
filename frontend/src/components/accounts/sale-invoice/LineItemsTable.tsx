'use client'

import type { LineItem } from '@crm/shared'
import { Trash2 } from 'lucide-react'

interface Props {
  rows: LineItem[]
  onChange: (rows: LineItem[]) => void
}

/**
 * Flat editable review table — one row per laptop. `MONTHS` (when present) is
 * shown for audit context only; PERSON / COURIER / CONTACT NO are never
 * rendered (privacy). Each row's `Amount` defaults to one month and is
 * editable; rows can be removed for returned / non-billable units.
 */
export function LineItemsTable({ rows, onChange }: Props) {
  const update = (idx: number, patch: Partial<LineItem>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    onChange(next)
  }
  const remove = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx))
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E7E3DA] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[#F7F5F2] text-gray-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">SL</th>
            <th className="px-3 py-2 text-left">Make</th>
            <th className="px-3 py-2 text-left">Model</th>
            <th className="px-3 py-2 text-left">Serial</th>
            <th className="px-3 py-2 text-left">Configuration</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Months</th>
            <th className="px-3 py-2 text-left">Returned</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2"></th>
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
              <td className="px-3 py-2 text-gray-500">{r.rowRef}</td>
              <td className="px-3 py-2">{r.make}</td>
              <td className="px-3 py-2">{r.model}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.serial}</td>
              <td className="px-3 py-2 text-gray-600 max-w-[280px] truncate" title={r.configuration}>
                {r.configuration}
              </td>
              <td className="px-3 py-2 text-right">{r.price.toFixed(2)}</td>
              <td className="px-3 py-2 text-right text-gray-500">
                {r.months ?? '—'}
              </td>
              <td className="px-3 py-2">
                {r.isReturned ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    returned{r.to ? ` ${r.to}` : ''}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  value={r.amount}
                  onChange={(e) =>
                    update(i, { amount: Number(e.target.value) || 0 })
                  }
                  className="w-24 text-right px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Remove row"
                  className="text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                No rows yet — drop the ledger .xlsx above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}