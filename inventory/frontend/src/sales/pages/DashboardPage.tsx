'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Funnel,
  Package,
  RefreshCw,
  SquareCheckBig,
  Target,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchActivities, type ActivityRecord } from '@/sales/lib/activityApi'
import { fetchCustomers, type CustomerApiRecord } from '@/sales/lib/customerApi'
import { fetchLeads, type LeadRecord } from '@/sales/lib/leadApi'
import { fetchOPFs, type OPFRecord } from '@/sales/lib/opfApi'
import { getStoredAuth } from '@/sales/lib/auth'
import { SectionBoundary } from '@/sales/components/SectionBoundary'
import {
  compareValues,
  formatCompactCurrency,
  getFunnels,
  getOpfCost,
  getOpfRevenue,
  getPeriodRange,
  getPreviousRange,
  getQuotations,
  inRange,
  isOpenStatus,
  leadOwner,
  quotationValue,
  toDate,
  type Period,
} from '@/sales/lib/dashboardData'

type DashboardRecords = {
  leads: LeadRecord[]
  customers: CustomerApiRecord[]
  opfs: OPFRecord[]
  activities: ActivityRecord[]
}

type FollowUpCategory = 'Activity' | 'Funnel' | 'Lead' | 'Renewal'
type FollowUpFilter = 'All' | 'Overdue' | 'Due today' | 'Upcoming'
type FollowUp = {
  id: string
  category: FollowUpCategory
  company: string
  contact: string
  dueDate: Date
}
type LeadWithTimestamps = LeadRecord & { updatedAt?: string; createdAt?: string }
type ActivityPeriod = 'All' | 'Customer' | 'Funnel' | 'Quotation' | 'OPF'
type SalesPeriod = 'all' | 'year' | 'quarter' | 'month'

const EMPTY_RECORDS: DashboardRecords = { leads: [], customers: [], opfs: [], activities: [] }
const periodGroups: Array<{ title: string; options: Array<{ value: Period; label: string }> }> = [
  { title: 'CURRENT', options: [
    { value: 'today', label: 'Today' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
  ] },
  { title: 'PREVIOUS', options: [
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'lastQuarter', label: 'Last Quarter' },
    { value: 'lastYear', label: 'Last Year' },
  ] },
  { title: 'OTHER', options: [
    { value: 'all', label: 'All' },
    { value: 'custom', label: 'Custom' },
  ] },
]
const followUpCategories: FollowUpCategory[] = ['Activity', 'Funnel', 'Lead', 'Renewal']
const followUpFilters: FollowUpFilter[] = ['All', 'Overdue', 'Due today', 'Upcoming']
const T = {
  micro: 'text-[12px]!',
  small: 'text-[13px]!',
  body: 'text-[15px]!',
  title: 'text-[17px]!',
  stat: 'text-[20px]!',
  value: 'text-[28px]!',
  page: 'text-[28px]!',
} as const
const textSizeInPixels = (token: string) => Number(token.slice(6, -2).replace('px', ''))
const palette = {
  blue: '#4F6AF0',
  green: '#22B07D',
  orange: '#F5A94A',
  red: '#EF4444',
  purple: '#7C5CFC',
  ink: '#111827',
  muted: '#64748B',
  line: '#EEF0F4',
  soft: '#F6F7FB',
} as const
const cardClass = 'rounded-lg bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.08)]'
const liftCard = 'transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:animate-none motion-reduce:hover:transform-none'
const chartColors = [palette.blue, palette.green, palette.orange, palette.red, palette.purple, '#38A3A5', '#E879B9', '#8A9AAE']
const dashboardStyle = {
  '--dashboard-blue': palette.blue,
  '--dashboard-green': palette.green,
  '--dashboard-orange': palette.orange,
  '--dashboard-red': palette.red,
  '--dashboard-purple': palette.purple,
  '--dashboard-ink': palette.ink,
  '--dashboard-muted': palette.muted,
  '--dashboard-line': palette.line,
  '--dashboard-soft': palette.soft,
  '--dashboard-body-font-size': `${textSizeInPixels(T.body)}px`,
} as CSSProperties
const salesPeriods: Array<{ value: SalesPeriod; label: string }> = [
  { value: 'all', label: 'All Time' },
  { value: 'year', label: 'This Year' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'month', label: 'This Month' },
]

const numberFormat = new Intl.NumberFormat('en-IN')
const revenueFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: Date): string {
  return `${String(value.getDate()).padStart(2, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${value.getFullYear()}`
}

function latestValidDate(...values: Array<string | Date | null | undefined>): Date | null {
  for (const value of values) {
    const date = toDate(value)
    if (date) return date
  }
  return null
}

function ChangeIndicator({ changePct }: { changePct: number }) {
  const isPositive = changePct >= 0
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`sales-summary-card-change inline-flex items-center gap-0.5 ${T.small} font-semibold ${isPositive ? 'text-[#22B07D]' : 'text-[#EF4444]'}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(changePct).toFixed(1)}%
    </span>
  )
}

function KpiCard({
  title,
  value,
  previous,
  changePct,
  periodLabel,
  previousLabel,
  detailLabel,
  detailValue,
  detailChangePct,
  icon: Icon,
  iconStyle,
  href,
  onNavigate,
}: {
  title: string
  value: number
  previous: number
  changePct: number
  periodLabel: string
  previousLabel: string
  detailLabel: string
  detailValue: string
  detailChangePct: number
  icon: typeof Users
  iconStyle: CSSProperties
  href: string
  onNavigate: (href: string) => void
}) {
  return (
    <SectionBoundary className="min-w-0">
      <div
        role="link"
        tabIndex={0}
        onClick={() => onNavigate(href)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onNavigate(href)
          }
        }}
        aria-label={`${title}: ${numberFormat.format(value)}`}
        className={`sales-summary-card sales-dashboard-kpi-card ${liftCard} flex min-w-0 cursor-pointer items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0]`}
      >
        <span style={iconStyle} className="sales-summary-card-icon shrink-0">
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="sales-summary-card-label">{title}</p>
          <p className="sales-summary-card-value mt-0.5 flex items-center gap-1.5">
            <span>{numberFormat.format(value)}</span>
            <ChangeIndicator changePct={changePct} />
          </p>
          <p className="sales-summary-card-meta mt-0.5">{periodLabel} · {previousLabel}: {numberFormat.format(previous)}</p>
        </div>
        <div className="min-w-0 max-w-[32%] border-l border-slate-200 pl-3 text-right">
          <p className="sales-summary-card-meta font-semibold uppercase" title={detailLabel}>{detailLabel}</p>
          <div className="flex items-center justify-end gap-1">
            <p className="sales-summary-card-detail-value">{detailValue}</p>
            <ChangeIndicator changePct={detailChangePct} />
          </div>
        </div>
      </div>
    </SectionBoundary>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<DashboardRecords>(EMPTY_RECORDS)
  const [period, setPeriod] = useState<Period>('year')
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const periodMenuRef = useRef<HTMLDivElement | null>(null)
  const [employee, setEmployee] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [followUpCategory, setFollowUpCategory] = useState<FollowUpCategory>('Activity')
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('All')
  const [oemPeriod, setOemPeriod] = useState<SalesPeriod>('all')
  const [trendYear, setTrendYear] = useState(new Date().getFullYear())
  const [productsPeriod, setProductsPeriod] = useState<SalesPeriod>('all')
  const [customersPeriod, setCustomersPeriod] = useState<SalesPeriod>('all')
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('All')
  const [closurePage, setClosurePage] = useState(1)

  const auth = getStoredAuth()
  const currentUser = auth?.user
  const userName = currentUser?.name || 'Sales User'
  const employeeType = currentUser?.role === 'admin'
    ? 'Admin'
    : (currentUser?.employeeType || '').toLowerCase() === 'admin'
      ? 'Admin'
      : (currentUser?.employeeType || '').toLowerCase() === 'manager'
        ? 'Manager'
        : 'User'
  const hasFullAccess = currentUser?.role === 'admin' || ['admin', 'manager'].includes((currentUser?.employeeType || '').toLowerCase())
  const effectiveEmployee = hasFullAccess ? employee : userName

  const loadData = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [leadResponse, customerResponse, opfResponse, activityResponse] = await Promise.all([
        fetchLeads({ limit: 1000 }),
        fetchCustomers({ limit: 1000 }),
        fetchOPFs({ limit: 1000 }),
        fetchActivities({ limit: 1000 }),
      ])
      setRecords({
        leads: leadResponse.data || [],
        customers: customerResponse.data || [],
        opfs: opfResponse.data || [],
        activities: activityResponse.data || [],
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Sales dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (!periodMenuOpen) return
    const handleOutsideMouseDown = (event: MouseEvent) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(event.target as Node)) setPeriodMenuOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPeriodMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideMouseDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [periodMenuOpen])

  const employeeOptions = useMemo(() => Array.from(new Set([
    ...records.leads.map(leadOwner),
    ...records.opfs.map((opf) => opf.createdBy || ''),
    ...records.activities.map((activity) => activity.createdBy || ''),
  ].map((name) => name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [records])

  const scopedRecords = useMemo(() => {
    if (effectiveEmployee === 'all') return records
    return {
      leads: records.leads.filter((lead) => leadOwner(lead) === effectiveEmployee),
      customers: records.customers.filter((customer) => customer.createdBy === effectiveEmployee),
      opfs: records.opfs.filter((opf) => opf.createdBy === effectiveEmployee),
      activities: records.activities.filter((activity) => activity.createdBy === effectiveEmployee),
    }
  }, [records, effectiveEmployee])

  const now = new Date()
  const todayKey = dateKey(now)
  const customRange = customStart && customEnd && customStart <= customEnd
    ? {
      start: new Date(`${customStart}T00:00:00`),
      end: new Date(`${customEnd}T00:00:00`),
    }
    : null
  if (customRange) customRange.end.setDate(customRange.end.getDate() + 1)
  const currentRange = getPeriodRange(period, now, customRange)
    || (period === 'custom' ? { start: new Date(8640000000000000), end: new Date(8640000000000000) } : null)
  const previousRange = getPreviousRange(period, now, customRange)
  const funnels = useMemo(() => getFunnels(scopedRecords.leads), [scopedRecords.leads])
  const quotations = useMemo(() => getQuotations(scopedRecords.leads), [scopedRecords.leads])
  const currentFunnels = funnels.filter((lead) => inRange(lead.createdDate, currentRange))
  const previousFunnels = previousRange ? funnels.filter((lead) => inRange(lead.createdDate, previousRange)) : []
  const currentQuotations = quotations.filter((lead) => inRange(lead.createdDate, currentRange))
  const previousQuotations = previousRange ? quotations.filter((lead) => inRange(lead.createdDate, previousRange)) : []
  const currentOpfs = scopedRecords.opfs.filter((opf) => inRange(opf.createdDate, currentRange))
  const previousOpfs = previousRange ? scopedRecords.opfs.filter((opf) => inRange(opf.createdDate, previousRange)) : []
  const currentMeetings = scopedRecords.activities.filter((activity) =>
    activity.activityType === 'Meeting' && inRange(activity.activityDate, currentRange)
  )
  const previousMeetings = previousRange
    ? scopedRecords.activities.filter((activity) => activity.activityType === 'Meeting' && inRange(activity.activityDate, previousRange))
    : []
  const periodRevenue = currentOpfs.reduce((total, opf) => total + getOpfRevenue(opf), 0)
  const previousPeriodRevenue = previousOpfs.reduce((total, opf) => total + getOpfRevenue(opf), 0)
  const selectedPeriod = periodGroups.flatMap((group) => group.options).find((option) => option.value === period)
  const periodLabel = selectedPeriod?.label.toUpperCase() || 'THIS YEAR'
  const previousLabels: Partial<Record<Period, string>> = {
    today: 'Yesterday',
    thisWeek: 'Last Week',
    month: 'Last Month',
    quarter: 'Last Quarter',
    year: 'Last Year',
    lastWeek: 'Week Before',
    lastMonth: 'Month Before',
    lastQuarter: 'Quarter Before',
    lastYear: 'Year Before',
    custom: 'Previous Range',
    all: 'Previous',
  }
  const previousLabel = previousLabels[period] || 'Last Year'
  const kpis = [
    {
      title: 'Opportunities',
      metric: compareValues(currentFunnels.length, previousFunnels.length),
      detailMetric: compareValues(
        currentFunnels.filter((lead) => isOpenStatus(lead.leadStatus)).length,
        previousFunnels.filter((lead) => isOpenStatus(lead.leadStatus)).length,
      ),
      detailLabel: 'Open Opportunities',
      detailValue: numberFormat.format(currentFunnels.filter((lead) => isOpenStatus(lead.leadStatus)).length),
      icon: Target,
      iconStyle: { backgroundColor: '#F3E8FF', color: '#7663A8' },
      href: '/sales/funnels',
    },
    {
      title: 'Quotations',
      metric: compareValues(currentQuotations.length, previousQuotations.length),
      detailMetric: compareValues(
        currentQuotations.filter((lead) => isOpenStatus(lead.leadStatus)).length,
        previousQuotations.filter((lead) => isOpenStatus(lead.leadStatus)).length,
      ),
      detailLabel: 'Open Quotation',
      detailValue: numberFormat.format(currentQuotations.filter((lead) => isOpenStatus(lead.leadStatus)).length),
      icon: FileText,
      iconStyle: { backgroundColor: '#F3E8FF', color: '#7663A8' },
      href: '/sales/quotations',
    },
    {
      title: 'OPFs',
      metric: compareValues(currentOpfs.length, previousOpfs.length),
      detailMetric: compareValues(periodRevenue, previousPeriodRevenue),
      detailLabel: 'OPF Revenue',
      detailValue: formatCompactCurrency(periodRevenue),
      icon: SquareCheckBig,
      iconStyle: { backgroundColor: '#DBEAFE', color: '#3867E8' },
      href: '/sales/opf',
    },
    {
      title: 'Meetings',
      metric: compareValues(currentMeetings.length, previousMeetings.length),
      detailMetric: compareValues(
        currentMeetings.filter((activity) => activity.response === 'Positive').length,
        previousMeetings.filter((activity) => activity.response === 'Positive').length,
      ),
      detailLabel: 'Positive Meetings',
      detailValue: numberFormat.format(currentMeetings.filter((activity) => activity.response === 'Positive').length),
      icon: CalendarDays,
      iconStyle: { backgroundColor: '#DCFCE7', color: '#20B66A' },
      href: '/sales/activities',
    },
  ]

  const selectedPeriodRevenue = periodRevenue
  const previousSelectedPeriodRevenue = previousPeriodRevenue
  const monthlyChange = compareValues(selectedPeriodRevenue, previousSelectedPeriodRevenue)
  const monthShare = previousSelectedPeriodRevenue > 0
    ? Math.min((selectedPeriodRevenue / previousSelectedPeriodRevenue) * 100, 100)
    : 0

  const openTasks = [...scopedRecords.activities]
    .filter((activity) => activity.status !== 'Completed' && inRange(activity.createdAt, currentRange))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
    .slice(0, 5)

  const followUps = useMemo<FollowUp[]>(() => {
    const entries: FollowUp[] = []
    scopedRecords.activities.forEach((activity) => {
      const dueDate = toDate(activity.followUpDate)
      if (activity.status !== 'Completed' && dueDate) {
        entries.push({
          id: `activity-${activity._id}`,
          category: 'Activity',
          company: activity.company || activity.customerName || '—',
          contact: activity.contactPerson || '—',
          dueDate,
        })
      }
    })
    funnels.forEach((lead) => {
      const dueDate = latestValidDate(lead.followUpDate, lead.quotationDetails?.expectedClosure)
      if (isOpenStatus(lead.leadStatus) && dueDate) {
        entries.push({
          id: `funnel-${lead._id}`,
          category: 'Funnel',
          company: lead.companyName || '—',
          contact: lead.contactPerson || '—',
          dueDate,
        })
      }
    })
    scopedRecords.leads.forEach((lead) => {
      const dueDate = toDate(lead.followUpDate)
      if (!lead.quotationId && isOpenStatus(lead.leadStatus) && dueDate) {
        entries.push({
          id: `lead-${lead._id}`,
          category: 'Lead',
          company: lead.companyName || '—',
          contact: lead.contactPerson || '—',
          dueDate,
        })
      }
    })
    scopedRecords.opfs.forEach((opf) => {
      const dueDate = latestValidDate(opf.amcRenewalDate, opf.renewalDate)
      if (opf.amc?.toLowerCase() === 'yes' && dueDate) {
        entries.push({
          id: `renewal-${opf._id}`,
          category: 'Renewal',
          company: opf.customerName || '—',
          contact: opf.contactPerson || '—',
          dueDate,
        })
      }
    })
    return entries
      .filter((entry) => inRange(entry.dueDate, currentRange))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [scopedRecords, funnels, currentRange])

  const categoryFollowUps = followUps.filter((followUp) => followUp.category === followUpCategory)
  const categoryCounts = Object.fromEntries(followUpCategories.map((category) => [
    category,
    followUps.filter((followUp) => followUp.category === category).length,
  ])) as Record<FollowUpCategory, number>
  const overdueCount = followUps.filter((followUp) => dateKey(followUp.dueDate) < todayKey).length
  const followUpCounts: Record<FollowUpFilter, number> = {
    All: categoryFollowUps.length,
    Overdue: categoryFollowUps.filter((followUp) => dateKey(followUp.dueDate) < todayKey).length,
    'Due today': categoryFollowUps.filter((followUp) => dateKey(followUp.dueDate) === todayKey).length,
    Upcoming: categoryFollowUps.filter((followUp) => dateKey(followUp.dueDate) > todayKey).length,
  }
  const visibleFollowUps = categoryFollowUps.filter((followUp) => {
    if (followUpFilter === 'All') return true
    if (followUpFilter === 'Overdue') return dateKey(followUp.dueDate) < todayKey
    if (followUpFilter === 'Due today') return dateKey(followUp.dueDate) === todayKey
    return dateKey(followUp.dueDate) > todayKey
  })

  const years = Array.from(new Set([
    now.getFullYear(),
    ...scopedRecords.opfs.map((opf) => toDate(opf.createdDate)?.getFullYear()),
    ...scopedRecords.leads.map((lead) => toDate(lead.createdDate)?.getFullYear()),
  ].filter((year): year is number => typeof year === 'number'))).sort((a, b) => b - a)

  const yearTrend = Array.from({ length: 12 }, (_, month) => ({
    month: new Date(trendYear, month, 1).toLocaleDateString('en-IN', { month: 'short' }),
    revenue: 0,
    margin: 0,
    funnelsCreated: 0,
    funnelsClosed: 0,
  }))
  scopedRecords.opfs.forEach((opf) => {
    const date = toDate(opf.createdDate)
    if (!date || date.getFullYear() !== trendYear) return
    const row = yearTrend[date.getMonth()]
    row.revenue += getOpfRevenue(opf)
    row.margin += getOpfRevenue(opf) - getOpfCost(opf)
  })
  funnels.forEach((lead) => {
    const createdDate = toDate(lead.createdDate)
    if (createdDate && createdDate.getFullYear() === trendYear) yearTrend[createdDate.getMonth()].funnelsCreated += 1
    if (lead.leadStatus === 'Won') {
      const closedDate = latestValidDate((lead as LeadWithTimestamps).updatedAt, lead.quotationDetails?.expectedClosure)
      if (closedDate && closedDate.getFullYear() === trendYear) yearTrend[closedDate.getMonth()].funnelsClosed += 1
    }
  })

  const getSalesRange = (selectedPeriod: SalesPeriod) => getPeriodRange(selectedPeriod, now)
  const getOemName = (lead: LeadRecord) => lead.products?.[0]?.productName?.trim() || 'Unknown'
  const oemGroups = new Map<string, number>()
  quotations.filter((lead) => inRange(lead.createdDate, getSalesRange(oemPeriod))).forEach((lead) => {
    const name = getOemName(lead)
    oemGroups.set(name, (oemGroups.get(name) || 0) + quotationValue(lead))
  })
  const allOemRows = Array.from(oemGroups, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const leadingOemRows = allOemRows.slice(0, 7)
  const otherOemValue = allOemRows.slice(7).reduce((total, row) => total + row.value, 0)
  const oemRows = otherOemValue > 0 ? [...leadingOemRows, { name: 'Others', value: otherOemValue }] : leadingOemRows
  const totalOemValue = oemRows.reduce((total, row) => total + row.value, 0)
  const oemChartData = oemRows.map((row) => ({ ...row, percentage: totalOemValue ? (row.value / totalOemValue) * 100 : 0 }))

  const getTopRows = (selectedPeriod: SalesPeriod, field: 'product' | 'customer') => {
    const groups = new Map<string, number>()
    scopedRecords.opfs.filter((opf) => inRange(opf.createdDate, getSalesRange(selectedPeriod))).forEach((opf) => {
      const label = (field === 'product' ? opf.product : opf.customerName)?.trim() || (field === 'product' ? 'Unknown' : 'Unknown')
      groups.set(label, (groups.get(label) || 0) + getOpfRevenue(opf))
    })
    const rows = Array.from(groups, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    return { total: rows.reduce((total, row) => total + row.value, 0), rows: rows.slice(0, 5) }
  }
  const topProducts = getTopRows(productsPeriod, 'product')
  const topCustomers = getTopRows(customersPeriod, 'customer')

  const todayCustomers = scopedRecords.customers.filter((customer) => dateKey(toDate(customer.createdAt || (customer as CustomerApiRecord & { createdDate?: string }).createdDate) || new Date(0)) === todayKey)
  const todayFunnels = funnels.filter((lead) => !lead.quotationId && dateKey(toDate(lead.createdDate) || new Date(0)) === todayKey)
  const todayQuotations = quotations.filter((lead) => dateKey(toDate(lead.createdDate) || new Date(0)) === todayKey)
  const todayOpfs = scopedRecords.opfs.filter((opf) => dateKey(toDate(opf.createdDate) || new Date(0)) === todayKey)
  const todayActivityRows = [
    ...todayCustomers.map((record) => ({ id: `customer-${record._id}`, category: 'Customer' as const, name: record.companyName || record.customerName || 'Customer', label: 'New customer' })),
    ...todayFunnels.map((record) => ({ id: `funnel-${record._id}`, category: 'Funnel' as const, name: record.companyName || record.leadId || 'Funnel', label: 'New funnel' })),
    ...todayQuotations.map((record) => ({ id: `quotation-${record._id}`, category: 'Quotation' as const, name: record.quotationId || record.companyName || 'Quotation', label: 'New quotation' })),
    ...todayOpfs.map((record) => ({ id: `opf-${record._id}`, category: 'OPF' as const, name: record.opfNo || record.customerName || 'OPF', label: 'New OPF' })),
  ]
  const activityCounts: Record<ActivityPeriod, number> = {
    All: todayActivityRows.length,
    Customer: todayCustomers.length,
    Funnel: todayFunnels.length,
    Quotation: todayQuotations.length,
    OPF: todayOpfs.length,
  }
  const visibleTodayRows = activityPeriod === 'All'
    ? todayActivityRows
    : todayActivityRows.filter((item) => item.category === activityPeriod)

  const monthRangeForClosures = getPeriodRange('month', now)
  const expectedClosures = quotations
    .filter((lead) => inRange(lead.quotationDetails?.expectedClosure, monthRangeForClosures))
    .sort((a, b) => (toDate(a.quotationDetails?.expectedClosure)?.getTime() || 0) - (toDate(b.quotationDetails?.expectedClosure)?.getTime() || 0))
  const closurePageCount = Math.max(1, Math.ceil(expectedClosures.length / 5))
  const currentClosurePage = Math.min(closurePage, closurePageCount)
  const pagedClosures = expectedClosures.slice((currentClosurePage - 1) * 5, currentClosurePage * 5)

  const firstName = userName.trim().split(/\s+/)[0] || 'there'
  const followUpIcons: Record<FollowUpCategory, typeof Activity> = {
    Activity,
    Funnel,
    Lead: Target,
    Renewal: RefreshCw,
  }

  return (
    <div style={dashboardStyle} className="sales-dashboard mx-auto flex w-full max-w-[1600px] flex-col gap-1.5 pb-8">
      <style>{`.sales-dashboard table td { font-size: var(--dashboard-body-font-size) !important; } .sales-dashboard table thead, .sales-dashboard table thead tr, .sales-dashboard table thead th { background-color: #fff !important; color: #64748B !important; } @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <header className="flex min-h-[56px] flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className={`${T.page} font-bold leading-7 text-slate-800`}>Sales Dashboard</h1>
          <p className={`mt-0.5 truncate ${T.small} text-slate-500`}>Overview of your sales performance · {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasFullAccess ? (
            <label className={`flex h-9 cursor-pointer items-center gap-2 rounded-full bg-white px-3 ${T.small} text-slate-700 shadow-sm`}>
              <span className="sr-only">Employee</span>
              <span className={`grid h-5 w-5 place-items-center rounded-full bg-slate-200 ${T.micro} font-semibold text-slate-600`}>A</span>
              <select value={employee} onChange={(event) => setEmployee(event.target.value)} className={`max-w-40 cursor-pointer appearance-none bg-transparent ${T.small} font-semibold outline-none`}>
                <option value="all">All Employees</option>
                {employeeOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          ) : (
            <span className={`inline-flex h-9 items-center gap-2 rounded-full bg-white px-2.5 ${T.small} text-slate-700 shadow-sm`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full bg-slate-200 ${T.micro} font-semibold text-slate-600`}>{firstName.charAt(0).toUpperCase()}</span>
              <span className="max-w-32 truncate font-semibold">{userName}</span><span className={`rounded-full bg-green-50 px-1.5 py-0.5 ${T.micro} font-bold tracking-wide text-green-700`}>YOU</span>
            </span>
          )}
          <div className="relative z-30" ref={periodMenuRef}>
            <button
              type="button"
              aria-label="Select dashboard date range"
              aria-expanded={periodMenuOpen}
              onClick={() => setPeriodMenuOpen((open) => !open)}
              className={`flex h-9 min-w-[170px] items-center justify-between gap-2 rounded-full bg-white px-3 ${T.small} font-semibold text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] ${periodMenuOpen ? 'ring-2 ring-[#4F6AF0]' : ''}`}
            >
              <CalendarDays className="h-4 w-4 text-[var(--dashboard-muted)]" />
              <span>{period === 'custom' && customRange
                ? `${customStart} – ${customEnd}`
                : selectedPeriod?.label || 'This Year'}</span>
              <ChevronDown className={`h-4 w-4 text-[var(--dashboard-muted)] transition-transform ${periodMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {periodMenuOpen ? (
              <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl bg-white p-4 shadow-xl ring-1 ring-[var(--dashboard-line)]">
                <span aria-hidden="true" className="absolute -top-2 right-8 h-4 w-4 rotate-45 border-l border-t border-[var(--dashboard-line)] bg-white" />
                <div className="relative space-y-3">
                  {periodGroups.map((group) => (
                    <div key={group.title}>
                      <p className={`mb-1.5 px-1 ${T.small} font-bold tracking-[0.12em] text-[var(--dashboard-muted)]`}>{group.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.options.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setPeriod(option.value)
                              if (option.value !== 'custom') setPeriodMenuOpen(false)
                            }}
                            className={`rounded-full border px-3 py-2 ${T.small} font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] ${
                              period === option.value
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {period === 'custom' ? (
                    <div className="border-t border-slate-100 pt-3">
                      <p className={`mb-2 ${T.small} font-semibold text-slate-700`}>Custom date range</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label                         className={`min-w-0 ${T.small} font-medium text-slate-500`}>
                          Start date
                          <input type="date" value={customStart} max={customEnd || undefined} onChange={(event) => setCustomStart(event.target.value)} className={`mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 ${T.small} text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100`} />
                        </label>
                        <label                         className={`min-w-0 ${T.small} font-medium text-slate-500`}>
                          End date
                          <input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} className={`mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 ${T.small} text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100`} />
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={!customRange}
                        onClick={() => setPeriodMenuOpen(false)}
                        className={`mt-3 w-full rounded-lg bg-[#111827] px-3 py-2 ${T.small} font-semibold text-white transition hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        Apply range
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => void loadData(true)} disabled={loading || refreshing} className={`inline-flex h-9 items-center gap-2 rounded-lg bg-[#111827] px-4 ${T.small} font-medium text-white transition hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] disabled:opacity-60`}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh
          </button>
        </div>
      </header>

      {error ? <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 ${T.body} text-red-700`}>{error}<button type="button" onClick={() => void loadData(true)} className="font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0]">Try again</button></div> : null}
      {loading && !records.leads.length && !records.opfs.length ? (
        <div role="status" aria-label="Loading dashboard" className="grid animate-[fadeIn_300ms_ease-out] grid-cols-1 gap-6 motion-reduce:animate-none lg:grid-cols-2">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className={`${cardClass} min-h-56 animate-pulse motion-reduce:animate-none`}><div className="h-5 w-2/5 rounded bg-slate-200" /><div className="mt-6 h-10 w-3/5 rounded bg-slate-200" /><div className="mt-5 h-4 w-full rounded bg-slate-100" /><div className="mt-3 h-4 w-4/5 rounded bg-slate-100" /></div>)}
        </div>
      ) : null}

      {!loading || records.leads.length || records.opfs.length ? (
        <div className="flex flex-col gap-1.5 animate-[fadeIn_300ms_ease-out] motion-reduce:animate-none">
          <div className="grid grid-cols-1 items-stretch gap-1.5 lg:grid-cols-3">
          <SectionBoundary className="min-w-0 lg:row-span-2">
            <section className={`${cardClass} ${liftCard} flex h-full flex-col overflow-hidden !p-0`}>
              <div className="relative h-24 shrink-0 overflow-hidden bg-[#D6DAF7] px-5 pt-5">
                <div className="relative z-10">
                  <p className={`${T.stat} font-medium leading-tight text-[#5B6BD6]`}>Welcome back, {firstName}!</p>
                  <p className={`mt-1 ${T.small} text-[#5B6BD6]/90`}>Here is your sales overview</p>
                </div>
                <svg aria-hidden="true" viewBox="0 0 116 84" className="absolute bottom-0 right-3 h-20 max-w-[40%] text-[#7C5CFC]">
                  <circle cx="87" cy="21" r="13" fill="#F5A94A" opacity=".8" />
                  <path d="M12 73h91" fill="none" stroke="#A8ADEE" strokeWidth="3" strokeLinecap="round" />
                  <rect x="22" y="39" width="57" height="34" rx="6" fill="#fff" opacity=".9" />
                  <path d="M31 62V52h8v10m5 0V46h8v16m5 0V41h8v21" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m31 46 12-8 9 4 14-13" fill="none" stroke="#22B07D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="66" cy="29" r="3" fill="#22B07D" />
                  <path d="M87 35v23m-8 0h16" fill="none" stroke="#7C5CFC" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex flex-1 flex-col px-5 pb-4">
                <div className="-mt-[10px] flex min-w-0 items-start gap-8">
                  <span className="relative z-10 grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-[#D5D9F8] text-[#5B6BD6]"><UserRound className="h-[26px] w-[26px]" /></span>
                  <div className="flex min-w-0 gap-12 pt-3">
                    <div className="min-w-0">
                      <p className={`truncate ${T.stat} font-semibold text-slate-700`}>{numberFormat.format(scopedRecords.customers.length)}</p>
                      <p className={`${T.small} text-slate-500`}>Clients</p>
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate ${T.stat} font-semibold text-slate-700`}>{formatCompactCurrency(periodRevenue)}</p>
                      <p className={`${T.small} text-slate-500`}>Revenue</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <p className={`truncate ${T.body} font-semibold text-slate-700`}>{userName}</p>
                  <p className={`${T.small} text-slate-500`}>Sales</p>
                  <p className={`${T.small} text-slate-500`}>{employeeType}</p>
                </div>
              </div>
            </section>
          </SectionBoundary>

          <SectionBoundary className="min-w-0 lg:col-span-2 lg:row-span-2">
            <div className="grid h-full w-full auto-rows-fr grid-cols-1 gap-1 sm:grid-cols-2">
              {kpis.map((kpi) => (
                <KpiCard
                  key={kpi.title}
                  title={kpi.title}
                  value={kpi.metric.value}
                  previous={kpi.metric.previous}
                  changePct={kpi.metric.changePct}
                  periodLabel={periodLabel}
                  previousLabel={previousLabel}
                  detailLabel={kpi.detailLabel}
                  detailValue={kpi.detailValue}
                  detailChangePct={kpi.detailMetric.changePct}
                  icon={kpi.icon}
                  iconStyle={kpi.iconStyle}
                  href={kpi.href}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </SectionBoundary>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-1.5 lg:grid-cols-3">
          <SectionBoundary className="min-w-0">
            <section className={`${cardClass} ${liftCard} flex h-full min-h-[230px] flex-col`}>
              <div className="flex items-start justify-between gap-3">
                <div><h2 className={`${T.title} font-medium text-slate-700`}>Monthly Earning</h2><p className={`mt-1 ${T.small} text-slate-500`}>This month</p></div>
                <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Activity className="h-5 w-5" /></span>
              </div>
              <div className="mt-5 flex flex-1 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate ${T.value} font-semibold tabular-nums text-slate-700`}>{formatCompactCurrency(selectedPeriodRevenue)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1"><ChangeIndicator changePct={monthlyChange.changePct} /><span className={`${T.small} text-slate-500`}>From previous period</span></div>
                  <p className={`mt-1 ${T.small} text-slate-500`}>Previous: {formatCompactCurrency(previousSelectedPeriodRevenue)}</p>
                </div>
                <div className="relative grid h-[110px] w-[110px] shrink-0 place-items-center">
                  <svg aria-hidden="true" viewBox="0 0 120 120" className="-rotate-90">
                    <defs><linearGradient id="earning-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={palette.blue} /><stop offset="100%" stopColor={palette.purple} /></linearGradient></defs>
                    <circle cx="60" cy="60" r="48" fill="none" stroke={palette.line} strokeWidth="10" />
                    <circle cx="60" cy="60" r="48" fill="none" stroke="url(#earning-ring-gradient)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(Math.min(Math.max(monthShare, 0), 100) / 100) * 301.59} 301.59`} />
                  </svg>
                  <span className={`absolute ${T.body} font-semibold tabular-nums text-slate-700`}>{Math.round(monthShare)}%</span>
                </div>
              </div>
              <Link to="/sales/opf" className={`mt-3 inline-flex h-9 w-fit items-center rounded bg-[#5B6AE8] px-3 ${T.small} font-medium text-white transition hover:bg-[#4F5BD5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0]`}>View More →</Link>
            </section>
          </SectionBoundary>

          <SectionBoundary className="min-w-0">
          <section className={`${cardClass} ${liftCard} h-full`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><SquareCheckBig className="h-4 w-4 text-slate-700" /><h2 className={`${T.title} font-medium text-slate-700`}>Open Tasks</h2></div>
              <Link to="/sales/activities" className={`shrink-0 ${T.small} font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0]`}>View all</Link>
            </div>
            <table className={`w-full table-fixed text-left ${T.body}`}>
              <colgroup><col style={{ width: '22%' }} /><col style={{ width: '24%' }} /><col style={{ width: '32%' }} /><col style={{ width: '22%' }} /></colgroup>
              <thead className={`!bg-white ${T.small} font-semibold text-slate-700`}><tr className="border-b border-[#EEF0F4]"><th className="truncate px-1 py-3 font-semibold">Task ID</th><th className="truncate px-1 py-3 font-semibold">Assigned To</th><th className="truncate px-1 py-3 font-semibold">Customer</th><th className="truncate px-1 py-3 font-semibold">Due Date</th></tr></thead>
              <tbody className={T.body}>{openTasks.length ? openTasks.map((task) => {
                    const dueDate = toDate(task.followUpDate)
                    const overdue = dueDate ? dateKey(dueDate) < todayKey : false
                    return <tr key={task._id} className="border-b border-[var(--dashboard-line)] transition hover:bg-[var(--dashboard-soft)] last:border-0"><td className="truncate px-1 py-3 font-semibold text-slate-700" title={task.activityId || task._id}>{task.activityId || task._id}</td><td className="truncate px-1 py-3 text-slate-600" title={task.assignedUser || task.createdBy || '—'}>{task.assignedUser || task.createdBy || '—'}</td><td className="truncate px-1 py-3 text-slate-600" title={task.company || task.customerName || '—'}>{task.company || task.customerName || '—'}</td><td className="truncate px-1 py-3">{dueDate ? <span className={overdue ? `inline-flex rounded-full bg-red-50 px-1 py-0.5 ${T.micro} font-semibold text-red-700` : ''}>{formatDate(dueDate)}</span> : '—'}</td></tr>
                  }) : <tr><td colSpan={4} className={`px-1 pt-3 ${T.small} text-slate-500`}>No open tasks</td></tr>}</tbody>
            </table>
          </section>
          </SectionBoundary>

          <SectionBoundary className="min-w-0">
          <section className={`${cardClass} ${liftCard} h-full`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#EEF0FF] text-[#5B6BD6]"><CalendarCheck2 className="h-4 w-4" /></span>
                <h2 className={`${T.title} font-medium text-slate-700`}>Follow Ups</h2>
                <span className={`${T.small} text-slate-500`}>({followUps.length})</span>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FDE8E8] px-2 py-1 ${T.small} font-medium text-[#E53E3E]`}><span className="h-1.5 w-1.5 rounded-full bg-[#E53E3E]" />{overdueCount} Overdue</span>
            </div>
            <div className="mt-3 flex rounded-full bg-[#F1F3F9] p-0.5">
              {followUpCategories.map((category) => {
                const CategoryIcon = followUpIcons[category]
                return <button key={category} type="button" onClick={() => setFollowUpCategory(category)} className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 py-1 ${T.small} transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] ${followUpCategory === category ? 'bg-white font-semibold text-slate-700 shadow-sm' : 'text-slate-600'}`}><CategoryIcon className="h-3 w-3 shrink-0" /><span className="truncate">{category}</span><span className={`rounded-full px-1.5 ${T.micro} ${followUpCategory === category ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-600'}`}>{categoryCounts[category]}</span></button>
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {followUpFilters.map((filter) => <button key={filter} type="button" onClick={() => setFollowUpFilter(filter)} className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 ${T.small} transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] ${followUpFilter === filter ? 'bg-[#1E2A3B] text-white' : 'bg-[#F1F3F9] text-slate-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${filter === 'Overdue' ? 'bg-red-500' : filter === 'Due today' ? 'bg-orange-400' : filter === 'Upcoming' ? 'bg-blue-500' : 'bg-slate-400'}`} />{filter}<span className={`${T.micro} ${followUpFilter === filter ? 'text-slate-200' : 'text-slate-500'}`}>{followUpCounts[filter]}</span></button>)}
            </div>
            <div className="mt-2 max-h-[120px] space-y-1.5 overflow-y-auto [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
              {visibleFollowUps.length ? (
                visibleFollowUps.map((followUp) => {
                  const overdue = dateKey(followUp.dueDate) < todayKey
                  const dueToday = dateKey(followUp.dueDate) === todayKey
                  const borderColor = overdue ? 'border-l-red-500' : dueToday ? 'border-l-orange-400' : 'border-l-blue-500'
                  const dateLabel = formatDate(followUp.dueDate)
                  const initials = followUp.contact.trim().charAt(0).toUpperCase() || '—'
                  return <div key={followUp.id} className={`rounded-md border border-[#EEF0F4] border-l-[3px] ${borderColor} bg-white px-3 py-2`}>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={`shrink-0 rounded bg-[#FFF1DB] px-1.5 ${T.micro} text-[#D9822B]`}>{followUp.category}</span>
                      <p className={`min-w-0 flex-1 truncate ${T.body} font-semibold text-slate-700`}>{followUp.company}</p>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded bg-[#E8ECFF] px-1.5 ${T.micro} text-[#4F5BD5]`}><CalendarDays className="h-3 w-3" />{dateLabel}</span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 ${T.micro} font-semibold text-slate-600`}>{initials}</span>
                      <span className={`min-w-0 flex-1 truncate ${T.small} text-slate-500`}>{followUp.contact}</span>
                      <span className={`inline-flex shrink-0 items-center gap-1 ${T.small} text-slate-500`}><Clock3 className="h-3 w-3" />{dateLabel}</span>
                    </div>
                  </div>
                })
              ) : <p className={`py-2 ${T.small} text-slate-500`}>Nothing to show.</p>}
            </div>
          </section>
          </SectionBoundary>

          </div>
          <div className="grid grid-cols-1 items-stretch gap-1.5 lg:grid-cols-12">
          <SectionBoundary className="min-w-0 lg:col-span-6">
          <section className={`${cardClass} h-full`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className={`${T.title} font-semibold text-[var(--dashboard-ink)]`}>OEM Wise Sales Analysis</h2>
              <select aria-label="OEM sales period" value={oemPeriod} onChange={(event) => setOemPeriod(event.target.value as SalesPeriod)} className={`h-10 rounded-full bg-white px-4 ${T.small} text-[var(--dashboard-ink)] ring-1 ring-[var(--dashboard-line)] outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0]`}>
                {salesPeriods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {oemChartData.length ? (
              <div className="grid items-center gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="relative mx-auto h-[220px] w-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={oemChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={67} outerRadius={105} paddingAngle={3} stroke="white" strokeWidth={3}>
                        {oemChartData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => formatCompactCurrency(Number(value) || 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`max-w-[120px] truncate ${T.value} font-semibold tabular-nums text-[var(--dashboard-ink)]`}>{formatCompactCurrency(totalOemValue)}</span>
                    <span className={`mt-1 ${T.small} text-[var(--dashboard-muted)]`}>Total</span>
                  </div>
                </div>
                <div className="min-w-0 space-y-3">
                  {oemChartData.map((row, index) => (
                    <div key={row.name} className="flex min-w-0 items-center justify-between gap-2">
                      <span className={`flex min-w-0 items-center gap-2 ${T.body} text-[var(--dashboard-ink)]`}><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="truncate">{row.name}</span></span>
                      <span className={`shrink-0 ${T.small} text-[var(--dashboard-muted)]`}>{formatCompactCurrency(row.value)}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 ${T.body} font-semibold`} style={{ color: chartColors[index % chartColors.length], backgroundColor: `${chartColors[index % chartColors.length]}18` }}>{row.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className={`grid min-h-64 place-items-center ${T.body} text-[var(--dashboard-muted)]`}><div className="text-center"><Package className="mx-auto mb-2 h-7 w-7" />No data</div></div>}
          </section>
          </SectionBoundary>

          <SectionBoundary className="min-w-0 lg:col-span-6">
          <section className={`${cardClass} h-full`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className={`${T.title} font-semibold text-[var(--dashboard-ink)]`}>Revenue vs Margin</h2><p className={`mt-1 ${T.small} text-[var(--dashboard-muted)]`}>OPF revenue, margin, and funnel movement</p></div>
              <select aria-label="Revenue chart year" value={trendYear} onChange={(event) => setTrendYear(Number(event.target.value))} className={`h-10 rounded-full bg-white px-4 ${T.small} text-[var(--dashboard-ink)] ring-1 ring-[var(--dashboard-line)] outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0]`}>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <div className="h-[320px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={yearTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                  <defs>
                    <linearGradient id="revenue-bars-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={palette.blue} stopOpacity={0.95} /><stop offset="100%" stopColor={palette.blue} stopOpacity={0.35} /></linearGradient>
                    <linearGradient id="margin-bars-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={palette.orange} stopOpacity={0.95} /><stop offset="100%" stopColor={palette.orange} stopOpacity={0.35} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke={palette.line} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: textSizeInPixels(T.micro), fill: palette.muted }} />
                  <YAxis yAxisId="revenue" tickFormatter={(value: number) => formatCompactCurrency(value)} tick={{ fontSize: textSizeInPixels(T.micro), fill: palette.muted }} width={58} />
                  <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: textSizeInPixels(T.micro), fill: palette.muted }} width={34} />
                  <Tooltip
                    formatter={(value, name) => name === 'Revenue' || name === 'Margin' ? revenueFormat.format(Number(value) || 0) : numberFormat.format(Number(value) || 0)}
                    content={({ active, payload, label }) => active && payload?.length ? (
                      <div className={`rounded-xl bg-white p-3 ${T.small} shadow-xl ring-1 ring-[var(--dashboard-line)]`}>
                        <p className="mb-2 font-semibold text-[var(--dashboard-ink)]">{label}</p>
                        {payload.map((entry) => <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5 text-[var(--dashboard-muted)]"><span>{entry.name}</span><span className="font-semibold text-[var(--dashboard-ink)]">{entry.name === 'Revenue' || entry.name === 'Margin' ? revenueFormat.format(Number(entry.value) || 0) : numberFormat.format(Number(entry.value) || 0)}</span></div>)}
                      </div>
                    ) : null}
                  />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span className={`${T.small} text-[var(--dashboard-muted)]`}>{value}</span>} wrapperStyle={{ fontSize: textSizeInPixels(T.small), paddingBottom: 8 }} />
                  <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill="url(#revenue-bars-gradient)" barSize={18} radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="revenue" dataKey="margin" name="Margin" fill="url(#margin-bars-gradient)" barSize={18} radius={[6, 6, 0, 0]} />
                  <Line yAxisId="count" type="monotone" dataKey="funnelsCreated" name="Funnels Created" stroke={palette.green} strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: palette.green, strokeWidth: 2 }} />
                  <Line yAxisId="count" type="monotone" dataKey="funnelsClosed" name="Funnels Closed" stroke={palette.red} strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: palette.red, strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
          </SectionBoundary>

          <SectionBoundary className="min-w-0 lg:col-span-4">
          <section className={`${cardClass} ${liftCard} h-full`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className={`${T.title} font-semibold text-[var(--dashboard-ink)]`}>Top Selling Products</h2>
              <div className="flex flex-wrap gap-1.5">
                {salesPeriods.map((option) => <button key={option.value} type="button" onClick={() => setProductsPeriod(option.value)} className={`h-8 rounded-full px-3 py-1.5 ${T.small} font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] ${productsPeriod === option.value ? 'bg-[#111827] text-white' : 'bg-[var(--dashboard-soft)] text-[var(--dashboard-muted)] hover:bg-slate-200'}`}>{option.label}</button>)}
              </div>
            </div>
            {topProducts.rows.length ? (
              <div className="space-y-4">
                {topProducts.rows.map((row, index) => {
                    const share = topProducts.total ? (row.value / topProducts.total) * 100 : 0
                    return <div key={row.name} className="min-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--dashboard-soft)] ${T.small} font-bold text-[var(--dashboard-muted)]`}>{index + 1}</span>
                        <p className={`min-w-0 flex-1 truncate ${T.body} font-semibold text-[var(--dashboard-ink)]`}>{row.name}</p>
                        <p className={`shrink-0 ${T.body} font-semibold text-[var(--dashboard-ink)]`}>{formatCompactCurrency(row.value)}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-3 pl-11">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--dashboard-soft)]"><div className="h-full rounded-full" style={{ width: `${Math.min(share, 100)}%`, backgroundColor: chartColors[index % chartColors.length] }} /></div>
                        <span className={`w-12 text-right ${T.micro} tabular-nums text-[var(--dashboard-muted)]`}>{share.toFixed(1)}%</span>
                      </div>
                    </div>
                  })}
              </div>
            ) : <div className={`grid min-h-32 place-items-center ${T.body} text-[var(--dashboard-muted)]`}>No data</div>}
            <div className={`mt-4 rounded-xl bg-blue-50 px-4 py-3 ${T.body} font-semibold text-blue-800`}>Total Product Revenue <span className="float-right">{formatCompactCurrency(topProducts.total)}</span></div>
          </section>
          </SectionBoundary>

          <SectionBoundary className="min-w-0 lg:col-span-4">
          <section className={`${cardClass} ${liftCard} h-full`}>
            <div className="mb-4"><h2 className={`${T.title} font-semibold text-[var(--dashboard-ink)]`}>Today's Activity</h2><p className={`mt-1 ${T.small} text-[var(--dashboard-muted)]`}>CRM records created today</p></div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(['All', 'Customer', 'Funnel', 'Quotation', 'OPF'] as const).map((category) => <button key={category} type="button" onClick={() => setActivityPeriod(category)} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${T.small} font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] ${activityPeriod === category ? 'bg-[#111827] text-white' : 'bg-[var(--dashboard-soft)] text-[var(--dashboard-muted)] hover:bg-slate-200'}`}>{category}<span className={`rounded-full px-2 py-0.5 ${T.micro} ${activityPeriod === category ? 'bg-white/15 text-white' : 'bg-white text-[var(--dashboard-muted)]'}`}>{activityCounts[category]}</span></button>)}
            </div>
            {visibleTodayRows.length ? (
              <div className="max-h-64 overflow-y-auto [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
                {visibleTodayRows.map((item, index) => <div key={item.id} className="flex items-stretch gap-3 py-3 first:pt-1">
                  <div className="flex w-5 shrink-0 flex-col items-center"><span className="mt-1 h-3 w-3 rounded-full ring-4 ring-blue-50" style={{ backgroundColor: chartColors[index % chartColors.length] }} />{index < visibleTodayRows.length - 1 ? <span className="mt-1 w-px flex-1 bg-[var(--dashboard-line)]" /> : null}</div>
                  <div className="min-w-0 flex-1"><p className={`truncate ${T.body} font-semibold text-[var(--dashboard-ink)]`}>{item.name}</p><p className={`mt-1 ${T.small} text-[var(--dashboard-muted)]`}>{item.label}</p></div>
                </div>)}
              </div>
            ) : <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-[var(--dashboard-soft)] px-4 text-center"><Activity className="h-8 w-8 text-[var(--dashboard-blue)]" /><p className={`mt-3 ${T.body} font-semibold text-[var(--dashboard-ink)]`}>No activity today</p><p className={`mt-1 ${T.small} text-[var(--dashboard-muted)]`}>New records you create will show up here.</p></div>}
          </section>
          </SectionBoundary>

          <SectionBoundary className="min-w-0 lg:col-span-4">
          <section className={`${cardClass} ${liftCard} h-full`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className={`${T.title} font-semibold text-[var(--dashboard-ink)]`}>Top Customers</h2>
              <div className="flex flex-wrap gap-1.5">
                {salesPeriods.map((option) => <button key={option.value} type="button" onClick={() => setCustomersPeriod(option.value)} className={`h-8 rounded-full px-3 py-1.5 ${T.small} font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] ${customersPeriod === option.value ? 'bg-[#111827] text-white' : 'bg-[var(--dashboard-soft)] text-[var(--dashboard-muted)] hover:bg-slate-200'}`}>{option.label}</button>)}
              </div>
            </div>
            {topCustomers.rows.length ? (
              <div className="space-y-4">
                {topCustomers.rows.map((row, index) => {
                    const share = topCustomers.total ? (row.value / topCustomers.total) * 100 : 0
                    return <div key={row.name} className="min-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--dashboard-soft)] ${T.small} font-bold text-[var(--dashboard-muted)]`}>{index + 1}</span>
                        <p className={`min-w-0 flex-1 truncate ${T.body} font-semibold text-[var(--dashboard-ink)]`}>{row.name}</p>
                        <p className={`shrink-0 ${T.body} font-semibold text-[var(--dashboard-ink)]`}>{formatCompactCurrency(row.value)}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-3 pl-11">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--dashboard-soft)]"><div className="h-full rounded-full" style={{ width: `${Math.min(share, 100)}%`, backgroundColor: chartColors[index % chartColors.length] }} /></div>
                        <span className={`w-12 text-right ${T.micro} tabular-nums text-[var(--dashboard-muted)]`}>{share.toFixed(1)}%</span>
                      </div>
                    </div>
                  })}
              </div>
            ) : <div className={`grid min-h-32 place-items-center ${T.body} text-[var(--dashboard-muted)]`}>No data</div>}
            <div className={`mt-4 rounded-xl bg-green-50 px-4 py-3 ${T.body} font-semibold text-green-800`}>Total Revenue Across All Customers <span className="float-right">{formatCompactCurrency(topCustomers.total)}</span></div>
          </section>
          </SectionBoundary>

          <SectionBoundary className="min-w-0 lg:col-span-12">
          <section className={`${cardClass} h-full`}>
            <div className="mb-4"><h2 className={`${T.title} font-semibold text-[var(--dashboard-ink)]`}>Expected Closures - This Month</h2><p className={`mt-1 ${T.small} text-[var(--dashboard-muted)]`}>Quotations with an expected closure this month</p></div>
            {pagedClosures.length ? (
              <>
                <div className="min-w-0">
                  <table className={`w-full table-fixed text-left ${T.body}`}>
                    <colgroup><col style={{ width: '11%' }} /><col style={{ width: '19%' }} /><col style={{ width: '13%' }} /><col style={{ width: '12%' }} /><col style={{ width: '15%' }} /><col style={{ width: '19%' }} /><col style={{ width: '11%' }} /></colgroup>
                    <thead className={`bg-[#F6F7FB] ${T.small} uppercase tracking-wide text-[var(--dashboard-muted)]`}><tr><th className="rounded-l-lg px-2 py-3 font-semibold">Quote No</th><th className="px-2 py-3 font-semibold">Company</th><th className="px-2 py-3 font-semibold">Account Manager</th><th className="px-2 py-3 font-semibold">Revenue</th><th className="px-2 py-3 font-semibold">Expected Closure</th><th className="px-2 py-3 font-semibold">Product Details</th><th className="rounded-r-lg px-2 py-3 font-semibold">Details</th></tr></thead>
                    <tbody>{pagedClosures.map((lead, rowIndex) => {
                      const products = lead.products || []
                      const closureDate = toDate(lead.quotationDetails?.expectedClosure)
                      const closureDateKey = closureDate ? dateKey(closureDate) : ''
                      const closurePill = closureDateKey && closureDateKey < todayKey
                        ? 'bg-red-50 text-red-700'
                        : closureDateKey === todayKey
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-slate-100 text-slate-600'
                      return <tr key={lead._id} className={`border-b border-[var(--dashboard-line)] align-top transition hover:bg-[var(--dashboard-soft)] ${rowIndex % 2 === 1 ? 'bg-[#FAFBFD]' : 'bg-white'}`}>
                        <td className="truncate px-2 py-3 font-bold text-[var(--dashboard-ink)]" title={lead.quotationId || '—'}>{lead.quotationId || '—'}</td>
                        <td className="truncate px-2 py-3"><p className="truncate font-semibold text-[var(--dashboard-ink)]" title={lead.companyName || '—'}>{lead.companyName || '—'}</p><p className={`mt-1 truncate ${T.small} text-[var(--dashboard-muted)]`} title={lead.contactPerson || '—'}>{lead.contactPerson || '—'}</p></td>
                        <td className="truncate px-2 py-3 text-[var(--dashboard-muted)]" title={leadOwner(lead) || '—'}>{leadOwner(lead) || '—'}</td>
                        <td className="truncate px-2 py-3 font-semibold text-green-700" title={revenueFormat.format(quotationValue(lead))}>{revenueFormat.format(quotationValue(lead))}</td>
                        <td className="px-2 py-3">{closureDate ? <span className={`inline-block max-w-full truncate rounded-full px-2 py-1 ${T.micro} font-semibold ${closurePill}`}>{closureDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span> : <span className="text-[var(--dashboard-muted)]">—</span>}</td>
                        <td className="px-2 py-3"><div className="flex flex-wrap gap-1">{products.slice(0, 3).map((product, index) => <span key={`${lead._id}-product-${index}`} className={`max-w-full truncate rounded-full bg-blue-50 px-2 py-1 ${T.micro} text-blue-700`}>{product.productName || 'Product'}</span>)}{products.length > 3 ? <span className={`rounded-full bg-slate-100 px-2 py-1 ${T.micro} text-slate-600`}>+{products.length - 3} more</span> : null}</div></td>
                        <td className="px-2 py-3"><button type="button" onClick={() => navigate(`/sales/quotations/view/${lead._id}`)} className={`h-9 whitespace-nowrap rounded-lg bg-[#111827] px-2.5 ${T.small} font-medium text-white hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0]`}>View Details</button></td>
                      </tr>
                    })}</tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className={`${T.small} text-[var(--dashboard-muted)]`}>Page {currentClosurePage} of {closurePageCount}</p>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Previous page" disabled={currentClosurePage === 1} onClick={() => setClosurePage((page) => Math.max(1, page - 1))} className="rounded-lg border border-[var(--dashboard-line)] p-2 text-[var(--dashboard-muted)] hover:bg-[var(--dashboard-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    {Array.from({ length: closurePageCount }, (_, index) => index + 1).map((page) => <button key={page} type="button" onClick={() => setClosurePage(page)} aria-current={page === currentClosurePage ? 'page' : undefined} className={`h-8 w-8 rounded-lg ${T.small} font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] ${page === currentClosurePage ? 'bg-[#111827] text-white' : 'border border-[var(--dashboard-line)] text-[var(--dashboard-muted)] hover:bg-[var(--dashboard-soft)]'}`}>{page}</button>)}
                    <button type="button" aria-label="Next page" disabled={currentClosurePage === closurePageCount} onClick={() => setClosurePage((page) => Math.min(closurePageCount, page + 1))} className="rounded-lg border border-[var(--dashboard-line)] p-2 text-[var(--dashboard-muted)] hover:bg-[var(--dashboard-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6AF0] disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              </>
            ) : <div className={`grid min-h-36 place-items-center ${T.body} text-[var(--dashboard-muted)]`}>No expected closures this month.</div>}
          </section>
          </SectionBoundary>
        </div>
        </div>
      ) : null}
    </div>
  )
}
