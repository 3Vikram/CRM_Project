import { z } from 'zod'

/** Bank details attached to a seller legal-entity preset. */
export const BankDetailsSchema = z.object({
  holderName: z.string(),
  bankName: z.string(),
  accountNo: z.string(),
  branch: z.string(),
  ifsc: z.string(),
})
export type BankDetails = z.infer<typeof BankDetailsSchema>

/**
 * Seller legal-entity preset (source of truth for the invoice header,
 * footer defaults, bank block, and the suggested invoice-number prefix).
 *
 * Served by `GET /api/entities` from the backend config layer.
 */
export const EntitySchema = z.object({
  id: z.string(),
  /** Short display label, e.g. "3Vikram Technologies". */
  name: z.string(),
  /** Seller short-code used in remarks, e.g. "3VIKRAM" or "KVAS". */
  shortName: z.string(),
  /** Full legal-name line present on existing invoices, e.g. "3Vikram Technologies - 2025-26". */
  legalName: z.string(),
  address: z.string(),
  /** Two-letter-ish state code as printed, e.g. "29" for Karnataka. */
  stateCode: z.string(),
  stateName: z.string(),
  gstin: z.string(),
  pan: z.string(),
  email: z.string(),
  contact: z.string(),
  msme: z.string().optional(),
  cin: z.string().optional(),
  /** Invoice-number prefix, e.g. "3VT/" or "SISPL/". */
  invoicePrefix: z.string(),
  /** e-Invoice block default flag (on for 3Vikram, off for SYNOV). */
  eInvoiceDefault: z.boolean(),
  bank: BankDetailsSchema,
  declaration: z.string(),
  terms: z.string(),
  /** Remarks template, e.g. "Being Rental Invoice Raised for the Month of {month} ({seller})". */
  remarksTemplate: z.string(),
})
export type Entity = z.infer<typeof EntitySchema>