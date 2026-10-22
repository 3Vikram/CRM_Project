import { getCachedResponse } from './apiCache';
import { getAuthHeaders } from './apiAuth';

const API_BASE_URL = '/api';

async function readApiError(response: Response): Promise<string> {
  const text = await response.clone().text();
  if (!text) {
    return response.statusText || 'Request failed';
  }

  if (text.trim().startsWith('<')) {
    return `The API responded with HTML instead of JSON. Check that the backend is running at ${API_BASE_URL} and that the request URL is correct.`;
  }

  try {
    const payload = JSON.parse(text) as { message?: string; error?: string };
    return payload.message || payload.error || response.statusText || 'Request failed';
  } catch {
    return text.slice(0, 200).trim() || response.statusText || 'Request failed';
  }
}

export interface CompanyProfileRecord {
  _id: string;
  directorName: string;
  directorDesignation: string;
  companyName: string;
  branchName?: string;
  branchCode?: string;
  registeredAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  pin?: string;
  country?: string;
  companyContactNo?: string;
  website?: string;
  email?: string;
  companyLogo?: { fileName?: string; filePath?: string; mimeType?: string };
  documentLogo?: { fileName?: string; filePath?: string; mimeType?: string };
  documentHeader?: { fileName?: string; filePath?: string; mimeType?: string };
  documentFooter?: { fileName?: string; filePath?: string; mimeType?: string };
  documentHeaderRequired?: boolean;
  documentFooterRequired?: boolean;
  gstNo?: string;
  panNo?: string;
  bankName?: string;
  accountHolderName?: string;
  accountNo?: string;
  ifscCode?: string;
  swiftCode?: string;
  cin?: string;
  iec?: string;
  quotationFormat?: string;
  idNoFormat?: string;
  opfFormat?: string;
  poFormat?: string;
  piFormat?: string;
  invoiceFormat?: string;
  prFormat?: string;
  enquiryFormat?: string;
  challanFormat?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyProfilePayload {
  directorName: string;
  directorDesignation: string;
  companyName: string;
  branchName?: string;
  branchCode?: string;
  registeredAddress?: string;
  address?: string;
  city: string;
  state: string;
  pin: string;
  country: string;
  companyContactNo?: string;
  website: string;
  email: string;
  documentHeaderRequired?: boolean;
  documentFooterRequired?: boolean;
  gstNo: string;
  panNo: string;
  bankName: string;
  accountHolderName: string;
  accountNo: string;
  ifscCode: string;
  swiftCode: string;
  cin: string;
  iec: string;
  quotationFormat: string;
  idNoFormat: string;
  opfFormat: string;
  poFormat: string;
  piFormat: string;
  invoiceFormat: string;
  prFormat: string;
  enquiryFormat: string;
  challanFormat: string;
}

export interface CompanyProfileListResponse {
  success: boolean;
  data: CompanyProfileRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function fetchCompanyProfiles(params: { search?: string; page?: number; limit?: number } = {}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const cacheKey = `company-profiles:${searchParams.toString()}`;
  return getCachedResponse<CompanyProfileListResponse>(cacheKey, async () => {
    const response = await fetch(`${API_BASE_URL}/company-profiles?${searchParams.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) {
      throw new Error(await readApiError(response));
    }
    return response.json() as Promise<CompanyProfileListResponse>;
  }, 30_000);
}

export async function fetchCompanyProfileById(id: string) {
  const response = await fetch(`${API_BASE_URL}/company-profiles/${id}`, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}

export async function createCompanyProfile(payload: CompanyProfilePayload, files: Record<string, File | null> = {}) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, String(value));
  });

  Object.entries(files).forEach(([field, file]) => {
    if (file) {
      formData.append(field, file);
    }
  });

  const response = await fetch(`${API_BASE_URL}/company-profiles`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}

export async function updateCompanyProfile(id: string, payload: Partial<CompanyProfilePayload>, files: Record<string, File | null> = {}) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, String(value));
  });

  Object.entries(files).forEach(([field, file]) => {
    if (file) {
      formData.append(field, file);
    }
  });

  const response = await fetch(`${API_BASE_URL}/company-profiles/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}

export async function deleteCompanyProfile(id: string) {
  const response = await fetch(`${API_BASE_URL}/company-profiles/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}
