import { z } from 'zod'
import { PartySchema } from './contact'
import { BankDetailsSchema } from './entity'

/** A single line after apply-time compute (taxable value, tax lines). */
export const ComputedLineSchema = z.object({
  rowRef: z.number(),
  description: z.string(),
  hsn: z.string(),
  quantity: z.number(),
  rate: z.number(),
  /** Per-line taxable value = (amount − discount). */
  taxableValue: z.number(),
  amount: z.number(),
  discount: z.number().optional(),
  /** Stacked detail lines beneath a grouped line (serial/config/from-to). */
  subLines: z
    .array(
      z.object({
        serial: z.string().optional(),
        configuration: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        isReturned: z.boolean().optional(),
      }),
    )
    .optional(),
  isReturned: z.boolean(),
})

export const TaxBreakdownLineSchema = z.object({
  label: z.string(),
  rate: z.number(),
  amount: z.number(),
})

export const ComputedInvoiceSchema = z.object({
  seller: z.object({
    id: z.string(),
    name: z.string(),
    legalName: z.string(),
    address: z.string(),
    stateName: z.string(),
    stateCode: z.string(),
    gstin: z.string(),
    pan: z.string(),
    email: z.string(),
    contact: z.string(),
    msme: z.string().optional(),
    cin: z.string().optional(),
    bank: BankDetailsSchema.optional(),
    declaration: z.string().optional(),
    terms: z.string().optional(),
    remarksTemplate: z.string().optional(),
    invoicePrefix: z.string().optional(),
  }),
  buyer: PartySchema,
  consignee: PartySchema,
  hsn: z.string(),
  lines: z.array(ComputedLineSchema),
  /** Sum of per-line taxable values. */
  taxableTotal: z.number(),
  cgst: TaxBreakdownLineSchema.optional(),
  sgst: TaxBreakdownLineSchema.optional(),
  igst: TaxBreakdownLineSchema.optional(),
  totalTax: z.number(),
  /** Grand total before round-off (taxableTotal + totalTax). */
  grandTotal: z.number(),
  /** Round-off line carrying the signed difference, present when roundOff=true. */
  roundOff: z
    .object({
      difference: z.number(),
      label: z.string(),
    })
    .optional(),
  /** Grand total after round-off (== grandTotal when roundOff off). */
  roundedGrandTotal: z.number(),
  amountInWords: z.string(),
  taxInWords: z.string(),
  placeOfSupply: z.string(),
  taxType: z.enum(['CGST_SGST', 'IGST', 'NONE']),
  /** When true, the dropped rows mixed companies and compute is blocked. */
  mixedCompany: z.boolean().optional(),
  mixedCompanyWarning: z.string().optional(),
  /** Companies detected in the dropped rows, with counts. */
  companyBreakdown: z
    .array(z.object({ company: z.string(), count: z.number() }))
    .optional(),
})

export type ComputedInvoice = z.infer<typeof ComputedInvoiceSchema>
export type ComputedLine = z.infer<typeof ComputedLineSchema>