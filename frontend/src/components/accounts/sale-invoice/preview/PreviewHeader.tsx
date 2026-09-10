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
    <header className="invoice-header">
      <div className="invoice-kind">Tax Invoice</div>
      <div className="invoice-seller-name">{s.legalName}</div>
      <address className="invoice-address">
        {s.address}
      </address>
      <div className="invoice-seller-detail">
        State Name: {s.stateName} Code: {s.stateCode}
      </div>
      <div className="invoice-seller-detail">GSTIN/UIN: {s.gstin}</div>
      {s.pan && <div className="invoice-seller-detail">Company's PAN: {s.pan}</div>}
      <div className="invoice-seller-detail invoice-contact">
        E-Mail: {s.email}{s.contact ? ` · Contact: ${s.contact}` : ''}
      </div>
      {s.msme && <div className="invoice-seller-detail">MSME: {s.msme}</div>}
      {draft.toggles.eInvoice && draft.eInvoice?.irn && (
        <div className="invoice-einvoice">
          <div className="font-semibold">e-Invoice</div>
          <div>IRN: {draft.eInvoice.irn}</div>
          {draft.eInvoice.ackNo && <div>Ack No.: {draft.eInvoice.ackNo}</div>}
          {draft.eInvoice.ackDate && <div>Ack Date: {draft.eInvoice.ackDate}</div>}
        </div>
      )}
    </header>
  )
}
