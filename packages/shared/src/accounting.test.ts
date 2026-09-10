import { describe, expect, it } from 'vitest'
import { CreateMigrationJobSchema, CreateVoucherSchema } from './accounting.js'

const debit = { ledgerId: '11111111-1111-4111-8111-111111111111', side: 'debit' as const, amount: '100.00' }
const credit = { ledgerId: '22222222-2222-4222-8222-222222222222', side: 'credit' as const, amount: '100.00' }

describe('accounting contracts', () => {
  it('accepts a balanced, company-scoped voucher', () => {
    expect(CreateVoucherSchema.parse({
      companyId: '3vikram', voucherType: 'journal', voucherDate: '2026-08-13',
      idempotencyKey: 'journal-0001', lines: [debit, credit],
    }).companyId).toBe('3vikram')
  })

  it('rejects an unbalanced voucher before it reaches persistence', () => {
    expect(() => CreateVoucherSchema.parse({
      companyId: '3vikram', voucherType: 'journal', voucherDate: '2026-08-13',
      idempotencyKey: 'journal-0002', lines: [debit, { ...credit, amount: '99.00' }],
    })).toThrow(/Total debits must equal total credits/)
  })

  it('requires a cutover date for cutover migrations', () => {
    expect(() => CreateMigrationJobSchema.parse({
      companyId: 'synov', sourceType: 'tally', sourceCompany: 'SYNOV IT Services', mode: 'cutover',
    })).toThrow(/Cutover date/)
  })
})
