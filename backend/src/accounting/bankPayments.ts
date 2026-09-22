import type pg from 'pg'
import type { CreateBankPayment } from '@crm/shared'
import type { Actor } from '../auth/token.js'
import { transaction } from '../db.js'
import { AccountingError, ConflictError, NotFoundError } from './errors.js'
import { audit, createAndPostVoucherOnClient, reverseVoucherOnClient } from './service.js'

const SELECT = `
  SELECT bp.id, bp.company_id "companyId", bp.number, bp.payment_date::text "paymentDate", bp.payee,
    bp.bank_ledger_id "bankLedgerId", bp.category_ledger_id "categoryLedgerId",
    bp.linked_purchase_invoice_id "linkedPurchaseInvoiceId", bp.mode, bp.reference, bp.amount::text,
    bp.narration, bp.clearance, bp.status, bp.posted_voucher_id "postedVoucherId",
    bp.created_by "createdBy", bp.created_at "createdAt"
  FROM bank_payments bp
`

type Queryable = Pick<pg.Pool, 'query'>

export async function listBankPayments(db: Queryable, companyId: string) {
  const result = await db.query(`${SELECT} WHERE bp.company_id=$1 ORDER BY bp.payment_date DESC, bp.created_at DESC`, [companyId])
  return result.rows
}

export async function getBankPayment(db: Queryable, companyId: string, id: string) {
  const result = await db.query(`${SELECT} WHERE bp.company_id=$1 AND bp.id=$2`, [companyId, id])
  if (!result.rowCount) throw new NotFoundError('Bank payment not found')
  return result.rows[0]
}

async function assertUniqueNumber(client: pg.PoolClient, companyId: string, number: string, excludeId?: string) {
  const clash = await client.query(
    `SELECT id FROM bank_payments WHERE company_id=$1 AND status <> 'cancelled' AND id IS DISTINCT FROM $3 AND lower(number)=lower($2)`,
    [companyId, number, excludeId ?? null],
  )
  if (clash.rowCount) throw new ConflictError('An active bank payment with this number already exists')
}

function insertValues(input: CreateBankPayment) {
  return [input.companyId, input.number, input.paymentDate, input.payee, input.bankLedgerId, input.categoryLedgerId ?? null, input.linkedPurchaseInvoiceId ?? null, input.mode, input.reference, input.amount, input.narration]
}

export async function createBankPayment(pool: pg.Pool, input: CreateBankPayment, actor: Actor) {
  return transaction(pool, async (client) => {
    await assertUniqueNumber(client, input.companyId, input.number)
    const inserted = await client.query(
      `INSERT INTO bank_payments(company_id,number,payment_date,payee,bank_ledger_id,category_ledger_id,linked_purchase_invoice_id,mode,reference,amount,narration,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [...insertValues(input), actor.id],
    )
    await audit(client, input.companyId, actor.id, 'bank_payment.created', inserted.rows[0].id, { number: input.number }, 'bank_payment')
    return getBankPayment(client, input.companyId, inserted.rows[0].id)
  })
}

export async function updateBankPayment(pool: pg.Pool, companyId: string, id: string, input: CreateBankPayment, actor: Actor) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT status FROM bank_payments WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, id])
    if (!found.rowCount) throw new NotFoundError('Bank payment not found')
    if (found.rows[0].status !== 'draft') throw new ConflictError('Only draft bank payments can be edited')
    await assertUniqueNumber(client, companyId, input.number, id)
    await client.query(
      `UPDATE bank_payments SET number=$3,payment_date=$4,payee=$5,bank_ledger_id=$6,category_ledger_id=$7,linked_purchase_invoice_id=$8,mode=$9,reference=$10,amount=$11,narration=$12,updated_at=now()
       WHERE company_id=$1 AND id=$2`,
      [companyId, id, input.number, input.paymentDate, input.payee, input.bankLedgerId, input.categoryLedgerId ?? null, input.linkedPurchaseInvoiceId ?? null, input.mode, input.reference, input.amount, input.narration],
    )
    await audit(client, companyId, actor.id, 'bank_payment.updated', id, {}, 'bank_payment')
    return getBankPayment(client, companyId, id)
  })
}

export async function postBankPayment(pool: pg.Pool, companyId: string, id: string, actor: Actor) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT * FROM bank_payments WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, id])
    if (!found.rowCount) throw new NotFoundError('Bank payment not found')
    const payment = found.rows[0]
    if (payment.status !== 'draft') throw new ConflictError('Only draft bank payments can be posted')

    const debitLedgerId = payment.linked_purchase_invoice_id
      ? await (async () => {
          const result = await client.query<{ id: string }>(`SELECT id FROM ledgers WHERE company_id=$1 AND name='Accounts Payable'`, [companyId])
          if (!result.rowCount) throw new AccountingError('Accounts Payable ledger is not configured for this company', 422, 'MISSING_LEDGER')
          return result.rows[0].id
        })()
      : payment.category_ledger_id

    const voucher = await createAndPostVoucherOnClient(client, {
      companyId, voucherType: 'payment', voucherDate: payment.payment_date.toISOString().slice(0, 10),
      narration: payment.narration || `Payment to ${payment.payee}`,
      externalReference: payment.reference || undefined, invoiceReference: payment.number,
      idempotencyKey: `bank-payment:${id}`, sourceType: 'bank_payment', sourceId: id,
      lines: [
        { ledgerId: debitLedgerId, side: 'debit', amount: Number(payment.amount).toFixed(4), narration: payment.narration || payment.payee },
        { ledgerId: payment.bank_ledger_id, side: 'credit', amount: Number(payment.amount).toFixed(4), narration: payment.narration || payment.payee },
      ],
    }, actor)

    await client.query(`UPDATE bank_payments SET status='posted', posted_voucher_id=$3, updated_at=now() WHERE company_id=$1 AND id=$2`, [companyId, id, voucher.id])
    await audit(client, companyId, actor.id, 'bank_payment.posted', id, { voucherId: voucher.id }, 'bank_payment')
    return getBankPayment(client, companyId, id)
  })
}

export async function cancelBankPayment(pool: pg.Pool, companyId: string, id: string, actor: Actor, reason?: string) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT * FROM bank_payments WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, id])
    if (!found.rowCount) throw new NotFoundError('Bank payment not found')
    const payment = found.rows[0]
    if (payment.status === 'cancelled') return getBankPayment(client, companyId, id)
    if (payment.status === 'draft') {
      await client.query(`UPDATE bank_payments SET status='cancelled', updated_at=now() WHERE company_id=$1 AND id=$2`, [companyId, id])
    } else {
      await reverseVoucherOnClient(client, companyId, payment.posted_voucher_id, payment.payment_date.toISOString().slice(0, 10), `reverse:bank-payment:${id}`, reason ?? `Cancelling bank payment ${payment.number}`, actor)
      await client.query(`UPDATE bank_payments SET status='cancelled', updated_at=now() WHERE company_id=$1 AND id=$2`, [companyId, id])
    }
    await audit(client, companyId, actor.id, 'bank_payment.cancelled', id, {}, 'bank_payment')
    return getBankPayment(client, companyId, id)
  })
}

export async function setBankPaymentClearance(pool: pg.Pool, companyId: string, id: string, clearance: 'Pending' | 'Cleared', actor: Actor) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT status FROM bank_payments WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, id])
    if (!found.rowCount) throw new NotFoundError('Bank payment not found')
    await client.query(`UPDATE bank_payments SET clearance=$3, updated_at=now() WHERE company_id=$1 AND id=$2`, [companyId, id, clearance])
    await audit(client, companyId, actor.id, 'bank_payment.clearance_changed', id, { clearance }, 'bank_payment')
    return getBankPayment(client, companyId, id)
  })
}
