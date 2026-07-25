import type { LineItem, LineItemMember } from '@crm/shared'

/**
 * Grouping key: (MAKE, MODEL, PRICE). `CONFIGURATION` is intentionally
 * excluded — it drifts by trim (WIN11 vs WIN11PRO, BOXPIECE present/absent)
 * and would otherwise prevent legitimate groups.
 */
function groupKey(r: LineItem): string {
  return `${r.make.trim().toLowerCase()}|${r.model.trim().toLowerCase()}|${r.price}`
}

/**
 * Collapse **non-returned** rows whose `(MAKE, MODEL, PRICE)` match into one
 * "N Pcs @ PRICE" line. Returned rows stay as individual lines so a return
 * is always visible (never absorbed into a "N Pcs" total). Each grouped line
 * stacks its constituent units' serial / configuration / From-To as
 * `members`, rendered as sub-lines beneath the group.
 *
 * Pure: no React, no DOM.
 */
export function groupIdentical(rows: LineItem[]): LineItem[] {
  const returned = rows.filter((r) => r.isReturned)
  const nonReturned = rows.filter((r) => !r.isReturned)

  const buckets = new Map<string, LineItem[]>()
  const order: string[] = []
  for (const r of nonReturned) {
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
    if (members.length === 1) {
      return { ...first, members: toMembers(members) }
    }
    const serials = members.map((m) => String(m.serial))
    const amount = round2(members.reduce((a, m) => a + m.amount, 0))
    const discount = members.reduce((a, m) => a + (m.discount ?? 0), 0)
    return {
      rowRef: first.rowRef,
      make: first.make,
      model: first.model,
      serial: serials,
      configuration: members.map((m) => m.configuration).join(' / '),
      price: first.price,
      quantity: members.length,
      from: first.from,
      to: first.to,
      isReturned: false,
      amount,
      discount: discount > 0 ? discount : undefined,
      months: undefined,
      company: first.company,
      members: toMembers(members),
    }
  })

  // Stable order: keep the returned rows in their original positions relative
  // to the grouped buckets by rowRef. Simplest sane order: grouped first by
  // rowRef, then returned by rowRef — preserves a stable appearance.
  returned.sort((a, b) => a.rowRef - b.rowRef)
  grouped.sort((a, b) => a.rowRef - b.rowRef)
  return [...grouped, ...returned]
}

function toMembers(rows: LineItem[]): LineItemMember[] {
  return rows.map((r) => ({
    rowRef: r.rowRef,
    serial: String(r.serial),
    configuration: r.configuration,
    from: r.from,
    to: r.to,
    isReturned: r.isReturned,
  }))
}

/** Expand grouped lines back to flat rows (one laptop per line). */
export function flattenLines(rows: LineItem[]): LineItem[] {
  const out: LineItem[] = []
  for (const r of rows) {
    if (r.members && r.members.length > 1) {
      for (const m of r.members) {
        out.push({
          rowRef: m.rowRef,
          make: r.make,
          model: r.model,
          serial: m.serial,
          configuration: m.configuration,
          price: r.price,
          quantity: 1,
          from: m.from,
          to: m.to,
          isReturned: m.isReturned,
          amount: r.price,
          company: r.company,
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