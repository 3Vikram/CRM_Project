import type { LeadRecord } from './leadApi'
import type { OPFRecord } from './opfApi'

export type Period =
  | 'today'
  | 'thisWeek'
  | 'month'
  | 'quarter'
  | 'year'
  | 'lastWeek'
  | 'lastMonth'
  | 'lastQuarter'
  | 'lastYear'
  | 'all'
  | 'custom'
export type DateRange = { start: Date; end: Date }

export function getPeriodRange(period: Period, now = new Date(), customRange?: DateRange | null): DateRange | null {
  if (period === 'all') return null
  if (period === 'custom') return customRange || null

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'today') {
    const end = new Date(startOfDay)
    end.setDate(end.getDate() + 1)
    return { start: startOfDay, end }
  }

  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))
  if (period === 'thisWeek' || period === 'lastWeek') {
    const start = new Date(startOfWeek)
    if (period === 'lastWeek') start.setDate(start.getDate() - 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }

  if (period === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    }
  }

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    return {
      start: new Date(now.getFullYear(), quarterStartMonth, 1),
      end: new Date(now.getFullYear(), quarterStartMonth + 3, 1),
    }
  }

  if (period === 'lastMonth') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1),
    }
  }

  if (period === 'lastQuarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3 - 3
    return {
      start: new Date(now.getFullYear(), quarterStartMonth, 1),
      end: new Date(now.getFullYear(), quarterStartMonth + 3, 1),
    }
  }

  if (period === 'lastYear') {
    return {
      start: new Date(now.getFullYear() - 1, 0, 1),
      end: new Date(now.getFullYear(), 0, 1),
    }
  }

  return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) }
}

export function getPreviousRange(period: Period, now = new Date(), customRange?: DateRange | null): DateRange | null {
  if (period === 'all') return null
  const current = getPeriodRange(period, now, customRange)
  if (!current) return null

  const duration = current.end.getTime() - current.start.getTime()
  let start = new Date(current.start.getTime() - duration)
  if (period === 'today') {
    start = new Date(current.start)
    start.setDate(start.getDate() - 1)
  } else if (period === 'thisWeek' || period === 'lastWeek') {
    start = new Date(current.start)
    start.setDate(start.getDate() - 7)
  } else if (period === 'month' || period === 'lastMonth') {
    start = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1)
  } else if (period === 'quarter' || period === 'lastQuarter') {
    start = new Date(current.start.getFullYear(), current.start.getMonth() - 3, 1)
  } else if (period === 'year' || period === 'lastYear') {
    start = new Date(current.start.getFullYear() - 1, 0, 1)
  }
  return {
    start,
    end: new Date(current.start),
  }
}

export function toDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string' || !value.trim()) return null

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    if (date.getFullYear() !== Number(dateOnly[1]) || date.getMonth() !== Number(dateOnly[2]) - 1 || date.getDate() !== Number(dateOnly[3])) return null
    return date
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function inRange(value: Date | string | null | undefined, range: DateRange | null): boolean {
  if (!range) return true
  const date = toDate(value)
  return Boolean(date && date >= range.start && date < range.end)
}

export function isOpenStatus(status: string | null | undefined): boolean {
  return !['Won', 'Lost', 'Scrapped'].includes(String(status || ''))
}

export function leadOwner(lead: Pick<LeadRecord, 'assignedTo' | 'createdBy'>): string {
  const assignedTo = lead.assignedTo?.trim()
  return assignedTo && assignedTo !== 'Unassigned' ? assignedTo : lead.createdBy || ''
}

export function getFunnels<T extends Pick<LeadRecord, 'quotationId' | 'leadStatus'>>(leads: T[]): T[] {
  return leads.filter((lead) => Boolean(lead.quotationId || lead.leadStatus))
}

export function getQuotations<T extends Pick<LeadRecord, 'quotationId'>>(leads: T[]): T[] {
  return leads.filter((lead) => Boolean(lead.quotationId))
}

const numeric = (value: number | string | undefined): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getOpfRevenue(opf: OPFRecord): number {
  return numeric(opf.quantity) * numeric(opf.unitPrice) + numeric(opf.serviceCost) + numeric(opf.freightCost)
}

export function getOpfCost(opf: OPFRecord): number {
  return numeric(opf.quantity) * numeric(opf.vendorPrice) + numeric(opf.serviceCost) + numeric(opf.freightCost)
}

export function quotationValue(lead: Pick<LeadRecord, 'products'>): number {
  return (lead.products || []).reduce((total, product) => total + numeric(product.quantity) * numeric(product.unitPrice), 0)
}

export function compareValues(current: number, previous: number): { value: number; previous: number; changePct: number } {
  return {
    value: current,
    previous,
    changePct: previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100,
  }
}

const compactCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCompactCurrency(value: number): string {
  return compactCurrency.format(Number.isFinite(value) ? value : 0)
}
