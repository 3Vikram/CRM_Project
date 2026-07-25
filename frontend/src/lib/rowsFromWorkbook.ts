import * as XLSX from 'xlsx'
import type { LineItem } from '@crm/shared'

export class WorkbookParseError extends Error {}

const DATE_DD_MM_YYYY = /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/

/** Parse a numeric Excel serial date to an ISO `YYYY-MM-DD`. */
function excelDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'number') {
    // Excel serial with the 1900 leap-year bug; 25569 == 1970-01-01
    const utcDays = Math.floor(value - 25569)
    const ms = utcDays * 86400000
    const d = new Date(ms)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(DATE_DD_MM_YYYY)
  if (m) {
    const day = m[1].padStart(2, '0')
    const mon = m[2].padStart(2, '0')
    let year = m[3]
    if (year.length === 2) year = '20' + year
    return `${year}-${mon}-${day}`
  }
  return undefined
}

function normHeader(s: unknown): string {
  return String(s ?? '').trim().toUpperCase()
}

function normKeyMatch(key: string, header: string): boolean {
  // SheetJS suffixes duplicate column names with `_1`, `_2`, … and the source
  // headers carry stray trailing spaces. Compare on a stripped/upper form.
  return normKey(key) === header.toUpperCase()
}

function normKey(key: string): string {
  return key.trim().toUpperCase().replace(/_+\d+$/, '').trim()
}

/**
 * The workbook reuses "SL. NO." for both the row index (col A) and the
 * laptop serial (col H); SheetJS suffixes the duplicate as "SL. NO._1".
 * The serial column is the occurrence whose value is alphanumeric.
 */
function pickSerial(row: Record<string, unknown>): unknown {
  const pair = Object.entries(row).filter(([k]) => normKeyMatch(k, 'SL. NO.'))
  if (pair.length === 0) return undefined
  if (pair.length === 1) return pair[0][1]
  // Prefer the value that looks like an alphanumeric serial over a row index.
  const alnum = pair.map(([, v]) => v).find((v) => /[A-Za-z]/.test(String(v)))
  return alnum ?? pair[1][1]
}

function get<T = unknown>(row: Record<string, unknown>, header: string): T {
  const found = Object.entries(row).find(([k]) => normKeyMatch(k, header))
  return (found ? found[1] : undefined) as T
}

/**
 * Pure parser: workbook bytes -> candidate `LineItem[]`. No React, no DOM.
 * Reads `Sheet1` only, validates the header shape, and strips the
 * privacy-sensitive PERSON / COURIER / CONTACT NO columns (never carried).
 */
export function rowsFromWorkbook(bytes: Uint8Array | ArrayBuffer): LineItem[] {
  const buf = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  if (!wb.SheetNames.includes('Sheet1')) {
    throw new WorkbookParseError('Workbook is missing the expected "Sheet1" tab.')
  }
  const sheet = wb.Sheets['Sheet1']
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: '',
  })

  if (rows.length === 0) {
    throw new WorkbookParseError('Sheet1 is empty.')
  }

  const required = [
    'DC.NO.', 'MAKE', 'MODEL', 'CONFIGURATION', 'PRICE', 'RETURNED', 'COMPANY',
  ]
  const presentHeaders = Object.keys(rows[0])
  const present = new Set(presentHeaders.map(normHeader))
  for (const h of required) {
    if (!present.has(h)) {
      throw new WorkbookParseError(
        `Sheet1 is missing the expected column "${h}". Parsed headers: ${presentHeaders.join(', ')}`,
      )
    }
  }

  const items: LineItem[] = []
  rows.forEach((row, idx) => {
    const slRaw = get(row, 'SL. NO.')
    const sl = Number(slRaw)
    const rowRef = Number.isFinite(sl) ? sl : idx + 1
    const make = String(get(row, 'MAKE') ?? '').trim()
    const model = String(get(row, 'MODEL') ?? '').trim()
    const serial = String(pickSerial(row) ?? '').trim()
    const configuration = String(get(row, 'CONFIGURATION') ?? '').trim()
    const priceRaw = get(row, 'PRICE')
    const price = Number(priceRaw ?? 0)
    const monthsRaw = get(row, 'MONTHS')
    const months =
      monthsRaw === '' || monthsRaw == null ? undefined : Number(monthsRaw)
    const returnedText = String(get(row, 'RETURNED') ?? '').trim()
    const isReturned = returnedText.length > 0
    const company = String(get(row, 'COMPANY') ?? '').trim().toUpperCase()

    if (!make && !model && !serial && !configuration) return

    const returnedDate = isReturned ? parseReturnedDate(returnedText) : undefined

    items.push({
      rowRef,
      make,
      model,
      serial,
      configuration,
      price: Number.isFinite(price) ? price : 0,
      quantity: 1,
      from: undefined,
      to: returnedDate,
      isReturned,
      amount: Number.isFinite(price) ? price : 0,
      months: Number.isFinite(months as number) ? (months as number) : undefined,
      company,
    })
  })

  return items
}

/** Extract a `dd-mm-yyyy` date from "RETURNED ON 22-05-2026". */
function parseReturnedDate(s: string): string | undefined {
  const m = s.match(DATE_DD_MM_YYYY)
  if (!m) return undefined
  const day = m[1].padStart(2, '0')
  const mon = m[2].padStart(2, '0')
  let year = m[3]
  if (year.length === 2) year = '20' + year
  return `${year}-${mon}-${day}`
}

export { excelDate }