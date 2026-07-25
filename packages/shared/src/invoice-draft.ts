import { z } from 'zod'
import { LineItemSchema } from './line-item'
import { PartySchema } from './contact'
import { TaxType } from './tax'

export const TaxTypeSchema = z.enum(['CGST_SGST', 'IGST', 'NONE'])

export const BillingMonthSchema = z.object({
  from: z.string(),
  to: z.string(),
})

export const TogglesSchema = z.object({
  eInvoice: z.boolean(),
  buyersOrder: z.boolean(),
  dispatchDetails: z.boolean(),
  lineDiscount: z.boolean(),
  showRemarks: z.boolean(),
  showDeclaration: z.boolean(),
  showTc: z.boolean(),
  showBank: z.boolean(),
})

export const FooterSchema = z.object({
  remarks: z.string().optional(),
  declaration: z.string().optional(),
  terms: z.string().optional(),
  bank: z
    .object({
      holderName: z.string(),
      bankName: z.string(),
      accountNo: z.string(),
      branch: z.string(),
      ifsc: z.string(),
    })
    .optional(),
})

export const EInvoiceSchema = z.object({
  irn: z.string().optional(),
  ackNo: z.string().optional(),
  ackDate: z.string().optional(),
})

export const DispatchDetailsSchema = z.object({
  deliveryNote: z.string().optional(),
  deliveryNoteDate: z.string().optional(),
  dispatchDocNo: z.string().optional(),
  dispatchedThrough: z.string().optional(),
  destination: z.string().optional(),
  referenceNo: z.string().optional(),
  referenceDate: z.string().optional(),
  otherReferences: z.string().optional(),
  termsOfDelivery: z.string().optional(),
})

export const BuyersOrderSchema = z.object({
  orderNo: z.string().optional(),
  orderDate: z.string().optional(),
})

/**
 * The compute request: everything an operator edits on the Sale Invoice
 * screen. Validated by the shared zod schema on both sides.
 */
export const InvoiceDraftSchema = z.object({
  sellerId: z.string(),
  buyer: PartySchema,
  shippingSameAsBilling: z.boolean(),
  consignee: PartySchema.optional(),
  hsn: z.string(),
  gstApplicable: z.boolean(),
  gstRate: z.number(),
  taxType: TaxTypeSchema,
  roundOff: z.boolean(),
  returnedBillingRate: z.number(),
  invoiceNo: z.string(),
  invoiceDate: z.string(),
  billingMonth: BillingMonthSchema,
  lines: z.array(LineItemSchema),
  toggles: TogglesSchema,
  footer: FooterSchema,
  eInvoice: EInvoiceSchema.optional(),
  buyersOrder: BuyersOrderSchema.optional(),
  dispatchDetails: DispatchDetailsSchema.optional(),
})

export type InvoiceDraft = z.infer<typeof InvoiceDraftSchema>
export type TaxTypeValue = TaxType
export type { TaxType }