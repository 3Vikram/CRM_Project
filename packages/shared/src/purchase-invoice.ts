import { z } from 'zod'
import { CompanyIdSchema, IsoDateSchema } from './accounting.js'

export const TaxModeSchema = z.enum(['intra', 'inter', 'none'])
export type TaxMode = z.infer<typeof TaxModeSchema>

export const PurchaseInvoiceLineInputSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  gstRate: z.number().min(0).max(100).default(0),
  ledgerId: z.string().uuid(),
})
export type PurchaseInvoiceLineInput = z.infer<typeof PurchaseInvoiceLineInputSchema>

export const CreatePurchaseInvoiceSchema = z.object({
  companyId: CompanyIdSchema,
  number: z.string().min(1).max(100),
  vendor: z.string().min(1).max(200),
  vendorGstin: z.string().max(20).optional(),
  vendorInvoiceNumber: z.string().min(1).max(100),
  invoiceDate: IsoDateSchema,
  dueDate: IsoDateSchema.optional(),
  taxMode: TaxModeSchema,
  notes: z.string().max(2000).default(''),
  lines: z.array(PurchaseInvoiceLineInputSchema).min(1),
})
export type CreatePurchaseInvoice = z.infer<typeof CreatePurchaseInvoiceSchema>

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Shared taxable/GST/total math for a purchase invoice, used by both the UI preview and the server posting engine. */
export function purchaseInvoiceTotals(lines: Pick<PurchaseInvoiceLineInput, 'quantity' | 'rate' | 'gstRate'>[], taxMode: TaxMode) {
  const taxable = lines.reduce((sum, line) => sum + (line.quantity || 0) * (line.rate || 0), 0)
  const gst = lines.reduce((sum, line) => sum + ((line.quantity || 0) * (line.rate || 0) * (line.gstRate || 0)) / 100, 0)
  return {
    taxable: round2(taxable),
    cgst: taxMode === 'intra' ? round2(gst / 2) : 0,
    sgst: taxMode === 'intra' ? round2(gst / 2) : 0,
    igst: taxMode === 'inter' ? round2(gst) : 0,
    gst: taxMode === 'none' ? 0 : round2(gst),
    total: round2(taxable + (taxMode === 'none' ? 0 : gst)),
  }
}

export const CreateBankPaymentSchema = z.object({
  companyId: CompanyIdSchema,
  number: z.string().min(1).max(100),
  paymentDate: IsoDateSchema,
  payee: z.string().min(1).max(200),
  bankLedgerId: z.string().uuid(),
  categoryLedgerId: z.string().uuid().optional(),
  linkedPurchaseInvoiceId: z.string().uuid().optional(),
  mode: z.string().max(50).default(''),
  reference: z.string().max(200).default(''),
  amount: z.number().positive(),
  narration: z.string().max(2000).default(''),
}).refine((v) => Boolean(v.categoryLedgerId) || Boolean(v.linkedPurchaseInvoiceId), {
  message: 'A bank payment needs either a category ledger or a linked purchase invoice',
  path: ['categoryLedgerId'],
})
export type CreateBankPayment = z.infer<typeof CreateBankPaymentSchema>
