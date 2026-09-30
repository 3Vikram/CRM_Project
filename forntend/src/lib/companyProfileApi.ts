import { getCachedResponse } from './apiCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

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
    const response = await fetch(`${API_BASE_URL}/company-profiles?${searchParams.toString()}`);
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load company profiles');
    }
    return response.json() as Promise<CompanyProfileListResponse>;
  }, 30_000);
}

export async function fetchCompanyProfileById(id: string) {
  const response = await fetch(`${API_BASE_URL}/company-profiles/${id}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Failed to load company profile');
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
    body: formData,
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Failed to create company profile');
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
    body: formData,
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Failed to update company profile');
  }
  return response.json();
}

export async function deleteCompanyProfile(id: string) {
  const response = await fetch(`${API_BASE_URL}/company-profiles/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Failed to delete company profile');
  }
  return response.json();
}
