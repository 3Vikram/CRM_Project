'use client'

import type { ComputedInvoice, InvoiceDraft } from '@crm/shared'

export function PreviewHeader({
  invoice,
  draft,
}: {
  invoice: ComputedInvoice
  draft: InvoiceDraft
}) {
  const s = invoice.seller
  return (
    <header className="border-b border-[#EFECE5] pb-6">
      <div className="font-serif font-bold text-lg text-gray-900">{s.legalName}</div>
      <address className="not-italic text-sm text-gray-700 mt-1 leading-relaxed">
        {s.address}
      </address>
      <div className="text-xs text-gray-600 mt-1">
        State Name: {s.stateName} Code: {s.stateCode}
      </div>
      <div className="text-xs text-gray-600">GSTIN/UIN: {s.gstin}</div>
      {s.pan && <div className="text-xs text-gray-600">Company's PAN: {s.pan}</div>}
      <div className="text-xs text-gray-600 mt-1">
        E-Mail: {s.email}{s.contact ? ` · Contact: ${s.contact}` : ''}
      </div>
      {s.msme && <div className="text-xs text-gray-500 mt-1">MSME: {s.msme}</div>}
      {draft.toggles.eInvoice && draft.eInvoice?.irn && (
        <div className="mt-3 text-xs border border-dashed border-gray-300 rounded p-2">
          <div className="font-semibold">e-Invoice</div>
          <div>IRN: {draft.eInvoice.irn}</div>
          {draft.eInvoice.ackNo && <div>Ack No.: {draft.eInvoice.ackNo}</div>}
          {draft.eInvoice.ackDate && <div>Ack Date: {draft.eInvoice.ackDate}</div>}
        </div>
      )}
    </header>
  )
}