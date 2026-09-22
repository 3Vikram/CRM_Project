import type pg from 'pg'
import type { InvoiceDraft, ComputedInvoice } from '@crm/shared'
import type { Actor } from '../auth/token.js'
import { transaction } from '../db.js'
import { AccountingError, ConflictError, NotFoundError } from './errors.js'
import { audit, createAndPostVoucherOnClient, reverseVoucherOnClient } from './service.js'
import { computeInvoice, type ComputeError } from '../services/compute.js'

type Queryable = Pick<pg.Pool, 'query'>

const SELECT = `
  SELECT id, company_id "companyId", invoice_number "invoiceNumber", invoice_date::text "invoiceDate",
    buyer_name "buyerName", buyer_gstin "buyerGstin", status, computed, grand_total "grandTotal",
    posted_voucher_id "postedVoucherId", created_by "createdBy", created_at "createdAt"
  FROM sales_invoices
`

export async function listSalesInvoices(db: Queryable, companyId?: string) {
  const result = companyId
    ? await db.query(`${SELECT} WHERE company_id=$1 ORDER BY invoice_date DESC, created_at DESC`, [companyId])
    : await db.query(`${SELECT} ORDER BY invoice_date DESC, created_at DESC`)
  return result.rows
}

export async function getSalesInvoice(db: Queryable, id: string) {
  const result = await db.query(`${SELECT} WHERE id=$1`, [id])
  if (!result.rowCount) throw new NotFoundError('Sale invoice not found')
  return result.rows[0]
}

async function findLedgerIdByName(client: pg.PoolClient, companyId: string, name: string): Promise<string> {
  const result = await client.query<{ id: string }>(`SELECT id FROM ledgers WHERE company_id=$1 AND name=$2 AND active=true`, [companyId, name])
  if (!result.rowCount) throw new AccountingError(`Ledger "${name}" is not configured for this company`, 422, 'MISSING_LEDGER')
  return result.rows[0].id
}

/** Recomputes the draft server-side (never trusts a client-computed total), then issues and posts it. */
export async function issueSalesInvoice(pool: pg.Pool, draft: InvoiceDraft, actor: Actor) {
  let computed: ComputedInvoice
  try {
    computed = computeInvoice(draft)
  } catch (err) {
    const e = err as ComputeError
    throw new AccountingError(e.message ?? 'Could not compute invoice', e.status ?? 400, 'COMPUTE_FAILED')
  }
  if (computed.mixedCompany) throw new AccountingError(computed.mixedCompanyWarning ?? 'Split mixed-company rows into separate invoices first', 422, 'MIXED_COMPANY')
  if (!draft.invoiceNo?.trim()) throw new AccountingError('Invoice number is required', 422, 'INVOICE_NUMBER_REQUIRED')

  const companyId = computed.seller.id
  return transaction(pool, async (client) => {
    const clash = await client.query(`SELECT id FROM sales_invoices WHERE company_id=$1 AND status<>'cancelled' AND lower(invoice_number)=lower($2)`, [companyId, draft.invoiceNo])
    if (clash.rowCount) throw new ConflictError('An active sale invoice with this number already exists')

    const arId = await findLedgerIdByName(client, companyId, 'Accounts Receivable')
    const salesId = await findLedgerIdByName(client, companyId, 'Sales Income')
    const gstId = await findLedgerIdByName(client, companyId, 'Output GST')

    const lines: { ledgerId: string; side: 'debit' | 'credit'; amount: string; narration?: string }[] = [
      { ledgerId: arId, side: 'debit', amount: computed.roundedGrandTotal.toFixed(4), narration: `Sale invoice ${draft.invoiceNo}` },
      { ledgerId: salesId, side: 'credit', amount: computed.taxableTotal.toFixed(4), narration: 'Taxable value' },
    ]
    if (computed.totalTax > 0) lines.push({ ledgerId: gstId, side: 'credit', amount: computed.totalTax.toFixed(4), narration: 'Output GST' })
    const diff = computed.roundedGrandTotal - computed.grandTotal
    if (Math.abs(diff) > 0.0001) {
      const roundLedgerName = diff < 0 ? 'Other Expenses' : 'Other Income'
      const roundLedgerId = await findLedgerIdByName(client, companyId, roundLedgerName)
      lines.push({ ledgerId: roundLedgerId, side: diff < 0 ? 'debit' : 'credit', amount: Math.abs(diff).toFixed(4), narration: 'Round off' })
    }

    // Insert the row first (posted_voucher_id filled in after) so the
    // voucher can carry this row's id as its source_id from the start —
    // posted vouchers are immutable, so we can't backfill it afterwards.
    const inserted = await client.query(
      `INSERT INTO sales_invoices(company_id,invoice_number,invoice_date,buyer_name,buyer_gstin,draft,computed,grand_total,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [companyId, draft.invoiceNo, draft.invoiceDate, draft.buyer.name, draft.buyer.gstin ?? null, draft, computed, computed.roundedGrandTotal, actor.id],
    )
    const invoiceId = inserted.rows[0].id

    const voucher = await createAndPostVoucherOnClient(client, {
      companyId, voucherType: 'sales', voucherDate: draft.invoiceDate, narration: `Sale invoice ${draft.invoiceNo} to ${draft.buyer.name}`,
      invoiceReference: draft.invoiceNo, idempotencyKey: `sales-invoice:${companyId}:${draft.invoiceNo}`,
      sourceType: 'sales_invoice', sourceId: invoiceId, lines,
    }, actor)

    await client.query(`UPDATE sales_invoices SET posted_voucher_id=$2 WHERE id=$1`, [invoiceId, voucher.id])
    await audit(client, companyId, actor.id, 'sales_invoice.issued', invoiceId, { invoiceNumber: draft.invoiceNo }, 'sales_invoice')
    return getSalesInvoice(client, invoiceId)
  })
}

export async function cancelSalesInvoice(pool: pg.Pool, id: string, actor: Actor, reason?: string) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT * FROM sales_invoices WHERE id=$1 FOR UPDATE`, [id])
    if (!found.rowCount) throw new NotFoundError('Sale invoice not found')
    const invoice = found.rows[0]
    if (invoice.status === 'cancelled') return getSalesInvoice(client, id)
    await reverseVoucherOnClient(client, invoice.company_id, invoice.posted_voucher_id, invoice.invoice_date.toISOString().slice(0, 10), `reverse:sales-invoice:${id}`, reason ?? `Cancelling sale invoice ${invoice.invoice_number}`, actor)
    await client.query(`UPDATE sales_invoices SET status='cancelled' WHERE id=$1`, [id])
    await audit(client, invoice.company_id, actor.id, 'sales_invoice.cancelled', id, {}, 'sales_invoice')
    return getSalesInvoice(client, id)
  })
}

// --- per-user working draft --------------------------------------------------

export async function getInvoiceDraft(pool: pg.Pool, userId: string) {
  const result = await pool.query<{ draft: InvoiceDraft }>(`SELECT draft FROM invoice_drafts WHERE user_id=$1`, [userId])
  return result.rows[0]?.draft ?? null
}

export async function saveInvoiceDraft(pool: pg.Pool, userId: string, draft: unknown) {
  await pool.query(
    `INSERT INTO invoice_drafts(user_id,draft) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET draft=$2, updated_at=now()`,
    [userId, draft],
  )
}

export async function deleteInvoiceDraft(pool: pg.Pool, userId: string) {
  await pool.query(`DELETE FROM invoice_drafts WHERE user_id=$1`, [userId])
}
