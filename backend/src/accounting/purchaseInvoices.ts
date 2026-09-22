import type pg from 'pg'
import { purchaseInvoiceTotals, type CreatePurchaseInvoice } from '@crm/shared'
import type { Actor } from '../auth/token.js'
import { transaction } from '../db.js'
import { AccountingError, ConflictError, NotFoundError } from './errors.js'
import { audit, createAndPostVoucherOnClient, reverseVoucherOnClient } from './service.js'

const LIST_SELECT = `
  SELECT pi.id, pi.company_id "companyId", pi.number, pi.vendor, pi.vendor_gstin "vendorGstin",
    pi.vendor_invoice_number "vendorInvoiceNumber", pi.invoice_date::text "invoiceDate", pi.due_date::text "dueDate",
    pi.tax_mode "taxMode", pi.notes, pi.status, pi.posted_voucher_id "postedVoucherId", pi.created_by "createdBy",
    pi.created_at "createdAt",
    COALESCE((SELECT json_agg(json_build_object(
      'id', l.id, 'description', l.description, 'quantity', l.quantity, 'rate', l.rate,
      'gstRate', l.gst_rate, 'ledgerId', l.ledger_id
    ) ORDER BY l.line_number) FROM purchase_invoice_lines l WHERE l.purchase_invoice_id = pi.id), '[]') AS lines,
    COALESCE((SELECT sum(bp.amount) FROM bank_payments bp WHERE bp.linked_purchase_invoice_id = pi.id AND bp.status = 'posted'), 0)::text "paidAmount"
  FROM purchase_invoices pi
`

function withTotals(row: any) {
  const totals = purchaseInvoiceTotals(row.lines, row.taxMode)
  const paid = Number(row.paidAmount)
  const outstanding = Math.max(0, totals.total - paid)
  const paymentStatus = paid <= 0 ? 'Unpaid' : paid >= totals.total - 0.005 ? 'Paid' : 'Partially paid'
  return { ...row, totals, paidAmount: paid, outstanding, paymentStatus: row.status === 'posted' ? paymentStatus : undefined }
}

// Accepts a pool or a client so callers still inside an open transaction can
// read back their own uncommitted writes (a pool.query would run on a
// different connection and see nothing until COMMIT).
type Queryable = Pick<pg.Pool, 'query'>

export async function listPurchaseInvoices(db: Queryable, companyId: string) {
  const result = await db.query(`${LIST_SELECT} WHERE pi.company_id=$1 ORDER BY pi.invoice_date DESC, pi.created_at DESC`, [companyId])
  return result.rows.map(withTotals)
}

export async function getPurchaseInvoice(db: Queryable, companyId: string, id: string) {
  const result = await db.query(`${LIST_SELECT} WHERE pi.company_id=$1 AND pi.id=$2`, [companyId, id])
  if (!result.rowCount) throw new NotFoundError('Purchase invoice not found')
  return withTotals(result.rows[0])
}

async function assertUniqueVendorRef(client: pg.PoolClient, companyId: string, number: string, vendor: string, vendorInvoiceNumber: string, excludeId?: string) {
  const clash = await client.query(
    `SELECT id FROM purchase_invoices WHERE company_id=$1 AND status <> 'cancelled' AND id IS DISTINCT FROM $5
       AND (lower(number)=lower($2) OR (lower(vendor)=lower($3) AND lower(vendor_invoice_number)=lower($4)))`,
    [companyId, number, vendor, vendorInvoiceNumber, excludeId ?? null],
  )
  if (clash.rowCount) throw new ConflictError('An active purchase invoice with this number, or this vendor and supplier invoice number, already exists')
}

export async function createPurchaseInvoice(pool: pg.Pool, input: CreatePurchaseInvoice, actor: Actor) {
  return transaction(pool, async (client) => {
    await assertUniqueVendorRef(client, input.companyId, input.number, input.vendor, input.vendorInvoiceNumber)
    const inserted = await client.query(
      `INSERT INTO purchase_invoices(company_id,number,vendor,vendor_gstin,vendor_invoice_number,invoice_date,due_date,tax_mode,notes,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [input.companyId, input.number, input.vendor, input.vendorGstin ?? null, input.vendorInvoiceNumber, input.invoiceDate, input.dueDate ?? null, input.taxMode, input.notes, actor.id],
    )
    const id = inserted.rows[0].id
    for (const [index, line] of input.lines.entries()) {
      await client.query(
        `INSERT INTO purchase_invoice_lines(company_id,purchase_invoice_id,line_number,description,quantity,rate,gst_rate,ledger_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [input.companyId, id, index + 1, line.description, line.quantity, line.rate, line.gstRate, line.ledgerId],
      )
    }
    await audit(client, input.companyId, actor.id, 'purchase_invoice.created', id, { number: input.number }, 'purchase_invoice')
    return getPurchaseInvoice(client, input.companyId, id)
  })
}

export async function updatePurchaseInvoice(pool: pg.Pool, companyId: string, id: string, input: CreatePurchaseInvoice, actor: Actor) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT status FROM purchase_invoices WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, id])
    if (!found.rowCount) throw new NotFoundError('Purchase invoice not found')
    if (found.rows[0].status !== 'draft') throw new ConflictError('Only draft purchase invoices can be edited')
    await assertUniqueVendorRef(client, companyId, input.number, input.vendor, input.vendorInvoiceNumber, id)
    await client.query(
      `UPDATE purchase_invoices SET number=$3,vendor=$4,vendor_gstin=$5,vendor_invoice_number=$6,invoice_date=$7,due_date=$8,tax_mode=$9,notes=$10,updated_at=now()
       WHERE company_id=$1 AND id=$2`,
      [companyId, id, input.number, input.vendor, input.vendorGstin ?? null, input.vendorInvoiceNumber, input.invoiceDate, input.dueDate ?? null, input.taxMode, input.notes],
    )
    await client.query(`DELETE FROM purchase_invoice_lines WHERE purchase_invoice_id=$1`, [id])
    for (const [index, line] of input.lines.entries()) {
      await client.query(
        `INSERT INTO purchase_invoice_lines(company_id,purchase_invoice_id,line_number,description,quantity,rate,gst_rate,ledger_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [companyId, id, index + 1, line.description, line.quantity, line.rate, line.gstRate, line.ledgerId],
      )
    }
    await audit(client, companyId, actor.id, 'purchase_invoice.updated', id, {}, 'purchase_invoice')
    return getPurchaseInvoice(client, companyId, id)
  })
}

async function findLedgerIdByName(client: pg.PoolClient, companyId: string, name: string): Promise<string> {
  const result = await client.query<{ id: string }>(`SELECT id FROM ledgers WHERE company_id=$1 AND name=$2 AND active=true`, [companyId, name])
  if (!result.rowCount) throw new AccountingError(`Ledger "${name}" is not configured for this company`, 422, 'MISSING_LEDGER')
  return result.rows[0].id
}

export async function postPurchaseInvoice(pool: pg.Pool, companyId: string, id: string, actor: Actor) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT * FROM purchase_invoices WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, id])
    if (!found.rowCount) throw new NotFoundError('Purchase invoice not found')
    const invoice = found.rows[0]
    if (invoice.status !== 'draft') throw new ConflictError('Only draft purchase invoices can be posted')
    const lines = (await client.query(`SELECT * FROM purchase_invoice_lines WHERE purchase_invoice_id=$1 ORDER BY line_number`, [id])).rows
    if (!lines.length) throw new AccountingError('Add at least one line before posting', 422, 'EMPTY_INVOICE')
    const totals = purchaseInvoiceTotals(lines.map((l) => ({ quantity: Number(l.quantity), rate: Number(l.rate), gstRate: Number(l.gst_rate) })), invoice.tax_mode)

    const accountsPayableId = await findLedgerIdByName(client, companyId, 'Accounts Payable')
    const voucherLines: { ledgerId: string; side: 'debit' | 'credit'; amount: string; narration: string }[] =
      lines.map((l) => ({ ledgerId: l.ledger_id as string, side: 'debit', amount: (Number(l.quantity) * Number(l.rate)).toFixed(4), narration: l.description as string }))
    if (totals.gst > 0) {
      const inputGstId = await findLedgerIdByName(client, companyId, 'Input GST')
      voucherLines.push({ ledgerId: inputGstId, side: 'debit', amount: totals.gst.toFixed(4), narration: 'Input GST' })
    }
    voucherLines.push({ ledgerId: accountsPayableId, side: 'credit', amount: totals.total.toFixed(4), narration: invoice.notes || invoice.vendor_invoice_number })

    const voucher = await createAndPostVoucherOnClient(client, {
      companyId, voucherType: 'purchase', voucherDate: invoice.invoice_date.toISOString().slice(0, 10),
      narration: invoice.notes || `Purchase invoice ${invoice.number} from ${invoice.vendor}`,
      externalReference: invoice.vendor_invoice_number, invoiceReference: invoice.number,
      idempotencyKey: `purchase-invoice:${id}`, sourceType: 'purchase_invoice', sourceId: id, lines: voucherLines,
    }, actor)

    await client.query(`UPDATE purchase_invoices SET status='posted', posted_voucher_id=$3, updated_at=now() WHERE company_id=$1 AND id=$2`, [companyId, id, voucher.id])
    await audit(client, companyId, actor.id, 'purchase_invoice.posted', id, { voucherId: voucher.id }, 'purchase_invoice')
    return getPurchaseInvoice(client, companyId, id)
  })
}

export async function cancelPurchaseInvoice(pool: pg.Pool, companyId: string, id: string, actor: Actor, reason?: string) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT * FROM purchase_invoices WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, id])
    if (!found.rowCount) throw new NotFoundError('Purchase invoice not found')
    const invoice = found.rows[0]
    if (invoice.status === 'cancelled') return getPurchaseInvoice(client, companyId, id)
    if (invoice.status === 'draft') {
      await client.query(`UPDATE purchase_invoices SET status='cancelled', updated_at=now() WHERE company_id=$1 AND id=$2`, [companyId, id])
    } else {
      await reverseVoucherOnClient(client, companyId, invoice.posted_voucher_id, invoice.invoice_date.toISOString().slice(0, 10), `reverse:purchase-invoice:${id}`, reason ?? `Cancelling purchase invoice ${invoice.number}`, actor)
      await client.query(`UPDATE purchase_invoices SET status='cancelled', updated_at=now() WHERE company_id=$1 AND id=$2`, [companyId, id])
    }
    await audit(client, companyId, actor.id, 'purchase_invoice.cancelled', id, {}, 'purchase_invoice')
    return getPurchaseInvoice(client, companyId, id)
  })
}
