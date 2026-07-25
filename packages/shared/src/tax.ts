/**
 * Tax treatment for an invoice.
 * - `CGST_SGST` — intra-state; the GST rate is split into two equal halves.
 * - `IGST` — inter-state; the full GST rate is charged as a single line.
 * - `NONE` — GST not applicable (gstApplicable=false).
 */
export type TaxType = 'CGST_SGST' | 'IGST' | 'NONE'

export const TAX_TYPES: readonly TaxType[] = ['CGST_SGST', 'IGST', 'NONE'] as const