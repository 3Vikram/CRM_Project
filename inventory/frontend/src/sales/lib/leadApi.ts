import axios from 'axios';
import { getAuthHeaders } from './apiAuth';
import { clearApiCache, getCachedResponse } from './apiCache';

const API_BASE_URL = '/api';

export interface LeadRecord {
  _id: string;
  customerId?: string;
  leadId?: string;
  quotationId?: string;
  quotationType?: 'rent' | 'sold';
  companyName?: string;
  contactPerson?: string;
  designation?: string;
  email?: string;
  mobile?: string;
  source?: string;
  sourceOfLead?: string;
  campaignId?: string;
  campaignName?: string;
  openCount?: number;
  emailOpenCount?: number;
  linkClicks?: number;
  downloads?: number;
  replies?: number;
  websiteVisits?: number;
  leadScore?: number;
  priority?: string;
  leadStatus?: string;
  assignedTo?: string;
  createdBy?: string;
  createdDate?: string;
  followUpDate?: string;
  followUpTime?: string;
  customerRequirements?: string;
  remarks?: string;
  lastOpenTime?: string;
  timeline?: Array<{ title?: string; description?: string; createdAt?: string }>;
  notes?: Array<{ message?: string; createdBy?: string; createdAt?: string }>;
  isConverted?: boolean;
  isScrapped?: boolean;
  reason?: string;
  products?: Array<{
    productName?: string;
    productDescription?: string;
    hsnSac?: string;
    quantity?: string | number;
    expectedVendorPrice?: string | number;
    unitPrice?: string | number;
    tax?: string;
  }>;
  quotationDetails?: {
    subject?: string;
    serviceName?: string;
    serviceCost?: string | number;
    serviceTax?: string | number;
    freightName?: string;
    freightCost?: string | number;
    freightTax?: string | number;
    dollarInRupee?: string | number;
    wht?: string | number;
    partnerMargin?: string | number;
    currency?: string;
    validity?: string | number;
    delivery?: string;
    payment?: string;
    expectedClosure?: string;
    note?: string;
    value?: string | number;
    revenue?: string | number;
    marginPercent?: string | number;
    sbu?: string;
    oem?: string;
    stage?: string;
    probability?: string;
    demo?: string;
    poc?: string;
    tagResource?: string;
    enterpriseQuot?: string;
    addressRequired?: boolean;
    signatureRequired?: boolean;
  };
}

export interface LeadListResponse {
  data: LeadRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface LeadAnalytics {
  filters: {
    status: string;
    source: string;
    employeeId: string;
    employeeName: string;
    availableStatuses: string[];
    availableSources: string[];
    availableEmployees: Array<{ id: string; name: string }>;
  };
  range: { start: string; end: string };
  kpis: {
    totalLeads: number;
    openLeads: number;
    conversionRate: number;
    expiringFollowUps: number;
    leadsThisMonth: number;
    convertedToActivity: number;
    convertedToFunnel: number;
    convertedToQuotation: number;
    leadsScrapped: number;
    monthlyFollowUps: number;
  };
  charts: {
    leadsBySource: Array<{ source: string; count: number }>;
    monthlyTrend: Array<{ month: string; label: string; count: number }>;
    topEmployees: Array<{ employeeId: string; employee: string; leadCount: number; pipelineValue: number | null; pipelineValueAvailable: boolean }>;
    leadFunnel: Array<{ stage: string; count: number; percent: number }>;
    followUpAnalysis: { overdue: number; unscheduled: number };
    leadAging: {
      groups: Array<{ age: string; count: number; percent: number }>;
      activeWithin15Days: number;
      staleMoreThan30Days: number;
      totalOpenLeads: number;
      averageLeadAge: number | null;
    };
    productAnalysis: Array<{ name: string; total: number; converted: number; scrapped: number; conversionPercent: number }>;
    productAvailable: boolean;
    pipelineValueAvailable: boolean;
  };
}

export async function fetchLeadAnalytics(params: {
  startDate?: string;
  endDate?: string;
  status?: string;
  source?: string;
  employeeId?: string;
  employeeName?: string;
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const response = await axios.get(`/api/leads/analytics?${searchParams.toString()}`, {
    headers: getAuthHeaders(),
  });
  return response.data as { success: boolean; data: LeadAnalytics };
}

export async function fetchLeads(params: { page?: number; limit?: number; search?: string; status?: string; priority?: string; source?: string; assignedTo?: string; campaign?: string; quotationType?: 'rent' | 'sold'; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  if (params.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params.priority && params.priority !== 'all') searchParams.set('priority', params.priority);
  if (params.source && params.source !== 'all') searchParams.set('source', params.source);
  if (params.assignedTo) searchParams.set('assignedTo', params.assignedTo);
  if (params.campaign) searchParams.set('campaign', params.campaign);
  if (params.quotationType) searchParams.set('quotationType', params.quotationType);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const cacheKey = `leads:${searchParams.toString()}`;
  return getCachedResponse<LeadListResponse>(cacheKey, async () => {
    const response = await axios.get(`${API_BASE_URL}/leads?${searchParams.toString()}`, {
      headers: getAuthHeaders(),
    });
    return {
      data: response.data?.data ?? [],
      pagination: response.data?.pagination ?? { total: 0, page: 1, limit: 10, totalPages: 1 },
    } as LeadListResponse;
  }, 30_000);
}

export async function fetchLeadById(id: string) {
  const cacheKey = `lead:${id}`;
  return getCachedResponse<LeadRecord | null>(cacheKey, async () => {
    const response = await axios.get(`${API_BASE_URL}/leads/${id}`, {
      headers: getAuthHeaders(),
    });
    return response.data?.data ?? null;
  }, 30_000);
}

export async function createLead(payload: Partial<LeadRecord>) {
  const response = await axios.post(`${API_BASE_URL}/leads`, payload, {
    headers: getAuthHeaders(),
  });
  clearApiCache();
  return response.data;
}

export async function updateLead(id: string, payload: Partial<LeadRecord>) {
  const response = await axios.put(`${API_BASE_URL}/leads/${id}`, payload, {
    headers: getAuthHeaders(),
  });
  clearApiCache();
  return response.data;
}

export async function deleteLead(id: string) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/leads/${encodeURIComponent(id)}`, {
      headers: getAuthHeaders(),
    });
    clearApiCache();
    return response.data;
  } catch (error) {
    console.error('Delete lead error:', axios.isAxiosError(error) ? error.response?.data || error.message : error);
    throw error;
  }
}

export async function moveLeadToActivity(id: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/move-activity`, { id }, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function moveLeadToFunnel(id: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/move-funnel`, { id }, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function generateLeadQuotation(id: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/generate-quotation`, { id }, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function convertLeadToCustomer(id: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/convert-customer`, { id }, {
    headers: getAuthHeaders(),
  });
  if (response.data?.success) {
    clearApiCache();
    window.dispatchEvent(new Event('sales:lead-converted'));
  }
  return response.data;
}

export async function scrapLead(id: string, reason: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/scrap`, { id, reason }, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function triggerMailOpenEvent(payload: Partial<LeadRecord> & { email: string }) {
  const response = await axios.post(`${API_BASE_URL}/leads/mailcampaign/open-event`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function sendQuotationPdf(id: string, pdfData: string, recipientEmail: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/${id}/send-pdf`, {
    pdfData,
    recipientEmail,
  }, {
    headers: getAuthHeaders(),
  });
  return response.data;
}
