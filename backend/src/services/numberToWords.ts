/**
 * INR number-to-words for amounts like "Rupees Sixteen Thousand Nine Hundred
 * Sixteen Only" and paise like "and Forty Eight paise". Deterministic and
 * unit-tested (used by the compute service).
 */
const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
]
const SCALES = ['', 'Thousand', 'Lakh', 'Crore']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const u = n % 10
  return TENS[t] + (u ? ' ' + ONES[u] : '')
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h > 0) parts.push(ONES[h] + ' Hundred')
  if (rest > 0) parts.push(rest < 20 ? ONES[rest] : twoDigits(rest))
  return parts.join(' and ')
}

function intToWords(num: number): string {
  if (num === 0) return 'Zero'
  // Indian grouping: last 3 digits, then groups of 2 (Lakh/Crore)
  const crore = Math.floor(num / 10000000)
  num %= 10000000
  const lakh = Math.floor(num / 100000)
  num %= 100000
  const thousand = Math.floor(num / 1000)
  num %= 1000
  const rest = num
  const parts: string[] = []
  if (crore > 0) parts.push(intToWords(crore) + ' Crore')
  if (lakh > 0) parts.push((lakh < 100 ? twoDigits(lakh) : threeDigits(lakh)) + ' Lakh')
  if (thousand > 0)
    parts.push((thousand < 100 ? twoDigits(thousand) : threeDigits(thousand)) + ' Thousand')
  if (rest > 0) parts.push(rest < 100 ? twoDigits(rest) : threeDigits(rest))
  return parts.join(' ')
}

/**
 * Format a rupee+paise amount as words. Negative amounts are prefixed "Minus".
 * Rounds to the nearest paise.
 */
export function amountInWords(amount: number): string {
  const negative = amount < 0
  const abs = Math.abs(Math.round(amount * 100) / 100)
  const rupees = Math.floor(abs)
  const paise = Math.round((abs - rupees) * 100)
  let words = 'Rupees ' + intToWords(rupees)
  if (paise > 0) {
    words += ' and ' + twoDigits(paise) + ' Paise'
  }
  words += ' Only'
  return (negative ? 'Minus ' : '') + words
}