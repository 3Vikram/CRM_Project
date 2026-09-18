import axios from 'axios';
import { getCachedResponse } from './apiCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

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
    const response = await axios.get(`${API_BASE_URL}/leads?${searchParams.toString()}`);
    return {
      data: response.data?.data ?? [],
      pagination: response.data?.pagination ?? { total: 0, page: 1, limit: 10, totalPages: 1 },
    } as LeadListResponse;
  }, 30_000);
}

export async function fetchLeadById(id: string) {
  const cacheKey = `lead:${id}`;
  return getCachedResponse<LeadRecord | null>(cacheKey, async () => {
    const response = await axios.get(`${API_BASE_URL}/leads/${id}`);
    return response.data?.data ?? null;
  }, 30_000);
}

export async function createLead(payload: Partial<LeadRecord>) {
  const response = await axios.post(`${API_BASE_URL}/leads`, payload);
  return response.data;
}

export async function updateLead(id: string, payload: Partial<LeadRecord>) {
  const response = await axios.put(`${API_BASE_URL}/leads/${id}`, payload);
  return response.data;
}

export async function deleteLead(id: string) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/leads/${encodeURIComponent(id)}`);
    return response.data;
  } catch (error) {
    console.error('Delete lead error:', axios.isAxiosError(error) ? error.response?.data || error.message : error);
    throw error;
  }
}

export async function moveLeadToActivity(id: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/move-activity`, { id });
  return response.data;
}

export async function moveLeadToFunnel(id: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/move-funnel`, { id });
  return response.data;
}

export async function generateLeadQuotation(id: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/generate-quotation`, { id });
  return response.data;
}

export async function convertLeadToCustomer(id: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/convert-customer`, { id });
  return response.data;
}

export async function scrapLead(id: string, reason: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/scrap`, { id, reason });
  return response.data;
}

export async function triggerMailOpenEvent(payload: Partial<LeadRecord> & { email: string }) {
  const response = await axios.post(`${API_BASE_URL}/leads/mailcampaign/open-event`, payload);
  return response.data;
}

export async function sendQuotationPdf(id: string, pdfData: string, recipientEmail: string) {
  const response = await axios.post(`${API_BASE_URL}/leads/${id}/send-pdf`, {
    pdfData,
    recipientEmail,
  });
  return response.data;
}
