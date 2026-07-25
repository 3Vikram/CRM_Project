/** Today as `YYYY-MM-DD` in local time. */
export function todayISO(): string {
  const d = new Date()
  return toISO(d)
}

/** Previous full calendar month as `{ from, to }` ISO dates. */
export function previousFullMonth(): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-based
  // shift to start of current month, then subtract one day -> end of prev month
  const to = new Date(year, month, 0) // day 0 = last day of prev month
  const from = new Date(to.getFullYear(), to.getMonth(), 1)
  return { from: toISO(from), to: toISO(to) }
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Format an ISO date as `DD-Mmm-YY` like the reference invoices (e.g. 31-Dec-25). */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function formatDDMonYY(iso: string | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const day = m[3].replace(/^0/, '')
  const mon = MONTHS[Number(m[2]) - 1]
  const yy = m[1].slice(-2)
  return `${day}-${mon}-${yy}`
}

/** Format a billing-month `{from,to}` as "Month YYYY" for remarks, e.g. "June 2026". */
const MONTHSLONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
export function billingMonthLabel(range: { from: string; to: string }): string {
  const m = range.from.match(/^(\d{4})-(\d{2})/)
  if (!m) return ''
  return `${MONTHSLONG[Number(m[2]) - 1]} ${m[1]}`
}