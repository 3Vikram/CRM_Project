'use client'

import type { ComputedInvoice } from '@crm/shared'
import { formatDDMonYY, billingMonthLabel } from '@/lib/dates'
import { PreviewHeader } from './PreviewHeader'
import { PreviewParties } from './PreviewParties'
import { PreviewLineTable } from './PreviewLineTable'
import { PreviewTaxSummary } from './PreviewTaxSummary'

interface Props {
  invoice: ComputedInvoice | null
  draft: import('@crm/shared').InvoiceDraft
  loading?: boolean
  error?: string | null
}

/**
 * Live invoice preview rendered entirely from the `ComputedInvoice` response
 * of `POST /api/invoices/compute`. Tax/totals are never computed client-side
 * — preview data === PDF data.
 */
export function InvoicePreview({ invoice, draft, loading, error }: Props) {
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm">
        Could not compute the invoice: {error}
      </div>
    )
  }
  if (!invoice) {
    return (
      <div className="rounded-xl border border-[#E7E3DA] bg-white p-6 text-sm text-gray-500">
        {loading ? 'Computing preview…' : 'Drop the rental ledger to preview the invoice.'}
      </div>
    )
  }

  return (
    <div className="preview-root bg-white text-gray-900 rounded-xl border border-[#E7E3DA] shadow-sm px-10 py-8 max-w-[820px] mx-auto">
      <PreviewHeader invoice={invoice} draft={draft} />

      {/* Right-side meta box */}
      <div className="mt-6 flex justify-between gap-8">
        <PreviewParties invoice={invoice} draft={draft} />
        <div className="text-xs text-gray-600 min-w-[220px]">
          <Row label="Invoice No." value={draft.invoiceNo || '—'} />
          <Row label="Dated" value={formatDDMonYY(draft.invoiceDate)} />
          <Row label="Reference No. & Date." value="" />
          <Row label="Other References" value="" />
          <Row label="Buyer's Order No." value="" />
          <Row label="Dated" value="" />
          <Row label="Dispatch Doc No." value="" />
          <Row label="Delivery Note Date" value="" />
          <Row label="Dispatched through" value="" />
          <Row label="Destination" value="" />
          <Row label="Terms of Delivery" value="" />
        </div>
      </div>

      <PreviewLineTable invoice={invoice} />

      <PreviewTaxSummary invoice={invoice} draft={draft} />

      <div className="mt-12 text-[10px] text-gray-400 text-right">
        Billing month: {billingMonthLabel(draft.billingMonth)} ·
        Place of Supply: {invoice.placeOfSupply || '—'}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 border-b border-[#EFECE5] py-1">
      <span className="text-gray-700 font-medium w-40">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}