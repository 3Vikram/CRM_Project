import axios from 'axios';
import { clearApiCache, getCachedResponse } from './apiCache';
import { getStoredAuth } from './auth';
import { getAuthHeaders } from './apiAuth';

const API_BASE_URLS = Array.from(
  new Set(
    [
      // 'http://localhost:5002/api',
      // 'http://127.0.0.1:5002/api',
      'http://localhost:5001/api',
      'http://127.0.0.1:5001/api',
      import.meta.env.VITE_API_URL,
    ].filter(Boolean) as string[]
  )
);

async function requestWithFallback(method: 'get' | 'post' | 'put' | 'delete', url: string, config?: Record<string, unknown>) {
  let lastError: unknown;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await axios({
        method,
        url: `${baseUrl}${url}`,
        ...config,
        headers: {
          ...getAuthHeaders(),
          ...((config?.headers as Record<string, string> | undefined) || {}),
        },
      });
      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
}

export interface ContactRecord {
  _id: string;
  customerId?: string;
  customerName?: string;
  contactName: string;
  designation: string;
  mail?: string;
  contactNumber: string;
  email: string;
  batchName?: string;
  batchNumber?: number;
  employeeId?: string;
  employeeName?: string;
  batchId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactPayload {
  customerId?: string;
  customerName?: string;
  contactName: string;
  designation: string;
  mail?: string;
  contactNumber: string;
  email: string;
}

export interface ContactBatchSummary {
  batchNumber: number
  name: string
  count: number
}

export interface EmployeeBatchSummary {
  _id?: string
  employeeId: string
  batchNumber: number
  name: string
  customerCount: number
  count: number
  fileName?: string
  createdDate?: string
}

export interface EmployeeBatchGroup {
  employeeId: string
  employeeEmail?: string
  employeeName: string
  customerCount: number
  batches: EmployeeBatchSummary[]
}

export async function fetchContacts(params: { search?: string; page?: number; limit?: number; batchName?: string; batchNumber?: number; batchId?: string; employeeId?: string } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.batchName) query.set('batchName', params.batchName);
  if (params.batchNumber) query.set('batchNumber', String(params.batchNumber));
  if (params.batchId) query.set('batchId', params.batchId);
  if (params.employeeId) query.set('employeeId', params.employeeId);

  const session = getStoredAuth();
  const cacheKey = `contacts:${session?.user.role || 'anonymous'}:${session?.user.id || ''}:${query.toString()}`;
  return getCachedResponse(cacheKey, async () => {
    const response = await requestWithFallback('get', '/contacts', {
      params: {
        search: params.search || '',
        page: params.page ?? '',
        limit: params.limit ?? '',
        batchName: params.batchName || '',
        batchNumber: params.batchNumber || '',
        batchId: params.batchId || '',
        employeeId: params.employeeId || '',
      },
    });
    return response.data ?? { data: [], batches: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
  }, 30_000);
}

export async function fetchContactById(id: string) {
  const response = await requestWithFallback('get', `/contacts/${id}`);
  return response.data?.data ?? null;
}

export async function createContact(payload: ContactPayload) {
  try {
    const response = await requestWithFallback('post', '/contacts', { data: payload });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

export async function updateContact(id: string, payload: ContactPayload) {
  try {
    const response = await requestWithFallback('put', `/contacts/${id}`, { data: payload });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

export async function deleteContact(id: string) {
  const response = await requestWithFallback('delete', `/contacts/${id}`);
  return response.data;
}

export async function moveContactToCustomer(id: string) {
  try {
    const response = await requestWithFallback('post', `/contacts/${id}/move-to-customer`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

export async function importContacts(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await requestWithFallback('post', '/contacts/import', { data: formData });
  clearApiCache();
  return response.data as { success: boolean; message: string; imported?: number; skipped?: number; batchName?: string; batchNumber?: number; employeeId?: string; employeeName?: string; fileName?: string };
}

export async function fetchEmployeeBatchGroups() {
  const response = await requestWithFallback('get', '/contacts/batch-groups');
  return (response.data?.data || []) as EmployeeBatchGroup[];
}

export async function fetchCustomersForContacts() {
  const response = await requestWithFallback('get', '/customers?limit=1000');
  return response.data?.data ?? [];
}
