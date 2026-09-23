import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

export interface RevenueMarginRow {
  createdBy: string
  customer?: string
  product?: string
  quantity?: number
  cost?: number
  profit?: number
  marginPercent?: number
  revenue: number
  margin: number
}

export interface RevenueMarginOptions {
  createdBy: string[]
  createdDates: string[]
  customerNames: string[]
  products: string[]
}

export interface RevenueMarginResponse {
  success: boolean
  data: RevenueMarginRow[]
  options: RevenueMarginOptions
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function fetchRevenueMarginReport(params: {
  page?: number
  limit?: number
  search?: string
  createdBy?: string
  createdDate?: string
  customerName?: string
  product?: string
} = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.search) searchParams.set('search', params.search)
  if (params.createdBy && params.createdBy !== 'all') searchParams.set('createdBy', params.createdBy)
  if (params.createdDate && params.createdDate !== 'all') searchParams.set('createdDate', params.createdDate)
  if (params.customerName && params.customerName !== 'all') searchParams.set('customerName', params.customerName)
  if (params.product && params.product !== 'all') searchParams.set('product', params.product)

  const response = await axios.get<RevenueMarginResponse>(`${API_BASE_URL}/reports/revenue-margin?${searchParams.toString()}`)
  return response.data
}

export interface ReportResponse {
  success: boolean
  data: Array<Record<string, string | number>>
  options?: RevenueMarginOptions
  unavailable?: boolean
  message?: string
  pagination?: { total: number; page: number; limit: number; totalPages: number }
}

export async function fetchReport(reportKey: string, params: {
  page?: number
  limit?: number
  createdBy?: string
  createdDate?: string
  customerName?: string
  product?: string
} = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== 'all') searchParams.set(key, String(value))
  })
  const response = await axios.get<ReportResponse>(`${API_BASE_URL}/reports/${reportKey}?${searchParams.toString()}`)
  return response.data
}
