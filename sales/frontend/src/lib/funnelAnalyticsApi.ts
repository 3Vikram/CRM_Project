import axios from 'axios'
import { getAuthHeaders } from './apiAuth'

export type FunnelGranularity = 'daily' | 'weekly' | 'monthly'

export interface FunnelAnalyticsFilters {
  startDate: string
  endDate: string
  granularity: FunnelGranularity
  stage?: string
  resource?: string
  accountManager?: string
  sbu?: string
  oem?: string
  branch?: string
}

export interface FunnelAnalyticsData {
  range: { start: string; end: string }
  granularity: FunnelGranularity
  filterOptions: {
    stages: string[]
    resources: string[]
    accountManagers: Array<{ id: string; name: string }>
    sbus: string[]
    oems: string[]
    branches: string[]
  }
  kpis: {
    totalFunnels: number
    openFunnels: number
    quotationsGenerated: number
    closedFunnels: number
    lostFunnels: number
    totalRevenue: number | null
    totalMargin: number | null
    expiredFunnels: number
    demoConducted: number
    conversionRate: number
    revenueAvailableCount: number
    marginAvailableCount: number
  }
  trend: Array<{ label: string; current: number | null; previous: number | null }>
  stages: Array<{
    stage: string
    count: number
    conversionPercent: number
    revenue: number | null
    margin: number | null
    averageDaysInStage: number | null
  }>
  revenueByStage: Array<{ stage: string; revenue: number | null }>
  sbuAnalytics: Array<{ sbu: string; count: number; revenue: number | null }>
  topCustomers: Array<{ customer: string; revenue: number | null; margin: number | null; count: number }>
  topProducts: Array<{ product: string; funnelCount: number; revenue: number | null; margin: number | null }>
  leaderboard: Array<{ rank: number; employee: string; employeeId: string; deals: number; revenue: number | null }>
}

export async function fetchFunnelAnalytics(filters: FunnelAnalyticsFilters): Promise<FunnelAnalyticsData> {
  try {
    const response = await axios.get('/api/funnels/analytics', {
      headers: getAuthHeaders(),
      params: filters,
    })
    if (!response.data?.success || !response.data?.data) {
      throw new Error(response.data?.message || 'Unable to load Funnel analytics.')
    }
    return response.data.data as FunnelAnalyticsData
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || error.message || 'Unable to load Funnel analytics.')
    }
    throw error
  }
}
