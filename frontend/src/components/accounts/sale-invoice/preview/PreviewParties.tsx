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
    <div className="grid grid-cols-2 gap-x-8">
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
    <div>
      <div className="font-serif font-bold text-sm text-gray-900">{title}</div>
      {party.name ? (
        <>
          <div className="text-sm text-gray-800 mt-0.5">{party.name}</div>
          <div className="text-sm text-gray-700 whitespace-pre-line">{party.address}</div>
          {party.stateName && (
            <div className="text-xs text-gray-600 mt-1">
              State Name: {party.stateName} Code: {party.stateCode}
            </div>
          )}
          {party.gstin && (
            <div className="text-xs text-gray-600">GSTIN/UIN: {party.gstin}</div>
          )}
        </>
      ) : (
        <div className="text-xs text-gray-400 mt-1">—</div>
      )}
    </div>
  )
}