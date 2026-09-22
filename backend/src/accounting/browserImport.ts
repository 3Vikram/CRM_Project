import type pg from 'pg'
import type { LegacyAccountingData } from '@crm/shared'
import type { Actor } from '../auth/token.js'
import { transaction } from '../db.js'
import { AccountingError } from './errors.js'
import { audit, createAndPostVoucherOnClient, createVoucher } from './service.js'
import { postPurchaseInvoice } from './purchaseInvoices.js'
import { postBankPayment } from './bankPayments.js'

/**
 * One-time import of the pre-migration browser localStorage accounting data
 * (frontend/src/lib/accounting.ts's `AccountingData`). Idempotent: every
 * inserted row carries the old record's id as `legacy_client_id` /
 * `source_id`, under a unique index, so re-running the same payload skips
 * whatever it already imported instead of duplicating it.
 *
 * Deliberately NOT one giant transaction: each record is its own committed
 * step (insert, then post via the normal service function, which opens its
 * own transaction and needs to see the insert already committed), so a
 * failure partway through leaves already-imported records in place — safe
 * to just re-run the same payload, which is what a resumable migration
 * needs anyway.
 */
export async function importBrowserData(pool: pg.Pool, data: LegacyAccountingData, actor: Actor) {
  const companyId = data.companyId
  const ledgers = await pool.query<{ id: string; name: string }>(`SELECT id, name FROM ledgers WHERE company_id=$1`, [companyId])
  const ledgerByName = new Map(ledgers.rows.map((l) => [l.name, l.id]))

  const missing = new Set<string>()
  const need = (name: string) => { if (!ledgerByName.has(name)) missing.add(name) }
  for (const inv of data.purchaseInvoices) for (const l of inv.lines) need(l.account)
  for (const v of data.vouchers) for (const l of v.lines) need(l.account)
  for (const p of data.bankPayments) { need(p.bankAccount); if (!p.linkedInvoiceId && p.category) need(p.category) }
  if (missing.size) throw new AccountingError(`Unknown account name(s), nothing was imported: ${[...missing].join(', ')}`, 422, 'UNKNOWN_LEDGER')

  const job = await pool.query<{ id: string }>(
    `INSERT INTO migration_jobs(company_id,source_type,source_company,mode,dry_run,status,created_by,approved_by)
     VALUES($1,'local_storage',$1,'full_history',false,'imported',$2,$2) RETURNING id`,
    [companyId, actor.id],
  )
  const jobId = job.rows[0].id

  const counts = { purchaseInvoices: { created: 0, skipped: 0 }, vouchers: { created: 0, skipped: 0 }, bankPayments: { created: 0, skipped: 0 } }
  const oldToNewInvoiceId = new Map<string, string>()

  for (const inv of data.purchaseInvoices) {
    const existing = await pool.query<{ id: string }>(`SELECT id FROM purchase_invoices WHERE company_id=$1 AND legacy_client_id=$2`, [companyId, inv.id])
    if (existing.rowCount) { oldToNewInvoiceId.set(inv.id, existing.rows[0].id); counts.purchaseInvoices.skipped++; continue }
    const newId = await transaction(pool, async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO purchase_invoices(company_id,number,vendor,vendor_gstin,vendor_invoice_number,invoice_date,due_date,tax_mode,notes,status,legacy_client_id,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11) RETURNING id`,
        [companyId, inv.number, inv.vendor, inv.gstin || null, inv.vendorInvoiceNumber, inv.invoiceDate, inv.dueDate || null, inv.taxMode, inv.notes ?? '', inv.id, actor.id],
      )
      const id = inserted.rows[0].id
      for (const [index, line] of inv.lines.entries()) {
        await client.query(
          `INSERT INTO purchase_invoice_lines(company_id,purchase_invoice_id,line_number,description,quantity,rate,gst_rate,ledger_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [companyId, id, index + 1, line.description, line.quantity, line.rate, line.gstRate, ledgerByName.get(line.account)],
        )
      }
      return id
    })
    if (inv.status === 'posted') await postPurchaseInvoice(pool, companyId, newId, actor)
    else if (inv.status === 'cancelled') await pool.query(`UPDATE purchase_invoices SET status='cancelled' WHERE id=$1`, [newId])
    oldToNewInvoiceId.set(inv.id, newId)
    counts.purchaseInvoices.created++
  }

  for (const v of data.vouchers) {
    const existing = await pool.query(`SELECT id FROM vouchers WHERE company_id=$1 AND source_type='legacy_browser' AND source_id=$2`, [companyId, v.id])
    if (existing.rowCount) { counts.vouchers.skipped++; continue }
    if (v.status === 'cancelled') { counts.vouchers.skipped++; continue } // no ledger effect to replicate
    const lines = v.lines.map((l) => ({
      ledgerId: ledgerByName.get(l.account)!,
      side: (l.credit > 0 ? 'credit' : 'debit') as 'debit' | 'credit',
      amount: (l.credit > 0 ? l.credit : l.debit).toFixed(4),
      narration: l.description,
    }))
    const input = {
      companyId, voucherType: 'journal' as const, voucherDate: v.date, narration: v.narration ?? '',
      externalReference: v.reference || undefined, invoiceReference: v.invoiceNumber || undefined,
      idempotencyKey: `legacy-voucher:${companyId}:${v.id}`, sourceType: 'legacy_browser', sourceId: v.id, lines,
    }
    if (v.status === 'posted') await transaction(pool, (client) => createAndPostVoucherOnClient(client, input, actor))
    else await createVoucher(pool, input, actor)
    counts.vouchers.created++
  }

  for (const p of data.bankPayments) {
    const existing = await pool.query<{ id: string }>(`SELECT id FROM bank_payments WHERE company_id=$1 AND legacy_client_id=$2`, [companyId, p.id])
    if (existing.rowCount) { counts.bankPayments.skipped++; continue }
    const linkedId = p.linkedInvoiceId ? oldToNewInvoiceId.get(p.linkedInvoiceId) : undefined
    const newId = await transaction(pool, async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO bank_payments(company_id,number,payment_date,payee,bank_ledger_id,category_ledger_id,linked_purchase_invoice_id,mode,reference,amount,narration,clearance,status,legacy_client_id,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14) RETURNING id`,
        [companyId, p.number, p.date, p.payee, ledgerByName.get(p.bankAccount), linkedId ? null : ledgerByName.get(p.category ?? ''), linkedId ?? null, p.mode ?? '', p.reference ?? '', p.amount, p.narration ?? '', p.clearance, p.id, actor.id],
      )
      return inserted.rows[0].id
    })
    if (p.status === 'posted') await postBankPayment(pool, companyId, newId, actor)
    else if (p.status === 'cancelled') await pool.query(`UPDATE bank_payments SET status='cancelled' WHERE id=$1`, [newId])
    counts.bankPayments.created++
  }

  await pool.query(`UPDATE migration_jobs SET updated_at=now() WHERE id=$1`, [jobId])
  await transaction(pool, (client) => audit(client, companyId, actor.id, 'browser_import.completed', jobId, counts, 'migration_job'))
  return { jobId, counts }
}
