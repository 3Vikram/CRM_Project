import type pg from 'pg'
import type { CreateVoucher } from '@crm/shared'
import { assertBalanced } from './money.js'
import { AccountingError, ConflictError, NotFoundError } from './errors.js'
import type { Actor } from '../auth/token.js'
import { transaction } from '../db.js'

const managementRoles = new Set(['administrator', 'accountant'])

async function requireMakerChecker(client: pg.PoolClient, companyId: string): Promise<boolean> {
  const result = await client.query<{ require_maker_checker: boolean }>(`SELECT require_maker_checker FROM companies WHERE id=$1`, [companyId])
  return result.rows[0]?.require_maker_checker ?? true
}

async function validatePostingContext(client: pg.PoolClient, voucher: CreateVoucher) {
  const year = await client.query<{ id: string }>(
    `SELECT id FROM financial_years WHERE company_id=$1 AND starts_on <= $2 AND ends_on >= $2 AND closed_at IS NULL`,
    [voucher.companyId, voucher.voucherDate],
  )
  if (!year.rowCount) throw new AccountingError('Voucher date is outside an open financial year', 422, 'FINANCIAL_YEAR_CLOSED')
  const lock = await client.query(`SELECT 1 FROM period_locks WHERE company_id=$1 AND reopened_at IS NULL AND locked_through >= $2 LIMIT 1`, [voucher.companyId, voucher.voucherDate])
  if (lock.rowCount) throw new AccountingError('The accounting period is locked', 423, 'PERIOD_LOCKED')
  const ledgerIds = [...new Set(voucher.lines.map((line) => line.ledgerId))]
  const ledgers = await client.query<{ id: string }>(`SELECT id FROM ledgers WHERE company_id=$1 AND active=true AND id = ANY($2::uuid[])`, [voucher.companyId, ledgerIds])
  if (ledgers.rowCount !== ledgerIds.length) throw new AccountingError('Every ledger must be active and belong to the selected company', 422, 'INVALID_LEDGER')
  if (voucher.voucherType === 'opening') {
    const ineligible = await client.query(`SELECT name FROM ledgers WHERE company_id=$1 AND id=ANY($2::uuid[]) AND opening_balance_eligible=false`, [voucher.companyId, ledgerIds])
    if (ineligible.rowCount) throw new AccountingError('Opening vouchers may use only opening-balance eligible ledgers', 422, 'OPENING_LEDGER_INELIGIBLE')
    const clearing = await client.query(`SELECT 1 FROM ledgers WHERE company_id=$1 AND id=ANY($2::uuid[]) AND name='Migration Clearing'`, [voucher.companyId, ledgerIds])
    if (clearing.rowCount && voucher.narration.trim().length < 10) throw new AccountingError('Opening vouchers using Migration Clearing require an explanation', 422, 'MIGRATION_CLEARING_REASON_REQUIRED')
  }
  return year.rows[0].id
}

async function nextVoucherNumber(client: pg.PoolClient, companyId: string, financialYearId: string, type: string) {
  const result = await client.query<{ next_number: string }>(
    `INSERT INTO voucher_sequences(company_id,financial_year_id,voucher_type,next_number) VALUES($1,$2,$3,2)
     ON CONFLICT(company_id,financial_year_id,voucher_type) DO UPDATE SET next_number=voucher_sequences.next_number+1
     RETURNING next_number-1 AS next_number`, [companyId, financialYearId, type],
  )
  return `${type.toUpperCase().replaceAll('_', '-')}-${String(result.rows[0].next_number).padStart(6, '0')}`
}

/** Inserts a draft voucher and its lines on `client`. Caller controls the transaction. */
async function createVoucherOnClient(client: pg.PoolClient, input: CreateVoucher, actor: Actor) {
  assertBalanced(input.lines)
  const existing = await client.query(`SELECT * FROM vouchers WHERE company_id=$1 AND idempotency_key=$2`, [input.companyId, input.idempotencyKey])
  if (existing.rowCount) return existing.rows[0]
  const financialYearId = await validatePostingContext(client, input)
  const number = await nextVoucherNumber(client, input.companyId, financialYearId, input.voucherType)
  const inserted = await client.query(
    `INSERT INTO vouchers(company_id,financial_year_id,voucher_type,voucher_number,voucher_date,narration,external_reference,invoice_reference,idempotency_key,source_type,source_id,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [input.companyId, financialYearId, input.voucherType, number, input.voucherDate, input.narration, input.externalReference ?? null, input.invoiceReference ?? null, input.idempotencyKey, input.sourceType, input.sourceId ?? null, actor.id],
  )
  for (const [index, line] of input.lines.entries()) {
    await client.query(
      `INSERT INTO voucher_lines(company_id,voucher_id,line_number,ledger_id,debit,credit,narration,party_id,bill_reference,cost_centre_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [input.companyId, inserted.rows[0].id, index + 1, line.ledgerId, line.side === 'debit' ? line.amount : '0', line.side === 'credit' ? line.amount : '0', line.narration ?? '', line.partyId ?? null, line.billReference ?? null, line.costCentreId ?? null],
    )
  }
  await audit(client, input.companyId, actor.id, 'voucher.created', inserted.rows[0].id, { number })
  return inserted.rows[0]
}

export async function createVoucher(pool: pg.Pool, input: CreateVoucher, actor: Actor) {
  return transaction(pool, (client) => createVoucherOnClient(client, input, actor))
}

async function transitionVoucherOnClient(client: pg.PoolClient, companyId: string, voucherId: string, action: 'submit' | 'approve' | 'post', actor: Actor, opts: { skipMakerChecker?: boolean } = {}) {
  const found = await client.query(`SELECT * FROM vouchers WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, voucherId])
  if (!found.rowCount) throw new NotFoundError('Voucher not found')
  const voucher = found.rows[0]
  const expected = action === 'submit' ? 'draft' : action === 'approve' ? 'submitted' : 'approved'
  if (voucher.status !== expected) throw new ConflictError(`Voucher must be ${expected} before it can be ${action}ed`)
  if (action === 'submit' && voucher.created_by !== actor.id && !managementRoles.has(actor.role)) throw new AccountingError('Only the maker or accounting management may submit this voucher', 403, 'FORBIDDEN')
  const selfApproving = action === 'approve' && voucher.created_by === actor.id
  if (selfApproving && !opts.skipMakerChecker) throw new AccountingError('Maker and approver must be different users', 403, 'MAKER_CHECKER_REQUIRED')
  if (action === 'approve' && !opts.skipMakerChecker && actor.role !== 'approver' && !managementRoles.has(actor.role)) throw new AccountingError('Approver role is required', 403, 'FORBIDDEN')
  if (action === 'post' && !managementRoles.has(actor.role)) throw new AccountingError('Accountant or administrator role is required to post', 403, 'FORBIDDEN')
  if (action === 'post') {
    const sums = await client.query<{ debit: string; credit: string }>(`SELECT COALESCE(sum(debit),0)::text debit,COALESCE(sum(credit),0)::text credit FROM voucher_lines WHERE company_id=$1 AND voucher_id=$2`, [companyId, voucherId])
    if (sums.rows[0].debit !== sums.rows[0].credit) throw new AccountingError('Total debits must equal total credits', 422, 'UNBALANCED_VOUCHER')
    const lock = await client.query(`SELECT 1 FROM period_locks WHERE company_id=$1 AND reopened_at IS NULL AND locked_through >= $2 LIMIT 1`, [companyId, voucher.voucher_date])
    if (lock.rowCount) throw new AccountingError('The accounting period is locked', 423, 'PERIOD_LOCKED')
  }
  const status = action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'posted'
  const actorColumn = action === 'submit' ? 'submitted_by' : action === 'approve' ? 'approved_by' : 'posted_by'
  const result = await client.query(`UPDATE vouchers SET status=$3::voucher_status, ${actorColumn}=$4, posted_at=CASE WHEN $3::text='posted' THEN now() ELSE posted_at END WHERE company_id=$1 AND id=$2 RETURNING *`, [companyId, voucherId, status, actor.id])
  await audit(client, companyId, actor.id, selfApproving ? 'voucher.self_approved' : `voucher.${status}`, voucherId)
  return result.rows[0]
}

export async function transitionVoucher(pool: pg.Pool, companyId: string, voucherId: string, action: 'submit' | 'approve' | 'post', actor: Actor) {
  return transaction(pool, (client) => transitionVoucherOnClient(client, companyId, voucherId, action, actor))
}

/**
 * Runs submit → approve → post in one transaction for a single draft voucher.
 * Only `administrator`/`accountant` may use it, and only when the company has
 * `require_maker_checker = false` — otherwise the normal three-step workflow applies.
 */
export async function postDirect(pool: pg.Pool, companyId: string, voucherId: string, actor: Actor) {
  if (!managementRoles.has(actor.role)) throw new AccountingError('Accountant or administrator role is required to post', 403, 'FORBIDDEN')
  return transaction(pool, async (client) => {
    const makerChecker = await requireMakerChecker(client, companyId)
    if (makerChecker) throw new AccountingError('This company requires maker-checker approval; use submit/approve/post', 409, 'MAKER_CHECKER_REQUIRED')
    await transitionVoucherOnClient(client, companyId, voucherId, 'submit', actor, { skipMakerChecker: true })
    await transitionVoucherOnClient(client, companyId, voucherId, 'approve', actor, { skipMakerChecker: true })
    return transitionVoucherOnClient(client, companyId, voucherId, 'post', actor, { skipMakerChecker: true })
  })
}

/**
 * Creates a voucher and immediately posts it, in one transaction. Used by
 * document posting (purchase invoices, bank payments, sales invoices) —
 * the same single-click "Post" flow as `postDirect`, and gated by the same
 * `companies.require_maker_checker` flag and `administrator`/`accountant` role check.
 */
export async function createAndPostVoucherOnClient(client: pg.PoolClient, input: CreateVoucher, actor: Actor) {
  if (!managementRoles.has(actor.role)) throw new AccountingError('Accountant or administrator role is required to post', 403, 'FORBIDDEN')
  const makerChecker = await requireMakerChecker(client, input.companyId)
  if (makerChecker) throw new AccountingError('This company requires maker-checker approval; use submit/approve/post', 409, 'MAKER_CHECKER_REQUIRED')
  const voucher = await createVoucherOnClient(client, input, actor)
  if (voucher.status === 'posted') return voucher
  await transitionVoucherOnClient(client, input.companyId, voucher.id, 'submit', actor, { skipMakerChecker: true })
  await transitionVoucherOnClient(client, input.companyId, voucher.id, 'approve', actor, { skipMakerChecker: true })
  return transitionVoucherOnClient(client, input.companyId, voucher.id, 'post', actor, { skipMakerChecker: true })
}

export async function reverseVoucherOnClient(client: pg.PoolClient, companyId: string, voucherId: string, reversalDate: string, idempotencyKey: string, reason: string, actor: Actor) {
  {
    const original = await client.query(`SELECT * FROM vouchers WHERE company_id=$1 AND id=$2 AND status='posted' FOR SHARE`, [companyId, voucherId])
    if (!original.rowCount) throw new NotFoundError('Posted voucher not found')
    const existing = await client.query(`SELECT * FROM vouchers WHERE company_id=$1 AND source_type='reversal' AND source_id=$2`, [companyId, voucherId])
    if (existing.rowCount) return existing.rows[0]
    const lines = await client.query<{ ledger_id: string; debit: string; credit: string; narration: string; party_id: string | null; bill_reference: string | null; cost_centre_id: string | null }>(`SELECT ledger_id,debit::text,credit::text,narration,party_id,bill_reference,cost_centre_id FROM voucher_lines WHERE company_id=$1 AND voucher_id=$2 ORDER BY line_number`, [companyId, voucherId])
    const input: CreateVoucher = { companyId, voucherType: 'reversal', voucherDate: reversalDate, narration: reason, idempotencyKey, sourceType: 'reversal', sourceId: voucherId, lines: lines.rows.map((line) => ({ ledgerId: line.ledger_id, side: Number(line.debit) > 0 ? 'credit' : 'debit', amount: Number(line.debit) > 0 ? line.debit : line.credit, narration: line.narration, ...(line.party_id ? { partyId: line.party_id } : {}), ...(line.bill_reference ? { billReference: line.bill_reference } : {}), ...(line.cost_centre_id ? { costCentreId: line.cost_centre_id } : {}) })) }
    assertBalanced(input.lines)
    const financialYearId = await validatePostingContext(client, input)
    const number = await nextVoucherNumber(client, companyId, financialYearId, 'reversal')
    const reversed = await client.query(`INSERT INTO vouchers(company_id,financial_year_id,voucher_type,voucher_number,voucher_date,status,narration,idempotency_key,source_type,source_id,created_by,approved_by) VALUES($1,$2,'reversal',$3,$4,'draft',$5,$6,'reversal',$7,$8,$8) RETURNING *`, [companyId, financialYearId, number, reversalDate, reason, idempotencyKey, voucherId, actor.id])
    for (const [index, line] of input.lines.entries()) await client.query(`INSERT INTO voucher_lines(company_id,voucher_id,line_number,ledger_id,debit,credit,narration,party_id,bill_reference,cost_centre_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [companyId, reversed.rows[0].id, index + 1, line.ledgerId, line.side === 'debit' ? line.amount : '0', line.side === 'credit' ? line.amount : '0', line.narration ?? '', line.partyId ?? null, line.billReference ?? null, line.costCentreId ?? null])
    const posted = await client.query(`UPDATE vouchers SET status='posted',posted_by=$3,posted_at=now() WHERE company_id=$1 AND id=$2 RETURNING *`, [companyId, reversed.rows[0].id, actor.id])
    await audit(client, companyId, actor.id, 'voucher.reversed', voucherId, { reversalVoucherId: reversed.rows[0].id, reason })
    return posted.rows[0]
  }
}

export async function reverseVoucher(pool: pg.Pool, companyId: string, voucherId: string, reversalDate: string, idempotencyKey: string, reason: string, actor: Actor) {
  return transaction(pool, (client) => reverseVoucherOnClient(client, companyId, voucherId, reversalDate, idempotencyKey, reason, actor))
}

export async function audit(client: pg.PoolClient, companyId: string | null, actorId: string, action: string, entityId: string, metadata: object = {}, entityType = 'voucher') {
  await client.query(`INSERT INTO audit_events(company_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)`, [companyId, actorId, action, entityType, entityId, metadata])
}

const VOUCHER_LIST_SELECT = `
  SELECT v.id, v.company_id "companyId", v.voucher_type "voucherType", v.voucher_number "voucherNumber",
    v.voucher_date::text "voucherDate", v.status, v.narration, v.external_reference "externalReference",
    v.invoice_reference "invoiceReference", v.source_type "sourceType", v.source_id "sourceId",
    v.created_by "createdBy", v.created_at "createdAt",
    COALESCE((SELECT json_agg(json_build_object(
      'id', vl.id, 'ledgerId', vl.ledger_id, 'debit', vl.debit, 'credit', vl.credit, 'narration', vl.narration
    ) ORDER BY vl.line_number) FROM voucher_lines vl WHERE vl.company_id = v.company_id AND vl.voucher_id = v.id), '[]') AS lines
  FROM vouchers v
`
type Queryable = Pick<pg.Pool, 'query'>

export async function listVouchers(db: Queryable, companyId: string, voucherType?: string) {
  const result = voucherType
    ? await db.query(`${VOUCHER_LIST_SELECT} WHERE v.company_id=$1 AND v.voucher_type=$2 ORDER BY v.voucher_date DESC, v.created_at DESC`, [companyId, voucherType])
    : await db.query(`${VOUCHER_LIST_SELECT} WHERE v.company_id=$1 ORDER BY v.voucher_date DESC, v.created_at DESC`, [companyId])
  return result.rows
}

/** Replaces a draft voucher's lines/header in place. Only 'draft' vouchers may be edited (posted ones are immutable by trigger). */
export async function updateDraftVoucher(pool: pg.Pool, companyId: string, voucherId: string, input: CreateVoucher, actor: Actor) {
  return transaction(pool, async (client) => {
    assertBalanced(input.lines)
    const found = await client.query(`SELECT status FROM vouchers WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, voucherId])
    if (!found.rowCount) throw new NotFoundError('Voucher not found')
    if (found.rows[0].status !== 'draft') throw new ConflictError('Only draft vouchers can be edited')
    await validatePostingContext(client, input)
    await client.query(
      `UPDATE vouchers SET voucher_date=$3,narration=$4,external_reference=$5,invoice_reference=$6 WHERE company_id=$1 AND id=$2`,
      [companyId, voucherId, input.voucherDate, input.narration, input.externalReference ?? null, input.invoiceReference ?? null],
    )
    await client.query(`DELETE FROM voucher_lines WHERE company_id=$1 AND voucher_id=$2`, [companyId, voucherId])
    for (const [index, line] of input.lines.entries()) {
      await client.query(
        `INSERT INTO voucher_lines(company_id,voucher_id,line_number,ledger_id,debit,credit,narration,party_id,bill_reference,cost_centre_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [companyId, voucherId, index + 1, line.ledgerId, line.side === 'debit' ? line.amount : '0', line.side === 'credit' ? line.amount : '0', line.narration ?? '', line.partyId ?? null, line.billReference ?? null, line.costCentreId ?? null],
      )
    }
    await audit(client, companyId, actor.id, 'voucher.updated', voucherId)
    const result = await client.query(`${VOUCHER_LIST_SELECT} WHERE v.company_id=$1 AND v.id=$2`, [companyId, voucherId])
    return result.rows[0]
  })
}

/** Deletes a draft voucher outright — it never posted, so it has no ledger impact to reverse. */
export async function deleteDraftVoucher(pool: pg.Pool, companyId: string, voucherId: string, actor: Actor) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT status FROM vouchers WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, voucherId])
    if (!found.rowCount) throw new NotFoundError('Voucher not found')
    if (found.rows[0].status !== 'draft') throw new ConflictError('Only draft vouchers can be cancelled this way; reverse a posted voucher instead')
    await client.query(`DELETE FROM voucher_lines WHERE company_id=$1 AND voucher_id=$2`, [companyId, voucherId])
    await client.query(`DELETE FROM vouchers WHERE company_id=$1 AND id=$2`, [companyId, voucherId])
    await audit(client, companyId, actor.id, 'voucher.deleted', voucherId)
  })
}
