'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  FileText,
  RefreshCcw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { fetchActivities, type ActivityRecord } from '@/lib/activityApi'
import { fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi'
import { fetchLeads, type LeadRecord } from '@/lib/leadApi'
import { fetchOPFs, type OPFRecord } from '@/lib/opfApi'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const shortCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const parseMonthKey = (value: string) => {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return new Date()
  return new Date(year, month - 1, 1)
}

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1)
const endOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth() + 1, 0)

const formatMonthLabel = (date: Date, mode: 'short' | 'full' = 'short') =>
  date.toLocaleDateString('en-IN', {
    month: mode === 'short' ? 'short' : 'long',
    year: 'numeric',
  })

const formatCurrency = (value: number) => (Number.isFinite(value) ? currencyFormatter.format(value) : '₹0')
const formatCompactCurrency = (value: number) => (Number.isFinite(value) ? shortCurrencyFormatter.format(value) : '₹0')

const monthRangeLabel = (monthKey: string) => {
  const date = parseMonthKey(monthKey)
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

const differenceLabel = (current: number, previous: number) => {
  const diff = current - previous
  return `${diff >= 0 ? '+' : ''}${diff}`
}

const percentageChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

const getLeadRevenueEstimate = (lead: LeadRecord) => {
  const productRevenue = (lead.products ?? []).reduce((sum, product) => {
    const quantity = Number(product.quantity ?? 0)
    const unitPrice = Number(product.unitPrice ?? 0)
    return sum + quantity * unitPrice
  }, 0)

  const details = lead.quotationDetails ?? {}
  const serviceCost = Number(details.serviceCost ?? 0)
  const freightCost = Number(details.freightCost ?? 0)
  return productRevenue + serviceCost + freightCost
}

const getLeadCostEstimate = (lead: LeadRecord) => {
  const productCost = (lead.products ?? []).reduce((sum, product) => {
    const quantity = Number(product.quantity ?? 0)
    const expectedVendorPrice = Number(product.expectedVendorPrice ?? 0)
    return sum + quantity * expectedVendorPrice
  }, 0)

  const details = lead.quotationDetails ?? {}
  const serviceCost = Number(details.serviceCost ?? 0)
  const freightCost = Number(details.freightCost ?? 0)
  return productCost + serviceCost + freightCost
}

const getOpfRevenue = (opf: OPFRecord) => {
  const quantity = Number(opf.quantity ?? 0)
  const unitPrice = Number(opf.unitPrice ?? 0)
  const serviceCost = Number(opf.serviceCost ?? 0)
  const freightCost = Number(opf.freightCost ?? 0)
  return quantity * unitPrice + serviceCost + freightCost
}

const getOpfCost = (opf: OPFRecord) => {
  const quantity = Number(opf.quantity ?? 0)
  const vendorPrice = Number(opf.vendorPrice ?? 0)
  const serviceCost = Number(opf.serviceCost ?? 0)
  const freightCost = Number(opf.freightCost ?? 0)
  return quantity * vendorPrice + serviceCost + freightCost
}

const getMonthKeyFromDateValue = (value?: string | Date | null) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return toMonthKey(date)
}

const getPreviousMonthKey = (monthKey: string) => {
  const base = parseMonthKey(monthKey)
  const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1)
  return toMonthKey(prev)
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const getYearFromDateValue = (value?: string | Date | null) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getFullYear()
}

const getKpiMetric = (items: Array<{ createdAt?: string; createdDate?: string }>, monthKey: string, selector: (item: any) => number) => {
  return items.reduce((sum, item) => {
    const month = getMonthKeyFromDateValue(item.createdAt ?? item.createdDate)
    if (!month || month !== monthKey) return sum
    return sum + selector(item)
  }, 0)
}

const getKpiCount = (items: Array<{ createdAt?: string; createdDate?: string }>, monthKey: string, predicate: (item: any) => boolean) => {
  return items.filter((item) => {
    const month = getMonthKeyFromDateValue(item.createdAt ?? item.createdDate)
    return month === monthKey && predicate(item)
  }).length
}

const activityTone = {
  call: 'bg-blue-100 text-blue-700',
  meeting: 'bg-violet-100 text-violet-700',
  followup: 'bg-amber-100 text-amber-700',
  quotation: 'bg-emerald-100 text-emerald-700',
  default: 'bg-slate-100 text-slate-700',
} as const

export default function DashboardPage() {
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState('overall')
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([])
  const [opfs, setOpfs] = useState<OPFRecord[]>([])
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [leadResponse, customerResponse, opfResponse, activityResponse] = await Promise.all([
        fetchLeads({ limit: 1000 }),
        fetchCustomers({ limit: 1000 }),
        fetchOPFs({ limit: 1000 }),
        fetchActivities({ limit: 8, sortBy: 'createdAt', sortOrder: 'desc' }),
      ])

      setLeads(leadResponse.data ?? [])
      setCustomers(customerResponse.data ?? [])
      setOpfs(opfResponse.data ?? [])
      setActivities(activityResponse.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    customers.forEach((customer) => {
      const year = getYearFromDateValue(customer.createdAt)
      if (year) years.add(year)
    })
    leads.forEach((lead) => {
      const year = getYearFromDateValue(lead.createdDate)
      if (year) years.add(year)
    })
    opfs.forEach((opf) => {
      const year = getYearFromDateValue(opf.createdDate)
      if (year) years.add(year)
    })

    if (years.size === 0) {
      years.add(new Date().getFullYear())
    }

    return Array.from(years).sort((a, b) => b - a)
  }, [customers, leads, opfs])

  useEffect(() => {
    void fetchDashboardData()
  }, [])

  const selectedYearNumber = availableYears[0] ?? new Date().getFullYear()

  const previousMonthKey = selectedMonth === 'overall'
    ? `${selectedYearNumber - 1}-12`
    : getPreviousMonthKey(`${selectedYearNumber}-${selectedMonth}`)

  const selectedScope = useMemo(() => {
    const scopeCustomers = customers.filter((customer) => {
      const year = getYearFromDateValue(customer.createdAt)
      if (selectedMonth === 'overall') return year === selectedYearNumber
      return getMonthKeyFromDateValue(customer.createdAt) === `${selectedYearNumber}-${selectedMonth}`
    })

    const scopeLeads = leads.filter((lead) => {
      const year = getYearFromDateValue(lead.createdDate)
      if (selectedMonth === 'overall') return year === selectedYearNumber
      return getMonthKeyFromDateValue(lead.createdDate) === `${selectedYearNumber}-${selectedMonth}`
    })

    const scopeOpfs = opfs.filter((opf) => {
      const year = getYearFromDateValue(opf.createdDate)
      if (selectedMonth === 'overall') return year === selectedYearNumber
      return getMonthKeyFromDateValue(opf.createdDate) === `${selectedYearNumber}-${selectedMonth}`
    })

    const previousCustomers = customers.filter((customer) => {
      const year = getYearFromDateValue(customer.createdAt)
      if (selectedMonth === 'overall') return year === selectedYearNumber - 1
      return getMonthKeyFromDateValue(customer.createdAt) === previousMonthKey
    })

    const previousLeads = leads.filter((lead) => {
      const year = getYearFromDateValue(lead.createdDate)
      if (selectedMonth === 'overall') return year === selectedYearNumber - 1
      return getMonthKeyFromDateValue(lead.createdDate) === previousMonthKey
    })

    const previousOpfs = opfs.filter((opf) => {
      const year = getYearFromDateValue(opf.createdDate)
      if (selectedMonth === 'overall') return year === selectedYearNumber - 1
      return getMonthKeyFromDateValue(opf.createdDate) === previousMonthKey
    })

    const yearCustomers = customers.filter((customer) => getYearFromDateValue(customer.createdAt) === selectedYearNumber)
    const yearLeads = leads.filter((lead) => getYearFromDateValue(lead.createdDate) === selectedYearNumber)
    const yearOpfs = opfs.filter((opf) => getYearFromDateValue(opf.createdDate) === selectedYearNumber)

    return {
      scopeCustomers,
      scopeLeads,
      scopeOpfs,
      previousCustomers,
      previousLeads,
      previousOpfs,
      yearCustomers,
      yearLeads,
      yearOpfs,
    }
  }, [customers, leads, opfs, previousMonthKey, selectedMonth, selectedYearNumber])

  const dataset = useMemo(() => {
    const activeCustomers = selectedScope.scopeCustomers.filter((customer) => customer.status === 'Active').length
    const quotations = selectedScope.scopeLeads.filter((lead) => lead.leadStatus === 'Proposal Sent' || Boolean(lead.quotationId)).length
    const orderCloser = selectedScope.scopeLeads.filter((lead) => lead.leadStatus === 'Won' || lead.isConverted).length

    const currentMonthLeads = selectedScope.scopeLeads
    const previousMonthLeads = selectedScope.previousLeads

    const currentMonthOpfs = selectedScope.scopeOpfs
    const previousMonthOpfs = selectedScope.previousOpfs

    const activeCustomersCurrent = selectedScope.scopeCustomers.filter((customer) => customer.status === 'Active').length
    const activeCustomersPrevious = selectedScope.previousCustomers.filter((customer) => customer.status === 'Active').length

    const currentRevenue = currentMonthOpfs.reduce((sum, opf) => sum + getOpfRevenue(opf), 0)
    const previousRevenue = previousMonthOpfs.reduce((sum, opf) => sum + getOpfRevenue(opf), 0)
    const currentMargin = currentMonthOpfs.reduce((sum, opf) => sum + (getOpfRevenue(opf) - getOpfCost(opf)), 0)
    const previousMargin = previousMonthOpfs.reduce((sum, opf) => sum + (getOpfRevenue(opf) - getOpfCost(opf)), 0)

    const metrics = [
      {
        key: 'activeCustomers',
        label: 'ACTIVE CUSTOMERS',
        value: activeCustomers,
        currentValue: activeCustomersCurrent,
        previousValue: activeCustomersPrevious,
        icon: Users,
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-700',
        description: 'Customers currently active',
      },
      {
        key: 'quotations',
        label: 'QUOTATIONS',
        value: quotations,
        currentValue: currentMonthLeads.filter((lead) => lead.leadStatus === 'Proposal Sent' || Boolean(lead.quotationId)).length,
        previousValue: previousMonthLeads.filter((lead) => lead.leadStatus === 'Proposal Sent' || Boolean(lead.quotationId)).length,
        icon: FileText,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        description: 'New quotations raised',
      },
      {
        key: 'orderCloser',
        label: 'CLOSED ORDERS',
        value: orderCloser,
        currentValue: currentMonthLeads.filter((lead) => lead.leadStatus === 'Won' || lead.isConverted).length,
        previousValue: previousMonthLeads.filter((lead) => lead.leadStatus === 'Won' || lead.isConverted).length,
        icon: TrendingUp,
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-700',
        description: 'Won sales opportunities',
      },
    ]

    const pipelineLeads = selectedScope.scopeLeads.filter((lead) => !['Won', 'Lost', 'Scrapped'].includes(lead.leadStatus ?? ''))
    const totalPipelineValue = pipelineLeads.reduce((sum, lead) => sum + getLeadRevenueEstimate(lead), 0)
    const totalActiveOpportunities = pipelineLeads.length
    const wonDeals = selectedScope.scopeLeads.filter((lead) => lead.leadStatus === 'Won' || lead.isConverted).length
    const lostDeals = selectedScope.scopeLeads.filter((lead) => lead.leadStatus === 'Lost' || lead.isScrapped).length
    const winRate = wonDeals + lostDeals === 0 ? 0 : (wonDeals / (wonDeals + lostDeals)) * 100
    const lossRate = wonDeals + lostDeals === 0 ? 0 : (lostDeals / (wonDeals + lostDeals)) * 100

    const stageDistribution = ['New', 'Follow-up', 'Interested', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Scrapped'].map((stage) => ({
      stage,
      count: selectedScope.scopeLeads.filter((lead) => (lead.leadStatus ?? 'New') === stage).length,
    }))

    const sourceCounts = selectedScope.scopeLeads.reduce<Record<string, number>>((acc, lead) => {
      const key = lead.sourceOfLead || lead.source || 'Other'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const sourceRows = Object.entries(sourceCounts)
      .map(([source, count]) => ({
        source,
        count,
        percentage: selectedScope.scopeLeads.length === 0 ? 0 : (count / selectedScope.scopeLeads.length) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const sourceRevenue = selectedScope.scopeLeads.reduce<Record<string, number>>((acc, lead) => {
      const key = lead.sourceOfLead || lead.source || 'Other'
      acc[key] = (acc[key] ?? 0) + getLeadRevenueEstimate(lead)
      return acc
    }, {})

    const revenueChannelRows = Object.entries(sourceRevenue)
      .map(([source, value]) => ({ source, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)

    const trendDates = selectedMonth === 'overall'
      ? Array.from({ length: 12 }, (_, index) => new Date(selectedYearNumber, index, 1))
      : [parseMonthKey(`${selectedYearNumber}-${selectedMonth}`)]

    const trendData = trendDates.map((targetDate) => {
      const monthKey = toMonthKey(targetDate)
      const monthOpfs = selectedMonth === 'overall'
        ? selectedScope.yearOpfs.filter((opf) => getMonthKeyFromDateValue(opf.createdDate) === monthKey)
        : selectedScope.scopeOpfs
      const revenue = monthOpfs.reduce((sum, opf) => sum + getOpfRevenue(opf), 0)
      const margin = monthOpfs.reduce((sum, opf) => sum + (getOpfRevenue(opf) - getOpfCost(opf)), 0)
      return { month: targetDate, label: formatMonthLabel(targetDate, 'short'), monthKey, revenue, margin }
    })

    const maxValue = Math.max(...trendData.flatMap((item) => [item.revenue, item.margin]), 1)

    return {
      activeCustomers,
      quotations,
      orderCloser,
      metrics,
      totalPipelineValue,
      totalActiveOpportunities,
      wonDeals,
      lostDeals,
      winRate,
      lossRate,
      stageDistribution,
      sourceRows,
      revenueChannelRows,
      currentRevenue,
      previousRevenue,
      currentMargin,
      previousMargin,
      trendData,
      maxValue,
    }
  }, [selectedMonth, selectedScope, selectedYearNumber])

  const kpiCards = dataset.metrics.map((metric) => {
    const diff = metric.currentValue - metric.previousValue
    const changePercent = percentageChange(metric.currentValue, metric.previousValue)
    const isPositive = diff >= 0
    const comparisonRange = selectedMonth === 'overall'
      ? `vs Overall ${selectedYearNumber - 1}`
      : `vs ${monthRangeLabel(previousMonthKey)}`
    return {
      ...metric,
      diff,
      changePercent,
      isPositive,
      comparisonRange,
    }
  })

  const handleRefresh = () => { void fetchDashboardData() }

  const chartWidth = 760
  const chartHeight = 320
  const padding = 28
  const chartSteps = dataset.trendData.length - 1

  const buildLinePath = (key: 'revenue' | 'margin') => {
    return dataset.trendData
      .map((point, index) => {
        const currentX = padding + (index / Math.max(chartSteps, 1)) * (chartWidth - padding * 2)
        const yMax = dataset.maxValue || 1
        const currentY = chartHeight - padding - (point[key] / yMax) * (chartHeight - padding * 2)
        return `${index === 0 ? 'M' : 'L'} ${currentX} ${currentY}`
      })
      .join(' ')
  }

  const revenuePath = buildLinePath('revenue')
  const marginPath = buildLinePath('margin')
  const isSingleMonthTrend = dataset.trendData.length === 1
  const singleMonthTrend = dataset.trendData[0]
  const singleChartMax = Math.max(singleMonthTrend?.revenue ?? 0, singleMonthTrend?.margin ?? 0, 1)
  const singleChartBaseline = chartHeight - padding
  const singleBarWidth = 100
  const singleBarGap = 28
  const singleRevenueX = chartWidth / 2 - singleBarWidth - singleBarGap / 2
  const singleMarginX = chartWidth / 2 + singleBarGap / 2
  const singleBarHeight = (value: number) => (Math.max(value, 0) / singleChartMax) * (chartHeight - padding * 2)

  const donutSegments = (() => {
    const total = dataset.revenueChannelRows.reduce((sum, item) => sum + item.value, 0)
    let cumulative = 0
    return dataset.revenueChannelRows.map((item) => {
      const start = cumulative
      const end = cumulative + (total === 0 ? 0 : (item.value / total) * 100)
      cumulative = end
      return { ...item, start, end }
    })
  })()

  const donutBackground = donutSegments.length
    ? donutSegments
        .map((segment) => `${segment.value > 0 ? '#2563EB' : '#E5E7EB'} ${segment.start}% ${segment.end}%`)
        .join(', ')
    : '#E5E7EB'

  return (
    <div className="min-h-full">
      <div className="flex min-h-full flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="crm-page-heading">Sales Dashboard</h1>
            {/* <p className="text-xs text-gray-600">Overview of your sales performance</p> */}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-gray-700 shadow-sm">
              <CalendarRange className="h-3.5 w-3.5 text-blue-600" />
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value || 'overall')}
                className="bg-transparent text-xs text-gray-700 outline-none"
              >
                <option value="overall">Overall</option>
                {monthNames.map((month, index) => (
                  <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-[#EFECE5] bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            Loading sales dashboard...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {kpiCards.map((card) => {
                const Icon = card.icon
                const isPositive = card.diff >= 0
                return (
                  <div key={card.key} className="rounded-xl border border-[#EFECE5] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">{card.label}</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
                      </div>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}>
                        <Icon className={`h-4 w-4 ${card.iconColor}`} />
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2.2fr_1fr]">
              <div className="rounded-xl border border-[#EFECE5] bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(210px,1fr)]">
                  <div className="min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-serif font-bold text-gray-900">Revenue &amp; Margin Trend</h2>
                        <p className="text-xs text-gray-500">Monthly revenue and margin overview</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-gray-600">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0B4DDA]" /> Revenue</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#4B1D95]" /> Margin</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[270px] min-w-[620px] w-full">
                    {[0, 1, 2, 3].map((step) => {
                      const y = padding + (step / 3) * (chartHeight - padding * 2)
                      return (
                        <g key={step}>
                          <line x1={padding} x2={chartWidth - padding} y1={y} y2={y} stroke="#E5E7EB" strokeDasharray="4 6" />
                        </g>
                      )
                    })}

                    {isSingleMonthTrend && singleMonthTrend ? (
                      <g>
                        <line x1={padding} x2={chartWidth - padding} y1={singleChartBaseline} y2={singleChartBaseline} stroke="#9CA3AF" />
                        <rect x={singleRevenueX} y={singleChartBaseline - singleBarHeight(singleMonthTrend.revenue)} width={singleBarWidth} height={singleBarHeight(singleMonthTrend.revenue)} rx="4" fill="#0B4DDA" />
                        <rect x={singleMarginX} y={singleChartBaseline - singleBarHeight(singleMonthTrend.margin)} width={singleBarWidth} height={singleBarHeight(singleMonthTrend.margin)} rx="4" fill="#4B1D95" />
                        <text x={singleRevenueX + singleBarWidth / 2} y={Math.max(singleChartBaseline - singleBarHeight(singleMonthTrend.revenue) - 10, 16)} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0B4DDA">{formatCompactCurrency(singleMonthTrend.revenue)}</text>
                        <text x={singleMarginX + singleBarWidth / 2} y={Math.max(singleChartBaseline - singleBarHeight(singleMonthTrend.margin) - 10, 16)} textAnchor="middle" fontSize="12" fontWeight="600" fill="#4B1D95">{formatCompactCurrency(singleMonthTrend.margin)}</text>
                        <text x={chartWidth / 2} y={chartHeight - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#6B7280">{formatMonthLabel(singleMonthTrend.month, 'full')}</text>
                      </g>
                    ) : (
                      <>
                        {dataset.trendData.map((point, index) => {
                          const x = padding + (index / Math.max(chartSteps, 1)) * (chartWidth - padding * 2)
                          return (
                            <g key={point.monthKey}>
                              <line x1={x} x2={x} y1={padding} y2={chartHeight - padding} stroke="#F3F4F6" />
                              <text x={x} y={chartHeight - 6} textAnchor="middle" fontSize="10" fill="#6B7280">{point.label}</text>
                            </g>
                          )
                        })}

                        <path d={revenuePath} fill="none" stroke="#0B4DDA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={marginPath} fill="none" stroke="#4B1D95" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                        {dataset.trendData.map((point, index) => {
                          const x = padding + (index / Math.max(chartSteps, 1)) * (chartWidth - padding * 2)
                          const revenueY = chartHeight - padding - (point.revenue / dataset.maxValue) * (chartHeight - padding * 2)
                          const marginY = chartHeight - padding - (point.margin / dataset.maxValue) * (chartHeight - padding * 2)
                          return (
                            <g key={`${point.monthKey}-dots`}>
                              <circle cx={x} cy={revenueY} r="3" fill="#0B4DDA" />
                              <circle cx={x} cy={marginY} r="3" fill="#4B1D95" />
                            </g>
                          )
                        })}
                      </>
                    )}
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:content-center">
                    <div className="rounded-lg border border-[#EFECE5] bg-slate-50 p-3">
                      <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">Revenue</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(dataset.currentRevenue)}</p>
                      <p className="mt-1 text-xs text-gray-500">vs {formatCurrency(dataset.previousRevenue)}</p>
                    </div>
                    <div className="rounded-lg border border-[#EFECE5] bg-slate-50 p-3">
                      <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">Margin</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(dataset.currentMargin)}</p>
                      <p className="mt-1 text-xs text-gray-500">vs {formatCurrency(dataset.previousMargin)}</p>
                    </div>
                    <div className="rounded-lg border border-[#EFECE5] bg-slate-50 p-3">
                      <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">Margin %</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">
                        {dataset.currentRevenue === 0 ? '0.00%' : `${((dataset.currentMargin / dataset.currentRevenue) * 100).toFixed(2)}%`}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">Current month overview</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#EFECE5] bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-serif font-bold text-gray-900">Pipeline Summary</h2>
                  <Target className="h-4 w-4 text-violet-600" />
                </div>

                <div className="space-y-2.5">
<div className="rounded-lg bg-violet-50 p-2.5">
                      <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-800">Total pipeline value</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-[#EFECE5] bg-white p-2">
                      <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">Active opps</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{dataset.totalActiveOpportunities}</p>
                    </div>
                    <div className="rounded-lg border border-[#EFECE5] bg-white p-2">
                      <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">Won deals</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{dataset.wonDeals}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-[#EFECE5] bg-white p-2">
                      <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">Lost deals</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{dataset.lostDeals}</p>
                    </div>
                    <div className="rounded-lg border border-[#EFECE5] bg-white p-2">
                      <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">Win rate</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{dataset.winRate.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#EFECE5] bg-white p-2">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-gray-600">
                      <span>Loss rate</span>
                      <span>{dataset.lossRate.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(dataset.lossRate, 100)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <p className="dashboard-label text-[10px] font-semibold uppercase tracking-normal text-gray-500">Stage distribution</p>
                    {dataset.stageDistribution.filter((item) => item.count > 0).map((item) => (
                      <div key={item.stage}>
                        <div className="mb-1 flex items-center justify-between text-[10px] text-gray-600">
                          <span>{item.stage}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${(item.count / Math.max(leads.length, 1)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-[#EFECE5] bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-serif font-bold text-gray-900">Top Sources</h3>
                  <BarChart3 className="h-4 w-4 text-gray-500" />
                </div>
                <div className="space-y-2.5">
                  {dataset.sourceRows.map((row) => (
                    <div key={row.source}>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-gray-700">
                        <span>{row.source}</span>
                        <span>{row.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600" style={{ width: `${row.percentage}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">{row.percentage.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#EFECE5] bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-serif font-bold text-gray-900">Revenue by Channel</h3>
                  <TrendingUp className="h-4 w-4 text-gray-500" />
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 rounded-full" style={{ background: `conic-gradient(${donutBackground})` }}>
                    <div className="absolute inset-[18%] rounded-full bg-white" />
                  </div>
                  <div className="flex-1 space-y-2">
                    {dataset.revenueChannelRows.map((row, index) => (
                      <div key={row.source} className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 text-[16px] text-gray-700">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ['#0B4DDA', '#4B1D95', '#2F5DBD', '#6E7AF5'][index % 4] }} />
                          {row.source}
                        </div>
                        <span className="font-medium text-gray-700">{formatCompactCurrency(row.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  )
}
