import axios from 'axios';
import { getCachedResponse } from './apiCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export interface CustomerApiRecord {
  _id: string;
  customerId?: string;
  companyName?: string;
  customerName?: string;
  accountType?: string;
  contacts?: Array<{
    name?: string;
    email?: string;
    phone?: string;
    designation?: string;
  }>;
  email?: string;
  phone?: string;
  status?: 'Active' | 'Inactive';
  notes?: string;
  createdAt?: string;
  billToAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    area?: string;
    country?: string;
    pincode?: string;
  };
  state?: string;
  gstNumber?: string;
  createdBy?: string;
}

export interface CustomerListResponse {
  success: boolean;
  data: CustomerApiRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CustomerPayload {
  companyName: string;
  customerName: string;
  state?: string;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive';
  notes: string;
  createdBy: string;
  accountType: string;
  contacts: Array<{
    contactType: string;
    name: string;
    email: string;
    phone: string;
    designation: string;
  }>;
  billToAddress: {
    addressLine1: string;
    area: string;
    country: string;
    state: string;
    city: string;
    pincode: string;
  };
  shipToSameAsBilling: boolean;
  shipToAddress: {
    addressLine1: string;
    area: string;
    country: string;
    state: string;
    city: string;
    pincode: string;
  };
  documents?: Array<{
    fileName: string;
    filePath: string;
    documentType: string;
    mimeType?: string;
    size?: number;
  }>;
}

export async function fetchCustomers(params: { search?: string; page?: number; limit?: number; status?: string; createdBy?: string; accountType?: string; createdDate?: string; fresh?: boolean } = {}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params.createdBy && params.createdBy !== 'all') searchParams.set('createdBy', params.createdBy);
  if (params.accountType && params.accountType !== 'all') searchParams.set('accountType', params.accountType);
  if (params.createdDate && params.createdDate !== 'all') searchParams.set('createdDate', params.createdDate);

  const cacheKey = `customers:${searchParams.toString()}`;
  if (params.fresh) {
    const response = await fetch(`${API_BASE_URL}/customers?${searchParams.toString()}`);
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load customers');
    }
    return response.json() as Promise<CustomerListResponse>;
  }
  return getCachedResponse<CustomerListResponse>(cacheKey, async () => {
    const response = await fetch(`${API_BASE_URL}/customers?${searchParams.toString()}`);
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load customers');
    }
    return response.json() as Promise<CustomerListResponse>;
  }, 30_000);
}

export async function fetchCustomerById(id: string) {
  const response = await fetch(`${API_BASE_URL}/customers/${id}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Failed to load customer');
  }
  return response.json();
}

export async function createCustomer(payload: CustomerPayload, files: File[] = []) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      return;
    }
    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
      return;
    }
    formData.append(key, String(value));
  });

  files.forEach((file) => formData.append('documents', file));

  const response = await fetch(`${API_BASE_URL}/customers`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Failed to create customer');
  }
  return response.json();
}

export async function updateCustomer(id: string, payload: CustomerPayload, files: File[] = []) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      return;
    }
    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
      return;
    }
    formData.append(key, String(value));
  });

  files.forEach((file) => formData.append('documents', file));

  const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
    method: 'PUT',
    body: formData,
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Failed to update customer');
  }
  return response.json();
}

export async function deleteCustomer(id: string) {
  const response = await fetch(`${API_BASE_URL}/customers/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Failed to delete customer');
  }
  return response.json();
}

export async function fetchCountries() {
  const response = await axios.get(`${API_BASE_URL}/locations/countries`);
  return response.data?.data ?? [];
}

export async function fetchStates(country: string) {
  const response = await axios.get(`${API_BASE_URL}/locations/states/${encodeURIComponent(country)}`);
  return response.data?.data ?? [];
}

export async function fetchCities(state: string) {
  const response = await axios.get(`${API_BASE_URL}/locations/cities/${encodeURIComponent(state)}`);
  return response.data?.data ?? [];
}

export async function fetchAreas(city: string) {
  const response = await axios.get(`${API_BASE_URL}/locations/areas/${encodeURIComponent(city)}`);
  return response.data?.data ?? [];
}

export async function fetchPincodes(area: string) {
  const response = await axios.get(`${API_BASE_URL}/locations/pincodes/${encodeURIComponent(area)}`);
  return response.data?.data ?? [];
}
