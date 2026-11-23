import axios from 'axios'
import { getAuthHeaders } from './apiAuth'

export type AnalyticsPeriod =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'yearly'
  | 'custom'

export interface AnalyticsFilters {
  period: AnalyticsPeriod
  startDate?: string
  endDate?: string
}

export interface AnalyticsRow {
  label?: string
  stage?: string
  status?: string
  type?: string
  accountType?: string
  source?: string
  employee?: string
  customer?: string
  product?: string
  revenue?: number
  margin?: number
  count?: number
  deals?: number
  quantity?: number
  quotations?: number
  leadsAssigned?: number
  leadsConverted?: number
  activitiesCompleted?: number
}

export interface SalesAnalytics {
  companyName: string
  periodLabel: string
  generatedAt: string
  kpis: {
    totalRevenue: number
    totalQuotations: number
    customers: number
    totalLeads: number
    convertedLeads: number
    pendingFollowUps: number
    totalMargin: number
    activities: number
    orders: number
  }
  changes: {
    totalRevenue: number | null
    totalQuotations: number | null
    customers: number | null
    opportunities: number | null
    convertedLeads: number | null
    pendingFollowUps: number | null
  }
  charts: {
    revenueTrend: AnalyticsRow[]
    monthlyRevenue: AnalyticsRow[]
    revenueMarginByMonth: AnalyticsRow[]
    funnel: AnalyticsRow[]
    leadConversion: AnalyticsRow[]
    leadStatus: AnalyticsRow[]
    leadSources: AnalyticsRow[]
    customerRevenue: AnalyticsRow[]
    customerAcquisition: AnalyticsRow[]
    customerDistribution: AnalyticsRow[]
    customerStatus: AnalyticsRow[]
    quotationsByCustomer: AnalyticsRow[]
    employeeRevenue: AnalyticsRow[]
    employeePerformance: AnalyticsRow[]
    leadsAssignedByEmployee: AnalyticsRow[]
    leadsConvertedByEmployee: AnalyticsRow[]
    completedActivitiesByEmployee: AnalyticsRow[]
    productRevenue: AnalyticsRow[]
    productQuantities: AnalyticsRow[]
    productQuotationCounts: AnalyticsRow[]
    activityTrend: AnalyticsRow[]
    activityByType: AnalyticsRow[]
    activityCompletion: AnalyticsRow[]
    activityByStatus: AnalyticsRow[]
    followUpOverdue: AnalyticsRow[]
  }
  breakdown: {
    revenue: Array<{
      employee: string
      customer: string
      product: string
      revenue: number
      margin: number
      date: string
    }>
    employees: AnalyticsRow[]
    customers: AnalyticsRow[]
    products: AnalyticsRow[]
  }
}

export type AssistantIntent = 'greeting' | 'issue' | 'chat' | 'crm'
export type AssistantChartKey = 'revenueTrend' | 'customers' | 'quotations' | 'employees' | 'funnel' | 'products' | 'activities'
export type AssistantTable = { title: string; columns: string[]; rows: string[][] }
export type AssistantHistoryMessage = { role: 'user' | 'assistant'; content: string }

export interface AssistantResult {
  answer: string
  chartKey: AssistantChartKey | null
  table: AssistantTable | null
  intent?: AssistantIntent
  generatedAt: string
  details?: Record<string, { records?: Array<Record<string, string>>; truncated?: boolean }>
}

const queryParams = (filters: AnalyticsFilters) => ({
  period: filters.period,
  ...(filters.period === 'custom' ? { startDate: filters.startDate, endDate: filters.endDate } : {}),
})

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export const salesAnalyticsApi = {
  async getAnalytics(filters: AnalyticsFilters): Promise<SalesAnalytics> {
    try {
      const response = await axios.get('/api/reports/analytics', {
        headers: getAuthHeaders(),
        params: queryParams(filters),
      })
      if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || 'Unable to load Sales analytics.')
      }
      return response.data.data as SalesAnalytics
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Unable to load Sales analytics.'))
    }
  },

  async exportExcel(filters: AnalyticsFilters): Promise<Blob> {
    try {
      const response = await axios.get('/api/reports/analytics/export.xlsx', {
        headers: getAuthHeaders(),
        params: queryParams(filters),
        responseType: 'blob',
      })
      return response.data as Blob
    } catch (error) {
      let message = 'Unable to export the Sales report.'
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        try {
          const payload = JSON.parse(await error.response.data.text())
          message = payload.message || message
        } catch {
          message = getErrorMessage(error, message)
        }
      } else {
        message = getErrorMessage(error, message)
      }
      throw new Error(message)
    }
  },

  async askAssistant(
    question: string,
    filters: AnalyticsFilters,
    history: AssistantHistoryMessage[] = [],
  ): Promise<AssistantResult> {
    try {
      const response = await axios.post(
        '/api/reports/analytics/assistant',
        { question, filters: queryParams(filters), history },
        { headers: getAuthHeaders(), timeout: 270000 },
      )
      if (!response.data?.success || !response.data?.data?.answer) {
        throw new Error(response.data?.message || 'The Sales AI assistant could not answer this question.')
      }
      return response.data.data as AssistantResult
    } catch (error) {
      throw new Error(getErrorMessage(error, 'The Sales AI assistant could not answer this question.'))
    }
  },

  async reportAssistantIssue(payload: {
    message: string
    page: string
    recentMessages: AssistantHistoryMessage[]
  }): Promise<string> {
    try {
      const response = await axios.post(
        '/api/reports/analytics/assistant/report-issue',
        payload,
        { headers: getAuthHeaders(), timeout: 270000 },
      )
      if (!response.data?.success || typeof response.data?.message !== 'string') {
        throw new Error(response.data?.message || 'Unable to send the report right now. Please try again later.')
      }
      return response.data.message
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Unable to send the report right now. Please try again later.'))
    }
  },
}
