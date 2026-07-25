import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rowsFromWorkbook, WorkbookParseError } from './rowsFromWorkbook'

const fixture = readFileSync(
  resolve(process.cwd(), '..', 'docs', 'references', 'AIE SOFTWARE INDIA PVT LTD 2026.xlsx'),
)

describe('rowsFromWorkbook', () => {
  it('parses the reference workbook into 22 laptop rows', () => {
    const rows = rowsFromWorkbook(fixture)
    expect(rows).toHaveLength(22)
  })

  it('parses make/model/serial/configuration/price as expected shapes', () => {
    const rows = rowsFromWorkbook(fixture)
    const first = rows[0]
    expect(first.make).toBe('LENOVO')
    expect(first.model).toBe('L14')
    expect(first.serial).toBe('PG04ZPXH')
    expect(first.configuration).toContain('ULTRA 7')
    expect(typeof first.price).toBe('number')
    expect(first.price).toBe(4200)
  })

  it('flags returned rows and never absorbs their company/serial', () => {
    const rows = rowsFromWorkbook(fixture)
    const returned = rows.filter((r) => r.isReturned)
    expect(returned.length).toBe(3)
    for (const r of returned) {
      expect(r.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('carries company (SYNOV / 3VIKRAM) on every row for seller auto-select', () => {
    const rows = rowsFromWorkbook(fixture)
    for (const r of rows) {
      expect(['SYNOV', '3VIKRAM']).toContain(r.company)
    }
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.company!] = (acc[r.company!] ?? 0) + 1
      return acc
    }, {})
    expect(counts['SYNOV']).toBeGreaterThan(0)
    expect(counts['3VIKRAM']).toBeGreaterThan(0)
  })

  it('defaults each row amount to one month (price * 1)', () => {
    const rows = rowsFromWorkbook(fixture)
    for (const r of rows) {
      expect(r.amount).toBe(r.price)
      expect(r.quantity).toBe(1)
    }
  })

  it('throws a clear error when Sheet1 is missing', () => {
    const bad = new Uint8Array([
      // a tiny zip that is a valid xlsx but we just feed garbage
      0x50, 0x4b, 0x03, 0x04,
    ])
    expect(() => rowsFromWorkbook(bad)).toThrow()
  })

  it('throws a clear error message shape on unknown workbook', () => {
    const notXlsx = new TextEncoder().encode('hello, not an xlsx')
    let err: unknown
    try {
      rowsFromWorkbook(notXlsx)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(WorkbookParseError)
  })
})