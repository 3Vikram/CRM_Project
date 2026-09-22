import { z } from 'zod'

// Mirrors the pre-migration browser localStorage shape
// (frontend/src/lib/accounting.ts's AccountingData, key `crm-accounting-data-v2:<companyId>`),
// so the one-time browser import can validate what it's uploading.

const StatusSchema = z.enum(['draft', 'posted', 'cancelled'])

const LegacyPurchaseLineSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number(),
  rate: z.number(),
  gstRate: z.number(),
  account: z.string(),
})
const LegacyPurchaseInvoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  vendor: z.string(),
  gstin: z.string().optional(),
  vendorInvoiceNumber: z.string(),
  invoiceDate: z.string(),
  dueDate: z.string().optional(),
  taxMode: z.enum(['intra', 'inter', 'none']),
  notes: z.string().optional(),
  lines: z.array(LegacyPurchaseLineSchema),
  status: StatusSchema,
})

const LegacyVoucherLineSchema = z.object({
  id: z.string(),
  account: z.string(),
  entryType: z.enum(['debit', 'credit']),
  debit: z.number(),
  credit: z.number(),
  description: z.string().optional(),
})
const LegacyVoucherSchema = z.object({
  id: z.string(),
  number: z.string(),
  invoiceNumber: z.string().optional(),
  date: z.string(),
  reference: z.string().optional(),
  narration: z.string().optional(),
  lines: z.array(LegacyVoucherLineSchema),
  status: StatusSchema,
})

const LegacyBankPaymentSchema = z.object({
  id: z.string(),
  number: z.string(),
  date: z.string(),
  payee: z.string(),
  bankAccount: z.enum(['Cash', 'Main Bank']),
  category: z.string().optional(),
  linkedInvoiceId: z.string().optional(),
  mode: z.string().optional(),
  reference: z.string().optional(),
  amount: z.number(),
  narration: z.string().optional(),
  clearance: z.enum(['Pending', 'Cleared']),
  status: StatusSchema,
})

export const LegacyAccountingDataSchema = z.object({
  companyId: z.string(),
  purchaseInvoices: z.array(LegacyPurchaseInvoiceSchema).default([]),
  vouchers: z.array(LegacyVoucherSchema).default([]),
  bankPayments: z.array(LegacyBankPaymentSchema).default([]),
})
export type LegacyAccountingData = z.infer<typeof LegacyAccountingDataSchema>
