import axios from 'axios'
import { getAuthHeaders } from './apiAuth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const getApiErrorMessage = async (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : fallback
  let responseData = error.response?.data
  if (responseData instanceof Blob) {
    try {
      responseData = JSON.parse(await responseData.text())
    } catch {
      responseData = null
    }
  }
  return typeof responseData?.message === 'string' ? responseData.message : error.message || fallback
}

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'custom'
export type AnalyticsChartKey = 'revenueTrend' | 'customers' | 'employees' | 'funnel' | 'products' | 'activities' | null

export interface SalesAnalytics {
  companyName: string
  period: AnalyticsPeriod
  periodLabel: string
  generatedAt: string
  comparison: {
    periodLabel: string
    totalRevenue: number
    totalMargin: number
    totalDeals: number
    totalQuotations: number
    totalLeads: number
    convertedLeads: number
    pendingQuotations: number
    wonDeals: number
    lostDeals: number
    conversionRate: number
    customers: number
    activities: number
    orders: number
    pendingFollowUps: number
  }
  changes: {
    totalRevenue: number | null
    totalMargin: number | null
    totalQuotations: number | null
    customers: number | null
    activities: number | null
    opportunities: number | null
    convertedLeads: number | null
    conversionRate: number | null
    orders: number | null
    pendingFollowUps: number | null
  }
  kpis: {
    totalRevenue: number
    totalDeals: number
    totalLeads: number
    convertedLeads: number
    totalQuotations: number
    conversionRate: number
    quotationConversionRate: number
    pendingQuotations: number
    wonDeals: number
    lostDeals: number
    orders: number
    totalMargin: number
    customers: number
    activities: number
    opportunities: number
    pendingFollowUps: number
  }
  charts: {
    revenueTrend: Array<{ label: string; revenue: number }>
    monthlyRevenue: Array<{ label: string; revenue: number }>
    revenueMarginByMonth: Array<{ label: string; revenue: number; margin: number }>
    quarterlyRevenue: Array<{ label: string; revenue: number }>
    funnel: Array<{ stage: string; count: number }>
    leadStatus: Array<{ status: string; count: number }>
    leadSources: Array<{ source: string; count: number }>
    customerRevenue: Array<{ customer: string; revenue: number; deals: number }>
    employeeRevenue: Array<{ employee: string; revenue: number; deals: number }>
    targetAchievement: { target: number | null; achieved: number; percentage: number | null }
    productRevenue: Array<{ product: string; revenue: number; deals: number }>
    productQuantities: Array<{ product: string; quantity: number }>
    productTrend: Array<{ product: string; values: Array<{ label: string; revenue: number }> }>
    customerAcquisition: Array<{ label: string; count: number }>
    customerStatus: Array<{ status: string; count: number }>
    quotationTrend: Array<{ label: string; count: number }>
    quotationStatus: Array<{ status: string; count: number }>
    activityByType: Array<{ type: string; count: number }>
    activityByStatus: Array<{ status: string; count: number }>
    followUpOverdue: Array<{ label: string; count: number }>
    activityTrend: Array<{ label: string; count: number }>
    activityByEmployee: Array<{ employee: string; count: number }>
    employeeQuotations: Array<{ employee: string; quotations: number; won: number }>
    upcomingFollowUps: Array<{ customer: string; employee: string; followUpDate: string; status: string }>
    expectedRevenueByStage: Array<{ stage: string; revenue: number }>
    activityHeatmap: Array<{ date: string; count: number }>
  }
  breakdown: {
    revenue: Array<{ employee: string; customer: string; product: string; revenue: number; margin: number; date: string }>
    employees: Array<{ employee: string; revenue: number; deals: number }>
    customers: Array<{ customer: string; revenue: number; deals: number }>
    products: Array<{ product: string; revenue: number; deals: number }>
    funnel: Array<{ stage: string; count: number }>
  }
}

export interface AnalyticsFilters {
  period: AnalyticsPeriod
  startDate?: string
  endDate?: string
}

export interface SalesAssistantDetails {
  pendingLeads?: {
    records: Array<{ leadId: string; company: string; status: string; assignedTo: string; followUpDate: string }>
    truncated: boolean
  }
  activities?: {
    records: Array<{ activityId: string; customer: string; type: string; assignedTo: string; followUpDate: string; status: string }>
    truncated: boolean
  }
}

const paramsFor = (filters: AnalyticsFilters) => ({
  period: filters.period,
  ...(filters.period === 'custom' ? { startDate: filters.startDate, endDate: filters.endDate } : {}),
})

export async function fetchSalesAnalytics(filters: AnalyticsFilters): Promise<SalesAnalytics> {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/reports/analytics`, {
      params: paramsFor(filters),
      headers: getAuthHeaders(),
    })
    if (!data?.success || !data.data) {
      throw new Error(data?.message || 'Unable to load Sales analytics.')
    }
    return data.data as SalesAnalytics
  } catch (error) {
    throw new Error(await getApiErrorMessage(error, 'Unable to load Sales analytics.'))
  }
}

export async function askSalesAssistant(question: string, filters: AnalyticsFilters): Promise<{
  answer: string
  chartKey: AnalyticsChartKey
  details?: SalesAssistantDetails
}> {
  try {
    const { data } = await axios.post(`${API_BASE_URL}/reports/analytics/assistant`, {
      question,
      filters: paramsFor(filters),
    }, { headers: getAuthHeaders() })
    if (!data?.success || !data.data) {
      throw new Error(data?.message || 'Unable to get an answer from the Sales AI assistant.')
    }
    return data.data
  } catch (error) {
    throw new Error(await getApiErrorMessage(error, 'Unable to get an answer from the Sales AI assistant.'))
  }
}

export async function downloadSalesAnalytics(filters: AnalyticsFilters): Promise<void> {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/reports/analytics/export.xlsx`, {
      params: paramsFor(filters),
      headers: getAuthHeaders(),
      responseType: 'blob',
    })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sales-analytics.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    throw new Error(await getApiErrorMessage(error, 'Unable to export the Sales report.'))
  }
}
