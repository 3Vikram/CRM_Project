'use client'

import type { ComputedInvoice, InvoiceDraft } from '@crm/shared'

/**
 * Footer block (amount-in-words, bank block, full-page signature row,
 * remarks / declaration / terms). Reads from the compute response's
 * `resolvedFooter` (seller-preset-backed) and respects the show/hide toggles
 * — when a toggle is off, the field is absent in `resolvedFooter`.
 */
export function PreviewFooter({
  invoice,
  draft,
}: {
  invoice: ComputedInvoice
  draft: InvoiceDraft
}) {
  const f = invoice.resolvedFooter
  return (
    <div className="mt-6 text-xs">
      <div className="border-t border-b border-gray-300 py-2 flex gap-4">
        <span className="font-semibold text-gray-700 whitespace-nowrap">
          Amount Chargeable (in words):
        </span>
        <span className="text-gray-900">{invoice.amountInWords}</span>
      </div>

      {f?.bank && (
        <div className="mt-6 border border-gray-200 rounded p-3 space-y-0.5">
          <div className="font-semibold text-gray-700 mb-1">Bank Details</div>
          <div>Bank Name: {f.bank.bankName}</div>
          <div>A/c No: {f.bank.accountNo}</div>
          <div>Branch: {f.bank.branch}</div>
          <div>IFSC: {f.bank.ifsc}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-12 mt-10">
        <div className="text-center text-[10px] text-gray-500">
          <div className="border-t border-gray-400 pt-0.5 mx-12">Receiver's Signature</div>
        </div>
        <div className="text-center text-[10px] text-gray-500">
          <div className="h-12" />
          <div className="font-semibold text-gray-900 text-xs">
            for {invoice.seller.name}
          </div>
          <div className="mt-6">Authorised Signatory</div>
        </div>
      </div>

      {f?.remarks && (
        <div className="mt-8 border-t border-gray-200 pt-2 leading-relaxed">
          <span className="font-semibold text-gray-700">Remarks: </span>
          <span>{f.remarks}</span>
        </div>
      )}
      {f?.declaration && (
        <div className="mt-2 leading-relaxed text-gray-700">
          <span className="font-semibold">Declaration: </span>
          {f.declaration}
        </div>
      )}
      {f?.terms && (
        <div className="mt-4">
          <div className="font-semibold text-gray-700 mb-1">Terms &amp; Conditions</div>
          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{f.terms}</pre>
        </div>
      )}

      <div className="mt-3 text-[10px] text-gray-500">
        This is a Computer Generated Invoice
      </div>
    </div>
  )
}