import axios from 'axios'
import { getAuthHeaders } from './apiAuth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

export type DashboardPeriod = 'all' | 'month' | 'quarter' | 'year'
export type FollowUpCategory = 'Activity' | 'Funnel' | 'Lead' | 'Renewal'

export interface DashboardRevenueRow {
  month: string
  funnelsCreated: number
  funnelsClosed: number
  revenue: number
  margin: number
}

export interface DashboardShareRow {
  label: string
  revenue: number
  percentage: number
}

export interface DashboardFollowUp {
  id: string
  category: FollowUpCategory
  title: string
  detail: string
  assignedTo: string
  dueDate: string
  href: string
}

export interface DashboardTask {
  id: string
  assignedTo: string
  title: string
  detail: string
  dueDate: string
  href: string
}

export interface DashboardData {
  user: {
    name: string
    email: string
    role: string
    designation: string
    department: string
    branch: string
    photo: string
    initials: string
  }
  summary: {
    opportunities: { total: number; currentYear: number; previousYear: number; open: number }
    quotations: { total: number; currentYear: number; previousYear: number; open: number }
    opfs: { total: number; currentYear: number; previousYear: number }
    meetings: { total: number; currentYear: number; previousYear: number }
  }
  earnings: { target: number | null; achievement: number; revenue: number }
  followUps: {
    counts: { all: number; overdue: number; today: number; upcoming: number }
    records: DashboardFollowUp[]
  }
  openTasks: DashboardTask[]
  analytics: {
    period: DashboardPeriod
    revenueTrend: DashboardRevenueRow[]
    oemSales: DashboardShareRow[]
    topProducts: DashboardShareRow[]
    topCustomers: DashboardShareRow[]
    today: { customers: number; funnels: number; quotations: number; opfs: number; activities: number }
  }
  expectedClosures: Array<{
    id: string
    quoteNumber: string
    company: string
    accountManager: string
    revenue: number
    expectedClosureDate: string
    productDetails: string
    href: string
  }>
}

export async function fetchDashboard(period: DashboardPeriod): Promise<DashboardData> {
  const { data } = await axios.get(`${API_BASE_URL}/dashboard`, {
    params: { period },
    headers: getAuthHeaders(),
  })
  if (!data?.success || !data.data) {
    throw new Error(data?.message || 'Unable to load Sales dashboard data.')
  }
  const dashboard = data.data as DashboardData
  const photo = dashboard.user.photo
  return {
    ...dashboard,
    user: {
      ...dashboard.user,
      photo: photo && !/^https?:\/\//i.test(photo)
        ? `${API_BASE_URL.replace(/\/api\/?$/, '')}${photo.startsWith('/') ? photo : `/${photo}`}`
        : photo,
    },
  }
}
