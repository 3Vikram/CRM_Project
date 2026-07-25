'use client'

import type { ComputedInvoice } from '@crm/shared'

export function PreviewLineTable({
  invoice,
}: {
  invoice: ComputedInvoice
}) {
  return (
    <table className="w-full text-xs mt-8 border-collapse">
      <thead>
        <tr className="text-left text-gray-600 border-y border-gray-300">
          <th className="py-1.5 px-2 w-10">Sl No.</th>
          <th className="py-1.5 px-2">Description of Services</th>
          <th className="py-1.5 px-2 text-center">HSN/SAC</th>
          <th className="py-1.5 px-2 text-right">Quantity</th>
          <th className="py-1.5 px-2 text-right">Rate</th>
          <th className="py-1.5 px-2 text-right">per</th>
          <th className="py-1.5 px-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {invoice.lines.map((l, i) => (
          <tr key={l.rowRef} className="align-top border-b border-[#EFECE5]">
            <td className="py-2 px-2">{i + 1}</td>
            <td className="py-2 px-2 whitespace-pre-line">
              <div className="font-semibold text-gray-900">{l.description}</div>
              {l.subLines && l.subLines.length > 0 && (
                <div className="mt-1 space-y-0.5 text-gray-700">
                  {l.subLines.map((s, j) => (
                    <div key={j} className="leading-relaxed">
                      {s.configuration && <div>{s.configuration}</div>}
                      <div className="font-mono">
                        S/N: {s.serial}
                        {s.isReturned && (
                          <span className="ml-2 text-amber-700">
                            (Returned Billing{' '}
                            {s.from && s.to ? `${s.from}→${s.to}` : ''})
                          </span>
                        )}
                      </div>
                      {s.from && s.to && (
                        <div className="text-gray-500">
                          From {fmt(s.from)} to {fmt(s.to)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {l.isReturned && !l.subLines?.length && (
                <div className="text-amber-700 mt-0.5">
                  (Returned Billing){l.from && l.to ? ` ${l.from}→${l.to}` : ''}
                </div>
              )}
            </td>
            <td className="py-2 px-2 text-center">{l.hsn}</td>
            <td className="py-2 px-2 text-right">{l.quantity} Pcs</td>
            <td className="py-2 px-2 text-right">{l.rate.toFixed(2)}</td>
            <td className="py-2 px-2 text-right">Pcs</td>
            <td className="py-2 px-2 text-right">{l.amount.toFixed(2)}</td>
          </tr>
        ))}
        {invoice.lines.length === 0 && (
          <tr>
            <td colSpan={7} className="py-4 text-center text-gray-400">
              No line items.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function fmt(iso: string) {
  return iso
}