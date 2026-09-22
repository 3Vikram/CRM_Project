import { Router } from 'express'
import { CreateBankPaymentSchema, CreateMigrationJobSchema, CreatePurchaseInvoiceSchema, CreateVoucherSchema, LegacyAccountingDataSchema, ReportPeriodSchema, ReverseVoucherSchema } from '@crm/shared'
import { database } from '../db.js'
import { allow } from '../auth/token.js'
import { balanceSheet, ledgerReport, profitAndLoss, trialBalance } from './reports.js'
import { createVoucher, deleteDraftVoucher, listVouchers, postDirect, reverseVoucher, transitionVoucher, updateDraftVoucher } from './service.js'
import { cancelPurchaseInvoice, createPurchaseInvoice, getPurchaseInvoice, listPurchaseInvoices, postPurchaseInvoice, updatePurchaseInvoice } from './purchaseInvoices.js'
import { cancelBankPayment, createBankPayment, getBankPayment, listBankPayments, postBankPayment, setBankPaymentClearance, updateBankPayment } from './bankPayments.js'
import { importBrowserData } from './browserImport.js'
import { AccountingError, NotFoundError } from './errors.js'
import { z } from 'zod'

export const accountingRouter = Router()
// `requireActor` already ran at the /api level (see app.ts); every route below assumes req.actor is set.

function company(req: { params: Record<string, string>; body?: unknown }) {
  const companyId = req.params.companyId
  if (!companyId) throw new AccountingError('Company is required')
  return companyId
}

accountingRouter.get('/companies', async (_req, res, next) => { try { const result = await database().query(`SELECT id,legal_name "legalName",gstin,pan,reporting_currency "reportingCurrency",books_beginning_date::text "booksBeginningDate" FROM companies ORDER BY legal_name`); res.json(result.rows) } catch (error) { next(error) } })

accountingRouter.get('/companies/:companyId/ledgers', async (req, res, next) => { try {
  const result = await database().query(`SELECT id,company_id "companyId",group_id "groupId",code,name,nature,current_classification "currentClassification",active,opening_balance_eligible "openingBalanceEligible",schedule_iii_map "scheduleIIIMap" FROM ledgers WHERE company_id=$1 ORDER BY code,name`, [company(req)])
  res.json(result.rows)
} catch (error) { next(error) } })

accountingRouter.get('/companies/:companyId/vouchers', async (req, res, next) => { try {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined
  res.json(await listVouchers(database(), company(req), type))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/vouchers', allow('administrator', 'accountant', 'maker', 'migration_operator'), async (req, res, next) => { try {
  const input = CreateVoucherSchema.parse({ ...req.body, companyId: company(req) })
  res.status(201).json(await createVoucher(database(), input, req.actor!))
} catch (error) { next(error) } })

accountingRouter.put('/companies/:companyId/vouchers/:voucherId', allow('administrator', 'accountant', 'maker', 'migration_operator'), async (req, res, next) => { try {
  const input = CreateVoucherSchema.parse({ ...req.body, companyId: company(req) })
  res.json(await updateDraftVoucher(database(), company(req), req.params.voucherId, input, req.actor!))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/vouchers/:voucherId/cancel', allow('administrator', 'accountant', 'maker', 'migration_operator'), async (req, res, next) => { try {
  await deleteDraftVoucher(database(), company(req), req.params.voucherId, req.actor!)
  res.status(204).end()
} catch (error) { next(error) } })

for (const action of ['submit', 'approve', 'post'] as const) accountingRouter.post(`/companies/:companyId/vouchers/:voucherId/${action}`, async (req, res, next) => { try {
  res.json(await transitionVoucher(database(), company(req), req.params.voucherId, action, req.actor!))
} catch (error) { next(error) } })

// Submit + approve + post in one call. Only allowed when the company has maker-checker switched off.
accountingRouter.post('/companies/:companyId/vouchers/:voucherId/post-direct', allow('administrator', 'accountant'), async (req, res, next) => { try {
  res.json(await postDirect(database(), company(req), req.params.voucherId, req.actor!))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/vouchers/:voucherId/reverse', allow('administrator', 'accountant'), async (req, res, next) => { try {
  const input = ReverseVoucherSchema.parse(req.body)
  res.status(201).json(await reverseVoucher(database(), company(req), req.params.voucherId, input.reversalDate, input.idempotencyKey, input.reason, req.actor!))
} catch (error) { next(error) } })

accountingRouter.get('/companies/:companyId/vouchers/:voucherId', async (req, res, next) => { try {
  const result = await database().query(`SELECT v.*,COALESCE(json_agg(vl ORDER BY vl.line_number) FILTER (WHERE vl.id IS NOT NULL),'[]') lines FROM vouchers v LEFT JOIN voucher_lines vl ON vl.company_id=v.company_id AND vl.voucher_id=v.id WHERE v.company_id=$1 AND v.id=$2 GROUP BY v.id`, [company(req), req.params.voucherId])
  if (!result.rowCount) throw new NotFoundError('Voucher not found')
  res.json(result.rows[0])
} catch (error) { next(error) } })

accountingRouter.get('/companies/:companyId/reports/trial-balance', async (req, res, next) => { try { const period = ReportPeriodSchema.parse(req.query); res.json(await trialBalance(database(), company(req), period.to)) } catch (error) { next(error) } })
accountingRouter.get('/companies/:companyId/reports/ledger/:ledgerId', async (req, res, next) => { try { const period = ReportPeriodSchema.parse(req.query); res.json(await ledgerReport(database(), company(req), req.params.ledgerId, period.from, period.to)) } catch (error) { next(error) } })
accountingRouter.get('/companies/:companyId/reports/profit-loss', async (req, res, next) => { try { const period = ReportPeriodSchema.parse(req.query); res.json(await profitAndLoss(database(), company(req), period.from, period.to)) } catch (error) { next(error) } })
accountingRouter.get('/companies/:companyId/reports/balance-sheet', async (req, res, next) => { try { const period = ReportPeriodSchema.parse(req.query); const compareTo = typeof req.query.compareTo === 'string' ? req.query.compareTo : undefined; res.json(await balanceSheet(database(), company(req), period.to, compareTo)) } catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/migrations', allow('administrator', 'migration_operator'), async (req, res, next) => { try {
  const input = CreateMigrationJobSchema.parse({ ...req.body, companyId: company(req) })
  const result = await database().query(`INSERT INTO migration_jobs(company_id,source_type,source_company,mode,cutover_date,dry_run,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [input.companyId, input.sourceType, input.sourceCompany, input.mode, input.cutoverDate ?? null, input.dryRun, req.actor!.id])
  res.status(201).json(result.rows[0])
} catch (error) { next(error) } })

accountingRouter.get('/companies/:companyId/migrations', allow('administrator', 'accountant', 'migration_operator', 'auditor'), async (req, res, next) => { try {
  const result = await database().query(`SELECT * FROM migration_jobs WHERE company_id=$1 ORDER BY created_at DESC`, [company(req)]); res.json(result.rows)
} catch (error) { next(error) } })

// --- Purchase invoices --------------------------------------------------

accountingRouter.get('/companies/:companyId/purchase-invoices', async (req, res, next) => { try {
  res.json(await listPurchaseInvoices(database(), company(req)))
} catch (error) { next(error) } })

accountingRouter.get('/companies/:companyId/purchase-invoices/:id', async (req, res, next) => { try {
  res.json(await getPurchaseInvoice(database(), company(req), req.params.id))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/purchase-invoices', allow('administrator', 'accountant', 'maker', 'migration_operator'), async (req, res, next) => { try {
  const input = CreatePurchaseInvoiceSchema.parse({ ...req.body, companyId: company(req) })
  res.status(201).json(await createPurchaseInvoice(database(), input, req.actor!))
} catch (error) { next(error) } })

accountingRouter.put('/companies/:companyId/purchase-invoices/:id', allow('administrator', 'accountant', 'maker', 'migration_operator'), async (req, res, next) => { try {
  const input = CreatePurchaseInvoiceSchema.parse({ ...req.body, companyId: company(req) })
  res.json(await updatePurchaseInvoice(database(), company(req), req.params.id, input, req.actor!))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/purchase-invoices/:id/post', allow('administrator', 'accountant'), async (req, res, next) => { try {
  res.json(await postPurchaseInvoice(database(), company(req), req.params.id, req.actor!))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/purchase-invoices/:id/cancel', allow('administrator', 'accountant'), async (req, res, next) => { try {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined
  res.json(await cancelPurchaseInvoice(database(), company(req), req.params.id, req.actor!, reason))
} catch (error) { next(error) } })

// --- Bank payments -------------------------------------------------------

accountingRouter.get('/companies/:companyId/bank-payments', async (req, res, next) => { try {
  res.json(await listBankPayments(database(), company(req)))
} catch (error) { next(error) } })

accountingRouter.get('/companies/:companyId/bank-payments/:id', async (req, res, next) => { try {
  res.json(await getBankPayment(database(), company(req), req.params.id))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/bank-payments', allow('administrator', 'accountant', 'maker', 'migration_operator'), async (req, res, next) => { try {
  const input = CreateBankPaymentSchema.parse({ ...req.body, companyId: company(req) })
  res.status(201).json(await createBankPayment(database(), input, req.actor!))
} catch (error) { next(error) } })

accountingRouter.put('/companies/:companyId/bank-payments/:id', allow('administrator', 'accountant', 'maker', 'migration_operator'), async (req, res, next) => { try {
  const input = CreateBankPaymentSchema.parse({ ...req.body, companyId: company(req) })
  res.json(await updateBankPayment(database(), company(req), req.params.id, input, req.actor!))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/bank-payments/:id/post', allow('administrator', 'accountant'), async (req, res, next) => { try {
  res.json(await postBankPayment(database(), company(req), req.params.id, req.actor!))
} catch (error) { next(error) } })

accountingRouter.post('/companies/:companyId/bank-payments/:id/cancel', allow('administrator', 'accountant'), async (req, res, next) => { try {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined
  res.json(await cancelBankPayment(database(), company(req), req.params.id, req.actor!, reason))
} catch (error) { next(error) } })

accountingRouter.patch('/companies/:companyId/bank-payments/:id/clearance', allow('administrator', 'accountant', 'maker'), async (req, res, next) => { try {
  const clearance = z.enum(['Pending', 'Cleared']).parse(req.body?.clearance)
  res.json(await setBankPaymentClearance(database(), company(req), req.params.id, clearance, req.actor!))
} catch (error) { next(error) } })

// --- one-time browser localStorage import -----------------------------------

accountingRouter.post('/companies/:companyId/import/browser', allow('administrator', 'migration_operator'), async (req, res, next) => { try {
  const input = LegacyAccountingDataSchema.parse({ ...req.body, companyId: company(req) })
  res.status(201).json(await importBrowserData(database(), input, req.actor!))
} catch (error) { next(error) } })
