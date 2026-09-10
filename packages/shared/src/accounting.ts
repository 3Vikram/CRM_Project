import { z } from 'zod'

export const CompanyIdSchema = z.string().min(1).max(64)
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
export const MoneySchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.\d{1,4})?$/, 'Expected a non-negative decimal amount')

export const AccountNatureSchema = z.enum(['asset', 'liability', 'equity', 'income', 'expense'])
export const CurrentClassificationSchema = z.enum(['current', 'non_current', 'not_applicable'])
export const VoucherTypeSchema = z.enum([
  'sales', 'purchase', 'receipt', 'payment', 'contra', 'journal',
  'debit_note', 'credit_note', 'opening', 'payroll', 'depreciation',
  'loan', 'interest_accrual', 'tax', 'reversal',
])
export const VoucherStatusSchema = z.enum(['draft', 'submitted', 'approved', 'posted', 'reversed'])
export const EntrySideSchema = z.enum(['debit', 'credit'])

export const CompanySchema = z.object({
  id: CompanyIdSchema,
  legalName: z.string().min(1),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  reportingCurrency: z.string().length(3),
  booksBeginningDate: IsoDateSchema,
})

export const LedgerSchema = z.object({
  id: z.string().uuid(),
  companyId: CompanyIdSchema,
  groupId: z.string().uuid().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  nature: AccountNatureSchema,
  currentClassification: CurrentClassificationSchema,
  active: z.boolean(),
  openingBalanceEligible: z.boolean(),
  scheduleIIIMap: z.string().nullable(),
})

export const VoucherLineInputSchema = z.object({
  ledgerId: z.string().uuid(),
  side: EntrySideSchema,
  amount: MoneySchema.refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  narration: z.string().max(1000).optional(),
  partyId: z.string().uuid().optional(),
  billReference: z.string().max(100).optional(),
  costCentreId: z.string().uuid().optional(),
})

export const CreateVoucherSchema = z.object({
  companyId: CompanyIdSchema,
  voucherType: VoucherTypeSchema,
  voucherDate: IsoDateSchema,
  narration: z.string().max(2000).default(''),
  externalReference: z.string().max(200).optional(),
  idempotencyKey: z.string().min(8).max(200),
  sourceType: z.string().max(50).default('manual'),
  sourceId: z.string().max(200).optional(),
  lines: z.array(VoucherLineInputSchema).min(2),
}).superRefine((voucher, context) => {
  const debit = voucher.lines.filter((line) => line.side === 'debit').reduce((sum, line) => sum + Number(line.amount), 0)
  const credit = voucher.lines.filter((line) => line.side === 'credit').reduce((sum, line) => sum + Number(line.amount), 0)
  if (Math.abs(debit - credit) > 0.0001) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines'], message: 'Total debits must equal total credits' })
  }
})

export const VoucherActionSchema = z.object({
  reason: z.string().min(3).max(1000).optional(),
})

export const ReverseVoucherSchema = z.object({
  reason: z.string().min(3).max(1000),
  idempotencyKey: z.string().min(8).max(200),
  reversalDate: IsoDateSchema,
})

export const ReportPeriodSchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema,
})

export const MigrationSourceTypeSchema = z.enum(['browser', 'local_storage', 'indexed_db', 'json', 'csv', 'xlsx', 'tally', 'opening_template'])
export const MigrationModeSchema = z.enum(['cutover', 'full_history'])
export const MigrationJobStatusSchema = z.enum([
  'uploaded', 'validating', 'mapping_required', 'ready', 'imported', 'reconciled',
  'approved', 'failed', 'cancelled', 'rolled_back', 'corrective_action_required',
])
export const DuplicateClassificationSchema = z.enum(['new', 'already_imported', 'changed', 'conflicting', 'duplicate_current', 'duplicate_previous'])
export const MigrationSeveritySchema = z.enum(['error', 'warning', 'exception'])
export const MappingDecisionSchema = z.enum(['exact', 'probable', 'manual', 'create', 'excluded'])

export const CreateMigrationJobSchema = z.object({
  companyId: CompanyIdSchema,
  sourceType: MigrationSourceTypeSchema,
  sourceCompany: z.string().min(1),
  mode: MigrationModeSchema,
  cutoverDate: IsoDateSchema.optional(),
  dryRun: z.boolean().default(true),
}).refine((job) => job.mode !== 'cutover' || Boolean(job.cutoverDate), {
  path: ['cutoverDate'], message: 'Cutover date is required for cutover migration',
})

export type Company = z.infer<typeof CompanySchema>
export type Ledger = z.infer<typeof LedgerSchema>
export type CreateVoucher = z.infer<typeof CreateVoucherSchema>
export type VoucherStatus = z.infer<typeof VoucherStatusSchema>
export type CreateMigrationJob = z.infer<typeof CreateMigrationJobSchema>

