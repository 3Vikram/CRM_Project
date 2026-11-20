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
  filters: Required<Pick<FunnelAnalyticsFilters, 'stage' | 'resource' | 'accountManager' | 'sbu' | 'oem' | 'branch'>>
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
    dropOffPercent: number | null
    revenue: number | null
    margin: number | null
    averageDaysInStage: number | null
    averageDaysInStageCount: number
    dropOffUnavailableReason: string
    order: number
  }>
  revenueByStage: Array<{ stage: string; revenue: number | null }>
  sbuAnalytics: Array<{ sbu: string; count: number; revenue: number | null; revenueCount: number }>
  topCustomers: Array<{ customer: string; revenue: number | null; margin: number | null; count: number }>
  topProducts: Array<{ product: string; funnelCount: number; revenue: number | null; margin: number | null }>
  leaderboard: Array<{ rank: number; employee: string; employeeId: string; deals: number; revenue: number | null; revenueCount: number }>
}

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) return error.response?.data?.message || error.message
  if (error instanceof Error) return error.message
  return 'Unable to load Funnel analytics.'
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
    throw new Error(getErrorMessage(error))
  }
}
