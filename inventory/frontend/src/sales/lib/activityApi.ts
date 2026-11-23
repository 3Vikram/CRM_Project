import axios from 'axios';
import { getAuthHeaders } from './apiAuth';

const API_BASE_URL = '/api';

export interface ActivityRecord {
  _id: string;
  activityId?: string;
  leadId: string;
  leadSource: string;
  customerName: string;
  contactPerson: string;
  designation: string;
  email: string;
  mobileNo: string;
  sourceOfLead: string;
  customerRequirements: string;
  customerRemarks: string;
  assignedUser: string;
  assignedUserId?: string;
  leadIdLabel: string;
  company: string;
  priority: string;
  campaign: string;
  activityType: string;
  activityDate: string;
  location: string;
  response: string;
  followUp: string;
  product: string;
  tagResource: string;
  followUpDate: string;
  reminder: string;
  status: string;
  effectiveStatus?: string;
  createdBy: string;
  createdById?: string;
  lastModifiedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityListResponse {
  success: boolean;
  data: ActivityRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type ActivityAnalyticsDateRange = 'today' | 'week' | 'month' | 'year' | 'custom';
export type ActivityPerformanceInterval = 'daily' | 'weekly' | 'monthly';

export interface ActivityAnalytics {
  generatedAt: string;
  filters: {
    activityType: string;
    dateRange: ActivityAnalyticsDateRange;
    performanceRange: 'week' | 'month' | 'year';
    performanceInterval: ActivityPerformanceInterval;
    employeeId: string;
    employeeName: string;
  };
  range: { start: string; end: string };
  cards: {
    totalActivities: number;
    todaysFollowUps: number;
    pendingFollowUps: number;
    positiveResponses: number;
    negativeResponses: number;
    demos: number;
    funnelsGenerated: number;
    missedFollowUps: number;
    successRate: number;
  };
  charts: {
    activityPerformance: Array<{ label: string; count: number }>;
    callsVsMeetings: Array<{ label: string; calls: number; meetings: number }>;
    followUpCompletion: Array<{ type: string; total: number; completed: number; pending: number; rate: number }>;
    productAnalysis: Array<{ product: string; count: number }>;
    weeklyTrend: Array<{ label: string; weekStart: string; total: number; completed: number; missed: number }>;
    activityTypeDistribution: Array<{ type: string; count: number }>;
    employeePerformance: Array<{ employee: string; count: number; completed: number; missed: number }>;
    salesDistribution: { available: boolean; reason?: string; inside?: number; field?: number };
  };
  employees: Array<{ id: string; name: string }>;
  timeline: Array<{
    id: string;
    activityId: string;
    activityType: string;
    customerName: string;
    assignedUser: string;
    scheduledTime: string | null;
    status: string;
  }>;
}

export interface ActivityAnalyticsResponse {
  success: boolean;
  data: ActivityAnalytics;
}

export async function fetchActivityAnalytics(params: {
  activityType?: string;
  dateRange?: ActivityAnalyticsDateRange;
  performanceRange?: 'week' | 'month' | 'year';
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  employeeName?: string;
  performanceInterval?: ActivityPerformanceInterval;
} = {}) {
  const response = await axios.get(`${API_BASE_URL}/activities/analytics`, { params, headers: getAuthHeaders() });
  return response.data as ActivityAnalyticsResponse;
}

export async function fetchActivities(params: {
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
  createdBy?: string;
  createdById?: string;
  customerName?: string;
  activityDatePreset?: string;
  followUpPreset?: string;
  response?: string;
  activityId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}) {
  const response = await axios.get(`${API_BASE_URL}/activities`, { params, headers: getAuthHeaders() });
  return response.data as ActivityListResponse;
}

export async function createActivity(payload: Partial<ActivityRecord>) {
  const response = await axios.post(`${API_BASE_URL}/activities`, payload, { headers: getAuthHeaders() });
  return response.data;
}

export async function checkActivityCompany(companyName: string) {
  const response = await axios.get(`${API_BASE_URL}/activities/check-company`, {
    params: { companyName },
    headers: getAuthHeaders(),
  });
  return response.data as { success: boolean; exists: boolean };
}

export async function updateActivity(id: string, payload: Partial<ActivityRecord>) {
  const response = await axios.put(`${API_BASE_URL}/activities/${id}`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function deleteActivity(id: string) {
  const response = await axios.delete(`${API_BASE_URL}/activities/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function fetchActivityById(id: string) {
  const response = await axios.get(`${API_BASE_URL}/activities/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}
