'use client'

import type { ComputedInvoice, InvoiceDraft } from '@crm/shared'

/**
 * Two-block party layout matching the reference PDFs: "Consignee (Ship to)"
 * on the left and "Buyer (Bill to)" on the right. When
 * `shippingSameAsBilling` is on, the Consignee block mirrors the buyer.
 */
export function PreviewParties({
  invoice,
  draft,
}: {
  invoice: ComputedInvoice
  draft: InvoiceDraft
}) {
  const buyer = invoice.buyer
  const consignee = draft.shippingSameAsBilling ? buyer : (invoice.consignee ?? buyer)
  return (
    <div className="invoice-parties">
      <Block title="Consignee (Ship to)" party={consignee} />
      <Block title="Buyer (Bill to)" party={buyer} />
    </div>
  )
}

function Block({
  title,
  party,
}: {
  title: string
  party: NonNullable<ComputedInvoice['buyer']>
}) {
  return (
    <div className="invoice-party-block">
      <div className="invoice-party-title">{title}</div>
      {party.name ? (
        <>
          <div className="invoice-party-name">{party.name}</div>
          <div className="invoice-party-address">{party.address}</div>
          {party.stateName && (
            <div className="invoice-party-detail">
              State Name: {party.stateName} Code: {party.stateCode}
            </div>
          )}
          {party.gstin && (
            <div className="invoice-party-detail">GSTIN/UIN: {party.gstin}</div>
          )}
        </>
      ) : (
        <div className="invoice-party-detail">—</div>
      )}
    </div>
  )
}
