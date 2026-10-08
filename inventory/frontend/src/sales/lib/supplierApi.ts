import axios from 'axios';
import { getCachedResponse } from './apiCache';

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
      const response = await axios({ method, url: `${baseUrl}${url}`, ...config });
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export interface SupplierRecord {
  _id: string;
  supplierId?: string;
  createdBy?: string;
  supplierName: string;
  gstNumber?: string;
  category?: string;
  paymentTerms?: string;
  addressLine1?: string;
  country?: string;
  state?: string;
  city?: string;
  pinCode?: string;
  bankName?: string;
  bankAddress?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifscCode?: string;
  loginEmailId?: string;
  loginPassword?: string;
  contactType?: string;
  contactName?: string;
  designation?: string;
  emailId?: string;
  contactNumber?: string;
  product?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierPayload {
  createdBy?: string;
  supplierName: string;
  gstNumber?: string;
  category: string;
  paymentTerms: string;
  addressLine1: string;
  country: string;
  state: string;
  city?: string;
  pinCode?: string;
  bankName?: string;
  bankAddress?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifscCode?: string;
  loginEmailId?: string;
  loginPassword?: string;
  contactType?: string;
  contactName?: string;
  designation?: string;
  emailId?: string;
  contactNumber?: string;
  product?: string;
}

export async function fetchSuppliers(params: { search?: string; product?: string; page?: number; limit?: number; createdBy?: string } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.product) query.set('product', params.product);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.createdBy) query.set('createdBy', params.createdBy);

  const cacheKey = `suppliers:${query.toString()}`;
  return getCachedResponse(cacheKey, async () => {
    const response = await requestWithFallback('get', '/suppliers', {
      params: {
        search: params.search || '',
        product: params.product || '',
        page: params.page ?? '',
        limit: params.limit ?? '',
        createdBy: params.createdBy || '',
      },
    });
    return response.data ?? { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
  }, 30_000);
}

export async function fetchSupplierById(id: string) {
  const response = await requestWithFallback('get', `/suppliers/${id}`);
  return response.data?.data ?? null;
}

export async function createSupplier(payload: SupplierPayload) {
  const response = await requestWithFallback('post', '/suppliers', { data: payload });
  return response.data;
}

export async function updateSupplier(id: string, payload: SupplierPayload) {
  const response = await requestWithFallback('put', `/suppliers/${id}`, { data: payload });
  return response.data;
}

export async function deleteSupplier(id: string) {
  const response = await requestWithFallback('delete', `/suppliers/${id}`);
  return response.data;
}

export async function fetchCountriesForSuppliers() {
  const response = await requestWithFallback('get', '/locations/countries');
  return response.data?.data ?? [];
}

export async function fetchStatesForSuppliers(country: string) {
  const response = await requestWithFallback('get', `/locations/states/${encodeURIComponent(country)}`);
  return response.data?.data ?? [];
}

export const demoProducts = ['Software', 'Hardware', 'Services', 'Accessories', 'Spare Parts'];

export async function fetchProductsForSuppliers() {
  return demoProducts;
}
