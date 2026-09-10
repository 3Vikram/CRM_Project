import { AccountingError } from './errors.js'

export function toMinorUnits(value: string, scale = 4): bigint {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) throw new AccountingError(`Invalid decimal amount: ${value}`)
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'))
}

export function assertBalanced(lines: Array<{ side: 'debit' | 'credit'; amount: string }>) {
  const debit = lines.filter((line) => line.side === 'debit').reduce((sum, line) => sum + toMinorUnits(line.amount), 0n)
  const credit = lines.filter((line) => line.side === 'credit').reduce((sum, line) => sum + toMinorUnits(line.amount), 0n)
  if (debit !== credit) throw new AccountingError('Total debits must equal total credits', 422, 'UNBALANCED_VOUCHER')
}
