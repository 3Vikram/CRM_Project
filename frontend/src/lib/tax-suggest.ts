import type { Entity, InvoiceDraft, TaxType } from '@crm/shared'

/**
 * Mirror of the backend `suggestTaxType` so the frontend can pre-fill the
 * Tax-type toggle on the spot (without waiting for a compute round-trip) on
 * the buyer-state change. The final word lives in the backend compute
 * (`suggestedTaxType` on the response); the served ex-post value wins when
 * the two disagree (e.g. seller state code shipped after the buyer touched).
 */
export function suggestTaxTypeFor(
  seller: Entity | undefined,
  buyer: InvoiceDraft['buyer'],
  gstApplicable: boolean,
): TaxType {
  const s = seller?.stateCode
  const b = buyer.stateCode
  if (!gstApplicable) return 'NONE'
  if (!s || !b) return 'CGST_SGST'
  return s === b ? 'CGST_SGST' : 'IGST'
}