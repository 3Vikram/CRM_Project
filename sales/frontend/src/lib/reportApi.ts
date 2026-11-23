import axios from 'axios'
import { getAuthHeaders } from './apiAuth'

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
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
} = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.search) searchParams.set('search', params.search)
  if (params.createdBy && params.createdBy !== 'all') searchParams.set('createdBy', params.createdBy)
  if (params.createdDate && params.createdDate !== 'all') searchParams.set('createdDate', params.createdDate)
  if (params.customerName && params.customerName !== 'all') searchParams.set('customerName', params.customerName)
  if (params.product && params.product !== 'all') searchParams.set('product', params.product)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const response = await axios.get<RevenueMarginResponse>(`${API_BASE_URL}/reports/revenue-margin?${searchParams.toString()}`, { headers: getAuthHeaders() })
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
  search?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
} = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== 'all') searchParams.set(key, String(value))
  })
  const response = await axios.get<ReportResponse>(`${API_BASE_URL}/reports/${reportKey}?${searchParams.toString()}`, { headers: getAuthHeaders() })
  return response.data
}

export async function downloadReportExcel(reportKey: string, params: {
  search?: string
  createdBy?: string
  createdDate?: string
  customerName?: string
  product?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
} = {}) {
  const searchParams = new URLSearchParams({ format: 'xlsx' })
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== 'all') searchParams.set(key, String(value))
  })
  const exportPath = reportKey === 'revenue-margin'
    ? `${API_BASE_URL}/reports/revenue-margin`
    : `${API_BASE_URL}/reports/export/${encodeURIComponent(reportKey)}`
  const response = await axios.get<Blob>(`${exportPath}?${searchParams.toString()}`, {
    headers: getAuthHeaders(),
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `${reportKey}-report.xlsx`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
