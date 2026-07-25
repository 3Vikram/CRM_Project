'use client'

import type { ComputedInvoice } from '@crm/shared'
import { formatDDMonYY, billingMonthLabel } from '@/lib/dates'
import { PreviewHeader } from './PreviewHeader'
import { PreviewParties } from './PreviewParties'
import { PreviewLineTable } from './PreviewLineTable'
import { PreviewTaxSummary } from './PreviewTaxSummary'
import { PreviewFooter } from './PreviewFooter'

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
        <div className="text-xs text-gray-600 min-w-[240px]">
          <Row label="Invoice No." value={draft.invoiceNo || '—'} />
          <Row label="Dated" value={formatDDMonYY(draft.invoiceDate)} />
          {draft.toggles.dispatchDetails && (
            <>
              <Row label="Reference No. & Date." value={refNoAndDate(draft)} />
              <Row label="Other References" value={draft.dispatchDetails?.otherReferences ?? ''} />
            </>
          )}
          {draft.toggles.buyersOrder && (
            <>
              <Row label="Buyer's Order No." value={draft.buyersOrder?.orderNo ?? ''} />
              <Row label="Dated" value={formatDDMonYY(draft.buyersOrder?.orderDate ?? '')} />
            </>
          )}
          {draft.toggles.dispatchDetails && (
            <>
              <Row label="Dispatch Doc No." value={draft.dispatchDetails?.dispatchDocNo ?? ''} />
              <Row label="Delivery Note Date" value={formatDDMonYY(draft.dispatchDetails?.deliveryNoteDate ?? '')} />
              <Row label="Dispatched through" value={draft.dispatchDetails?.dispatchedThrough ?? ''} />
              <Row label="Destination" value={draft.dispatchDetails?.destination ?? ''} />
              <Row label="Terms of Delivery" value={draft.dispatchDetails?.termsOfDelivery ?? ''} />
            </>
          )}
        </div>
      </div>

      <PreviewLineTable invoice={invoice} />

      {invoice.mixedCompany && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          <div className="font-semibold">{invoice.mixedCompanyWarning}</div>
          {invoice.companyBreakdown && (
            <div className="mt-1 text-xs">
              {invoice.companyBreakdown.map((c) => `${c.company}: ${c.count}`).join(' · ')}
            </div>
          )}
          Computation is blocked until the rows are split into separate invoices.
        </div>
      )}

      {!invoice.mixedCompany && (
        <div className="preview-summary-block">
          <PreviewTaxSummary invoice={invoice} draft={draft} />
          <PreviewFooter invoice={invoice} draft={draft} />
        </div>
      )}

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

/** Combine Reference No. + Date into Reference No. &Date row value. */
function refNoAndDate(draft: import('@crm/shared').InvoiceDraft): string {
  const d = draft.dispatchDetails
  if (!d) return ''
  const refNo = d.referenceNo ?? ''
  const refDate = d.referenceDate ? formatDDMonYY(d.referenceDate) : ''
  return `${refNo}${refDate ? '  ' + refDate : ''}`.trim()
}