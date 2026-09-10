import type { LineItem, LineItemMember } from '@crm/shared'

/**
 * Grouping key: (MAKE, MODEL, CONFIGURATION, PRICE). The configuration is
 * normalized for whitespace/case only, so one configuration can contain many
 * serial numbers without merging genuinely different configurations.
 */
function groupKey(r: LineItem): string {
  const config = r.configuration.trim().replace(/\s+/g, ' ').toLowerCase()
  return `${(r.company ?? '').trim().toLowerCase()}|${r.make.trim().toLowerCase()}|${r.model.trim().toLowerCase()}|${config}|${r.price}`
}

/**
 * Collapse rows whose `(MAKE, MODEL, CONFIGURATION, PRICE)` match into one
 * configuration line. Each member keeps its own amount and returned state, so
 * a returned serial can be part-billed inside the same configuration group.
 *
 * Pure: no React, no DOM.
 */
export function groupIdentical(rows: LineItem[]): LineItem[] {
  const buckets = new Map<string, LineItem[]>()
  const order: string[] = []
  for (const r of flattenLines(rows)) {
    const k = groupKey(r)
    if (!buckets.has(k)) {
      buckets.set(k, [])
      order.push(k)
    }
    buckets.get(k)!.push(r)
  }

  const grouped: LineItem[] = order.map((k) => {
    const members = buckets.get(k)!
    const first = members[0]
    const serials = members.map((m) => String(m.serial))
    const amount = round2(members.reduce((a, m) => a + m.amount, 0))
    const discount = members.reduce((a, m) => a + (m.discount ?? 0), 0)
    return {
      rowRef: first.rowRef,
      make: first.make,
      model: first.model,
      serial: serials,
      configuration: first.configuration,
      price: first.price,
      quantity: members.length,
      from: first.from,
      to: first.to,
      isReturned: members.some((m) => m.isReturned),
      amount,
      discount: discount > 0 ? discount : undefined,
      months: undefined,
      company: first.company,
      members: toMembers(members),
    }
  })

  grouped.sort((a, b) => a.rowRef - b.rowRef)
  return grouped
}

function toMembers(rows: LineItem[]): LineItemMember[] {
  return rows.map((r) => ({
    rowRef: r.rowRef,
    make: r.make,
    model: r.model,
    serial: String(r.serial),
    configuration: r.configuration,
    price: r.price,
    amount: r.amount,
    discount: r.discount,
    months: r.months,
    company: r.company,
    from: r.from,
    to: r.to,
    isReturned: r.isReturned,
  }))
}

/** Expand grouped lines back to flat rows (one laptop per line). */
export function flattenLines(rows: LineItem[]): LineItem[] {
  const out: LineItem[] = []
  for (const r of rows) {
    if (r.members && r.members.length > 0) {
      for (const m of r.members) {
        out.push({
          rowRef: m.rowRef,
          make: m.make ?? r.make,
          model: m.model ?? r.model,
          serial: m.serial,
          configuration: m.configuration,
          price: m.price ?? r.price,
          quantity: 1,
          from: m.from,
          to: m.to,
          isReturned: m.isReturned,
          amount: m.amount ?? r.amount / Math.max(r.quantity, 1),
          discount: m.discount,
          months: m.months,
          company: m.company,
        })
      }
    } else {
      out.push({ ...r, serial: Array.isArray(r.serial) ? r.serial[0] ?? '' : r.serial })
    }
  }
  return out
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Days between two ISO dates (inclusive of `to`, so 01→01 = 1). */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00Z').getTime()
  const b = new Date(to + 'T00:00:00Z').getTime()
  if (isNaN(a) || isNaN(b)) return 0
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

/**
 * Returned → prorate: `amount = returnedBillingRate × days(From→To) / 30`,
 * rounded to two decimals. The row's `From` defaults to the billing-month
 * start and `To` to the unit's returned date. The result stays manually
 * editable.
 */
export function prorateReturned(
  row: LineItem,
  opts: { returnedBillingRate: number; billingMonthFrom: string },
): LineItem {
  const from = row.from ?? opts.billingMonthFrom
  const to = row.to ?? from
  const days = daysBetween(from, to)
  const amount = round2((opts.returnedBillingRate * days) / 30)
  return { ...row, from, to, amount }
}
