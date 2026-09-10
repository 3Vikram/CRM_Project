import type pg from 'pg'
import type { CreateVoucher } from '@crm/shared'
import { assertBalanced } from './money.js'
import { AccountingError, ConflictError, NotFoundError } from './errors.js'
import type { Actor } from './auth.js'

const managementRoles = new Set(['administrator', 'accountant'])

async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result }
  catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
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

export async function createVoucher(pool: pg.Pool, input: CreateVoucher, actor: Actor) {
  assertBalanced(input.lines)
  return transaction(pool, async (client) => {
    const existing = await client.query(`SELECT * FROM vouchers WHERE company_id=$1 AND idempotency_key=$2`, [input.companyId, input.idempotencyKey])
    if (existing.rowCount) return existing.rows[0]
    const financialYearId = await validatePostingContext(client, input)
    const number = await nextVoucherNumber(client, input.companyId, financialYearId, input.voucherType)
    const inserted = await client.query(
      `INSERT INTO vouchers(company_id,financial_year_id,voucher_type,voucher_number,voucher_date,narration,external_reference,idempotency_key,source_type,source_id,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [input.companyId, financialYearId, input.voucherType, number, input.voucherDate, input.narration, input.externalReference ?? null, input.idempotencyKey, input.sourceType, input.sourceId ?? null, actor.id],
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
  })
}

export async function transitionVoucher(pool: pg.Pool, companyId: string, voucherId: string, action: 'submit' | 'approve' | 'post', actor: Actor) {
  return transaction(pool, async (client) => {
    const found = await client.query(`SELECT * FROM vouchers WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, voucherId])
    if (!found.rowCount) throw new NotFoundError('Voucher not found')
    const voucher = found.rows[0]
    const expected = action === 'submit' ? 'draft' : action === 'approve' ? 'submitted' : 'approved'
    if (voucher.status !== expected) throw new ConflictError(`Voucher must be ${expected} before it can be ${action}ed`)
    if (action === 'submit' && voucher.created_by !== actor.id && !managementRoles.has(actor.role)) throw new AccountingError('Only the maker or accounting management may submit this voucher', 403, 'FORBIDDEN')
    if (action === 'approve' && voucher.created_by === actor.id) throw new AccountingError('Maker and approver must be different users', 403, 'MAKER_CHECKER_REQUIRED')
    if (action === 'approve' && actor.role !== 'approver' && !managementRoles.has(actor.role)) throw new AccountingError('Approver role is required', 403, 'FORBIDDEN')
    if (action === 'post' && !managementRoles.has(actor.role)) throw new AccountingError('Accountant or administrator role is required to post', 403, 'FORBIDDEN')
    if (action === 'post') {
      const sums = await client.query<{ debit: string; credit: string }>(`SELECT COALESCE(sum(debit),0)::text debit,COALESCE(sum(credit),0)::text credit FROM voucher_lines WHERE company_id=$1 AND voucher_id=$2`, [companyId, voucherId])
      if (sums.rows[0].debit !== sums.rows[0].credit) throw new AccountingError('Total debits must equal total credits', 422, 'UNBALANCED_VOUCHER')
      const lock = await client.query(`SELECT 1 FROM period_locks WHERE company_id=$1 AND reopened_at IS NULL AND locked_through >= $2 LIMIT 1`, [companyId, voucher.voucher_date])
      if (lock.rowCount) throw new AccountingError('The accounting period is locked', 423, 'PERIOD_LOCKED')
    }
    const status = action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'posted'
    const actorColumn = action === 'submit' ? 'submitted_by' : action === 'approve' ? 'approved_by' : 'posted_by'
    const result = await client.query(`UPDATE vouchers SET status=$3, ${actorColumn}=$4, posted_at=CASE WHEN $3='posted' THEN now() ELSE posted_at END WHERE company_id=$1 AND id=$2 RETURNING *`, [companyId, voucherId, status, actor.id])
    await audit(client, companyId, actor.id, `voucher.${status}`, voucherId)
    return result.rows[0]
  })
}

export async function reverseVoucher(pool: pg.Pool, companyId: string, voucherId: string, reversalDate: string, idempotencyKey: string, reason: string, actor: Actor) {
  return transaction(pool, async (client) => {
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
  })
}

async function audit(client: pg.PoolClient, companyId: string, actorId: string, action: string, entityId: string, metadata: object = {}) {
  await client.query(`INSERT INTO audit_events(company_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'voucher',$4,$5)`, [companyId, actorId, action, entityId, metadata])
}
