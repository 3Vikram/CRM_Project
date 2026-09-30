import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export interface ActivityRecord {
  _id: string;
  activityId?: string;
  leadId: string;
  leadSource: string;
  customerName: string;
  contactPerson: string;
  designation: string;
  email: string;
  mobileNo: string;
  sourceOfLead: string;
  customerRequirements: string;
  customerRemarks: string;
  assignedUser: string;
  leadIdLabel: string;
  company: string;
  priority: string;
  campaign: string;
  activityType: string;
  activityDate: string;
  location: string;
  response: string;
  followUp: string;
  product: string;
  tagResource: string;
  followUpDate: string;
  reminder: string;
  status: string;
  createdBy: string;
  lastModifiedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityListResponse {
  success: boolean;
  data: ActivityRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function fetchActivities(params: {
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
  createdBy?: string;
  customerName?: string;
  activityDatePreset?: string;
  followUpPreset?: string;
  response?: string;
  activityId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}) {
  const response = await axios.get(`${API_BASE_URL}/activities`, { params });
  return response.data as ActivityListResponse;
}

export async function createActivity(payload: Partial<ActivityRecord>) {
  const response = await axios.post(`${API_BASE_URL}/activities`, payload);
  return response.data;
}

export async function updateActivity(id: string, payload: Partial<ActivityRecord>) {
  const response = await axios.put(`${API_BASE_URL}/activities/${id}`, payload);
  return response.data;
}

export async function deleteActivity(id: string) {
  const response = await axios.delete(`${API_BASE_URL}/activities/${id}`);
  return response.data;
}

export async function fetchActivityById(id: string) {
  const response = await axios.get(`${API_BASE_URL}/activities/${id}`);
  return response.data;
}
