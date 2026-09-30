import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export interface OPFRecord {
  _id: string;
  opfNo?: string;
  createdBy?: string;
  quotationNumber?: string;
  quotationId?: string;
  customerId?: string;
  customerName?: string;
  contactPerson?: string;
  revenue?: number | string;
  margin?: number | string;
  
  // Supplier/Product Details
  supplierName?: string;
  supplierContactPerson?: string;
  product?: string;
  description?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  vendorPrice?: number | string;
  tax?: string;
  partNo?: string;
  startDate?: string;
  endDate?: string;
  
  // Service/Purchase/End User Details
  serviceName?: string;
  serviceCost?: number | string;
  serviceTax?: number | string;
  freightName?: string;
  freightCost?: number | string;
  freightTax?: number | string;
  wht?: number | string;
  conversionRate?: number | string;
  vendorCurrency?: string;
  eta?: string;
  customerPONo?: string;
  customerPODate?: string;
  amc?: string;
  amcRenewalDate?: string;
  notes?: string;
  customerPaymentTerms?: string;
  supplierPaymentTerms?: string;
  enduserName?: string;
  enduserEmail?: string;
  enduserContact?: string;
  enduserAddress?: string;
  billToAddress?: string;
  shipToAddress?: string;
  
  // Metadata
  createdDate?: string;
  renewalDate?: string;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Under Review';
  poFile?: {
    fileName?: string;
    filePath?: string;
    mimeType?: string;
  } | null;
  customerPOFile?: {
    fileName?: string;
    filePath?: string;
    mimeType?: string;
  } | null;
  additionalDocument?: {
    fileName?: string;
    filePath?: string;
    mimeType?: string;
  } | null;
  uploadedDocuments?: Array<{
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    uploadDate?: string;
  }>;
}

export interface OPFListResponse {
  success: boolean;
  data: OPFRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function fetchOPFs(params: {
  page?: number;
  limit?: number;
  search?: string;
  createdBy?: string;
  createdDate?: string;
  renewalDate?: string;
  customerName?: string;
  approvalStatus?: string;
  product?: string;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  if (params.createdBy && params.createdBy !== 'all') searchParams.set('createdBy', params.createdBy);
  if (params.createdDate && params.createdDate !== 'all') searchParams.set('createdDate', params.createdDate);
  if (params.renewalDate && params.renewalDate !== 'all') searchParams.set('renewalDate', params.renewalDate);
  if (params.customerName && params.customerName !== 'all') searchParams.set('customerName', params.customerName);
  if (params.approvalStatus && params.approvalStatus !== 'all') searchParams.set('approvalStatus', params.approvalStatus);
  if (params.product && params.product !== 'all') searchParams.set('product', params.product);

  const response = await axios.get(`${API_BASE_URL}/opf?${searchParams.toString()}`);
  return response.data as OPFListResponse;
}

export async function fetchOPFById(id: string) {
  const response = await axios.get(`${API_BASE_URL}/opf/${id}`);
  return response.data?.data ?? null;
}

export async function createOPF(payload: FormData) {
  const response = await axios.post(`${API_BASE_URL}/opf`, payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateOPF(id: string, payload: FormData) {
  const response = await axios.put(`${API_BASE_URL}/opf/${id}`, payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteOPF(id: string) {
  const response = await axios.delete(`${API_BASE_URL}/opf/${id}`);
  return response.data;
}

export async function sendOPFPdf(id: string, pdfData: string, recipientEmail: string) {
  const response = await axios.post(`${API_BASE_URL}/opf/${id}/send-pdf`, {
    pdfData,
    recipientEmail,
  });
  return response.data;
}
