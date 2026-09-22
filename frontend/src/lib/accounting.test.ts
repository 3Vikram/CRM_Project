import { describe, expect, it } from 'vitest'
import { exportCsv, money, today } from './accounting'

describe('accounting helpers', () => {
  it('formats money as INR', () => {
    expect(money(1234.5)).toContain('1,234.50')
  })
  it('formats money for zero/undefined as zero', () => {
    expect(money(0)).toContain('0.00')
  })
  it('returns an ISO date for today', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('exportCsv triggers a download without throwing', () => {
    // jsdom doesn't implement these; stub them so the test exercises exportCsv's own logic.
    URL.createObjectURL ??= () => 'blob:mock'
    URL.revokeObjectURL ??= () => {}
    expect(() => exportCsv('test.csv', ['A', 'B'], [[1, 'x'], [2, 'y']])).not.toThrow()
  })
})
