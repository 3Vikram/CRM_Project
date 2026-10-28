import axios from 'axios'
import { getAuthHeaders } from './apiAuth'

const API_BASE = '/api/customer-mapping'

export interface MappingEmployee {
  id: string
  name: string
  email?: string
  employeeType?: string
}

export interface MappingCustomer {
  _id: string
  customerId?: string
  companyName?: string
  customerName?: string
  accountType?: string
  status?: string
  createdBy?: string
  assignedEmployees?: Array<{ employeeId: string; employeeName: string }>
}

export interface MappingCustomersResponse {
  success: boolean
  data: MappingCustomer[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const getErrorMessage = (error: unknown, fallback: string) => (
  axios.isAxiosError(error) && error.response?.data?.message
    ? String(error.response.data.message)
    : fallback
)

export async function fetchMappingCustomers(params: {
  search?: string
  assignment?: string
  employeeId?: string
  page?: number
  limit?: number
}): Promise<MappingCustomersResponse> {
  try {
    const response = await axios.get<MappingCustomersResponse>(`${API_BASE}/customers`, {
      params,
      headers: getAuthHeaders(),
    })
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load customer mapping.'))
  }
}

export async function fetchMappingEmployees(): Promise<{ success: boolean; data: MappingEmployee[] }> {
  try {
    const response = await axios.get(`${API_BASE}/employees`, { headers: getAuthHeaders() })
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load employees.'))
  }
}

export async function assignCustomers(customerIds: string[], employeeIds: string[]) {
  try {
    const response = await axios.put(`${API_BASE}/assign`, { customerIds, employeeIds }, { headers: getAuthHeaders() })
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to save customer assignment.'))
  }
}
