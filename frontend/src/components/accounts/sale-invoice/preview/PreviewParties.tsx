'use client'

import type { ComputedInvoice, InvoiceDraft } from '@crm/shared'

export function PreviewParties({
  invoice,
  draft,
}: {
  invoice: ComputedInvoice
  draft: InvoiceDraft
}) {
  const consignee = invoice.consignee
  return (
    <div className="flex-1 space-y-6">
      <Block title="Buyer (Bill to)" party={invoice.buyer} />
      {!draft.shippingSameAsBilling && consignee && (
        <Block title="Consignee (Ship to)" party={consignee} />
      )}
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
    </div>
  )
}