'use client'

import type { ComputedInvoice, InvoiceDraft } from '@crm/shared'

export function PreviewTaxSummary({
  invoice,
  draft,
}: {
  invoice: ComputedInvoice
  draft: InvoiceDraft
}) {
  return (
    <div className="mt-4">
      {/* Tax lines */}
      <div className="flex justify-end text-xs">
        <div className="w-64">
          {invoice.cgst && (
            <TaxRow label={invoice.cgst.label} rate={invoice.cgst.rate} amount={invoice.cgst.amount} />
          )}
          {invoice.sgst && (
            <TaxRow label={invoice.sgst.label} rate={invoice.sgst.rate} amount={invoice.sgst.amount} />
          )}
          {invoice.igst && (
            <TaxRow label={invoice.igst.label} rate={invoice.igst.rate} amount={invoice.igst.amount} />
          )}
        </div>
      </div>

      {/* Total + round-off + words */}
      <div className="flex justify-end text-sm mt-3 border-t border-gray-300 pt-2">
        <div className="w-64">
          <div className="flex justify-between border-b border-[#EFECE5] py-1">
            <span className="font-medium">Total</span>
            <span className="font-semibold">
              {invoice.lines.reduce((a, l) => a + l.quantity, 0)} Pcs ·{' '}
              {invoice.grandTotal.toFixed(2)}
            </span>
          </div>
          {invoice.roundOff && (
            <div className="flex justify-between border-b border-[#EFECE5] py-1 text-xs text-gray-700">
              <span>{invoice.roundOff.label}</span>
              <span>{Math.abs(invoice.roundOff.difference).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-[#EFECE5] py-1">
            <span className="font-medium">Round-off {draft.roundOff ? 'on' : 'off'}</span>
            <span className="font-semibold">{invoice.roundedGrandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-700">
        <div>
          <span className="font-semibold">Amount Chargeable (in words):</span>{' '}
          {invoice.amountInWords}
        </div>
        {draft.gstApplicable && (
          <div>
            <span className="font-semibold">Tax Amount (in words):</span>{' '}
            {invoice.taxInWords}
          </div>
        )}
      </div>
    </div>
  )
}

function TaxRow({
  label,
  rate,
  amount,
}: {
  label: string
  rate: number
  amount: number
}) {
  return (
    <div className="flex justify-between border-b border-[#EFECE5] py-1">
      <span className="text-gray-700">
        {label} {rate}%
      </span>
      <span className="text-gray-900">{amount.toFixed(2)}</span>
    </div>
  )
}