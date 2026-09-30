import axios from 'axios';

const API_BASE_URLS = Array.from(
  new Set([
    'http://localhost:5001/api',
    'http://127.0.0.1:5001/api',
    import.meta.env.VITE_API_URL,
  ].filter(Boolean) as string[])
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

export interface EmployeePermissionBlock {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface EmployeePermissions {
  dashboard: boolean;
  customers: EmployeePermissionBlock;
  contacts: EmployeePermissionBlock;
  leads: EmployeePermissionBlock;
  activities: EmployeePermissionBlock;
  mailCampaign: EmployeePermissionBlock;
  suppliers: EmployeePermissionBlock;
  quotations: EmployeePermissionBlock;
  opf: EmployeePermissionBlock;
}

export interface EmployeeRecord {
  _id: string;
  employeeCode?: string;
  officialEmployeeId?: string;
  employeeName: string;
  fullName?: string;
  email: string;
  phone?: string;
  contactNo?: string;
  designation?: string;
  department?: string;
  role?: string;
  status?: 'Active' | 'Inactive' | 'On Leave';
  joiningDate?: string | null;
  dateOfJoin?: string | null;
  dateOfBirth?: string | null;
  employeeType?: string;
  reportingTo?: string;
  orderApprovalTo?: string;
  branchCode?: string;
  crudOption?: string[];
  modulesOption?: string[];
  address?: string;
  notes?: string;
  createdBy?: string;
  permissions?: EmployeePermissions;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeePayload {
  employeeCode?: string;
  officialEmployeeId?: string;
  employeeName?: string;
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  contactNo?: string;
  designation?: string;
  department?: string;
  role?: string;
  status?: 'Active' | 'Inactive' | 'On Leave';
  joiningDate?: string | null;
  dateOfJoin?: string | null;
  dateOfBirth?: string | null;
  employeeType?: string;
  reportingTo?: string;
  orderApprovalTo?: string;
  branchCode?: string;
  crudOption?: string[] | string;
  modulesOption?: string[] | string;
  address?: string;
  notes?: string;
  createdBy?: string;
  permissions?: EmployeePermissions;
}

export interface EmployeeListResponse {
  success: boolean;
  data: EmployeeRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function fetchEmployees(params: { search?: string; page?: number; limit?: number; role?: string; status?: string; department?: string } = {}) {
  const response = await requestWithFallback('get', '/employees', {
    params: {
      search: params.search || '',
      page: params.page ?? '',
      limit: params.limit ?? '',
      role: params.role || '',
      status: params.status || '',
      department: params.department || '',
    },
  });

  return response.data ?? { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
}

export async function fetchEmployeeById(id: string) {
  const response = await requestWithFallback('get', `/employees/${id}`);
  return response.data?.data ?? null;
}

export async function createEmployee(payload: EmployeePayload) {
  const response = await requestWithFallback('post', '/employees', { data: payload });
  return response.data;
}

export async function updateEmployee(id: string, payload: EmployeePayload) {
  const response = await requestWithFallback('put', `/employees/${id}`, { data: payload });
  return response.data;
}

export async function deleteEmployee(id: string) {
  const response = await requestWithFallback('delete', `/employees/${id}`);
  return response.data;
}

export const employeeRoles = ['Sales Head', 'Sales Manager', 'Sales Executive', 'Administrator', 'Support'];
export const employeeDepartments = ['Sales', 'Marketing', 'Operations', 'Support', 'Administration'];
export const employeeStatusOptions = ['Active', 'Inactive', 'On Leave'];

export const defaultEmployeePermissions = (): EmployeePermissions => ({
  dashboard: true,
  customers: { view: true, create: false, edit: false, delete: false },
  contacts: { view: true, create: false, edit: false, delete: false },
  leads: { view: true, create: false, edit: false, delete: false },
  activities: { view: true, create: false, edit: false, delete: false },
  mailCampaign: { view: true, create: false, edit: false, delete: false },
  suppliers: { view: true, create: false, edit: false, delete: false },
  quotations: { view: true, create: false, edit: false, delete: false },
  opf: { view: true, create: false, edit: false, delete: false },
});
