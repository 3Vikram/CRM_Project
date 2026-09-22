import type pg from 'pg'

export async function trialBalance(pool: pg.Pool, companyId: string, to: string) {
  const result = await pool.query(
    `SELECT l.id "ledgerId",l.code,l.name,l.nature,l.current_classification "currentClassification",l.schedule_iii_map "scheduleIIIMap",
      COALESCE(sum(vl.debit) FILTER (WHERE v.id IS NOT NULL),0)::text debit,
      COALESCE(sum(vl.credit) FILTER (WHERE v.id IS NOT NULL),0)::text credit,
      (COALESCE(sum(vl.debit) FILTER (WHERE v.id IS NOT NULL),0)-COALESCE(sum(vl.credit) FILTER (WHERE v.id IS NOT NULL),0))::text balance
     FROM ledgers l LEFT JOIN voucher_lines vl ON vl.company_id=l.company_id AND vl.ledger_id=l.id
     LEFT JOIN vouchers v ON v.company_id=vl.company_id AND v.id=vl.voucher_id AND v.status='posted' AND v.voucher_date <= $2
     WHERE l.company_id=$1
     GROUP BY l.id,l.code,l.name,l.nature,l.current_classification,l.schedule_iii_map ORDER BY l.code,l.name`,
    [companyId, to],
  )
  const rows = result.rows.map((row) => ({ ...row, debit: row.debit ?? '0', credit: row.credit ?? '0', balance: row.balance ?? '0' }))
  const debit = rows.reduce((sum, row) => sum + Number(row.debit), 0)
  const credit = rows.reduce((sum, row) => sum + Number(row.credit), 0)
  return { companyId, asOf: to, rows, totals: { debit: debit.toFixed(4), credit: credit.toFixed(4), balanced: Math.abs(debit - credit) < 0.0001 } }
}

export async function ledgerReport(pool: pg.Pool, companyId: string, ledgerId: string, from: string | undefined, to: string) {
  const result = await pool.query(
    `SELECT v.id "voucherId",v.voucher_number "voucherNumber",v.voucher_type "voucherType",v.voucher_date::text "voucherDate",v.narration "voucherNarration",
      v.invoice_reference "invoiceReference",v.external_reference "externalReference",
      vl.line_number "lineNumber",vl.debit::text,vl.credit::text,vl.narration,vl.bill_reference "billReference",
      sum(vl.debit-vl.credit) OVER (ORDER BY v.voucher_date,v.created_at,vl.line_number)::text "runningBalance",
      CASE v.source_type
        WHEN 'purchase_invoice' THEN 'Purchase Invoice'
        WHEN 'bank_payment' THEN 'Bank Payment'
        WHEN 'sales_invoice' THEN 'Sale Invoice'
        WHEN 'legacy_browser' THEN 'Imported'
        ELSE 'Journal Register'
      END AS source,
      COALESCE(pi.vendor, bp.payee, si.buyer_name, '') AS party
     FROM voucher_lines vl JOIN vouchers v ON v.company_id=vl.company_id AND v.id=vl.voucher_id
     LEFT JOIN purchase_invoices pi ON pi.company_id=v.company_id AND pi.id = CASE WHEN v.source_type='purchase_invoice' AND v.source_id ~ '^[0-9a-f-]{36}$' THEN v.source_id::uuid END
     LEFT JOIN bank_payments bp ON bp.company_id=v.company_id AND bp.id = CASE WHEN v.source_type='bank_payment' AND v.source_id ~ '^[0-9a-f-]{36}$' THEN v.source_id::uuid END
     LEFT JOIN sales_invoices si ON si.company_id=v.company_id AND si.id = CASE WHEN v.source_type='sales_invoice' AND v.source_id ~ '^[0-9a-f-]{36}$' THEN v.source_id::uuid END
     WHERE vl.company_id=$1 AND vl.ledger_id=$2 AND v.status='posted' AND v.voucher_date <= $4 AND ($3::date IS NULL OR v.voucher_date >= $3)
     ORDER BY v.voucher_date,v.created_at,vl.line_number`, [companyId, ledgerId, from ?? null, to],
  )
  return { companyId, ledgerId, from: from ?? null, to, rows: result.rows }
}

export async function profitAndLoss(pool: pg.Pool, companyId: string, from: string | undefined, to: string) {
  const result = await pool.query(
    `SELECT l.id "ledgerId",l.code,l.name,l.nature,l.schedule_iii_map "scheduleIIIMap",
      CASE WHEN l.nature='income' THEN sum(vl.credit-vl.debit) ELSE sum(vl.debit-vl.credit) END::text amount
     FROM voucher_lines vl JOIN vouchers v ON v.company_id=vl.company_id AND v.id=vl.voucher_id
     JOIN ledgers l ON l.company_id=vl.company_id AND l.id=vl.ledger_id
     WHERE vl.company_id=$1 AND v.status='posted' AND l.nature IN ('income','expense')
       AND v.voucher_date <= $3 AND ($2::date IS NULL OR v.voucher_date >= $2)
     GROUP BY l.id,l.code,l.name,l.nature,l.schedule_iii_map ORDER BY l.nature,l.code`, [companyId, from ?? null, to],
  )
  const income = result.rows.filter((row) => row.nature === 'income').reduce((sum, row) => sum + Number(row.amount), 0)
  const expenses = result.rows.filter((row) => row.nature === 'expense').reduce((sum, row) => sum + Number(row.amount), 0)
  return { companyId, from: from ?? null, to, rows: result.rows, totals: { income: income.toFixed(4), expenses: expenses.toFixed(4), profit: (income - expenses).toFixed(4) } }
}

async function balanceSheetAt(pool: pg.Pool, companyId: string, asOf: string) {
  const result = await pool.query(
    `SELECT l.id "ledgerId",l.code,l.name,l.nature,l.current_classification "currentClassification",l.schedule_iii_map "scheduleIIIMap",
      CASE WHEN l.nature='asset' THEN sum(vl.debit-vl.credit) ELSE sum(vl.credit-vl.debit) END::text amount
     FROM voucher_lines vl JOIN vouchers v ON v.company_id=vl.company_id AND v.id=vl.voucher_id
     JOIN ledgers l ON l.company_id=vl.company_id AND l.id=vl.ledger_id
     WHERE vl.company_id=$1 AND v.status='posted' AND v.voucher_date <= $2 AND l.nature IN ('asset','liability','equity')
     GROUP BY l.id,l.code,l.name,l.nature,l.current_classification,l.schedule_iii_map ORDER BY l.nature,l.current_classification,l.code`, [companyId, asOf],
  )
  const profitResult = await pool.query<{ profit: string }>(
    `SELECT COALESCE(sum(CASE WHEN l.nature='income' THEN vl.credit-vl.debit WHEN l.nature='expense' THEN vl.credit-vl.debit ELSE 0 END),0)::text profit
     FROM voucher_lines vl JOIN vouchers v ON v.company_id=vl.company_id AND v.id=vl.voucher_id
     JOIN ledgers l ON l.company_id=vl.company_id AND l.id=vl.ledger_id
     WHERE vl.company_id=$1 AND v.status='posted' AND v.voucher_date <= $2`, [companyId, asOf],
  )
  const profit = Number(profitResult.rows[0].profit)
  const assets = result.rows.filter((row) => row.nature === 'asset').reduce((sum, row) => sum + Number(row.amount), 0)
  const liabilities = result.rows.filter((row) => row.nature === 'liability').reduce((sum, row) => sum + Number(row.amount), 0)
  const equityBeforeProfit = result.rows.filter((row) => row.nature === 'equity').reduce((sum, row) => sum + Number(row.amount), 0)
  const equity = equityBeforeProfit + profit
  return { asOf, rows: result.rows, currentYearProfit: profit.toFixed(4), totals: { assets: assets.toFixed(4), liabilities: liabilities.toFixed(4), equity: equity.toFixed(4), balanced: Math.abs(assets - liabilities - equity) < 0.0001 } }
}

export async function balanceSheet(pool: pg.Pool, companyId: string, asOf: string, compareTo?: string) {
  return { companyId, current: await balanceSheetAt(pool, companyId, asOf), previous: compareTo ? await balanceSheetAt(pool, companyId, compareTo) : null }
}
