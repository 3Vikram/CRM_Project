import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/mail-campaigns` : 'http://localhost:5001/api/mail-campaigns',
})

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const response = error.response?.data
    if (response?.message) {
      const context = [response.errorCode || response.code, response.field].filter(Boolean).join(' / ')
      const validation = response.errors && typeof response.errors === 'object'
        ? Object.values(response.errors).map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && 'message' in item) return String(item.message)
          return ''
        }).filter(Boolean).join('; ')
        : ''
      return [response.message, context, validation, response.details].filter(Boolean).join(' - ')
    }
    if (error.response?.status === 400) return 'The campaign data is invalid. Please check the required fields.'
    if (error.response?.status === 404) return 'The campaign or required resource was not found.'
    if (error.response?.status === 409) return 'The campaign could not be saved because it conflicts with an existing record.'
    if (error.response?.status === 502) return 'The campaign was saved, but email delivery failed. Check the delivery report.'
    return fallback
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return fallback
}

export interface MailCampaignGroup {
  _id?: string
  groupName: string
  contactIds: string[]
  subject: string
  message: string
  status: string
  recipientEmails: string[]
  sentDate?: string
  deliveryResults?: Array<{ recipientEmail: string; status: string; errorMessage?: string }>
}

export interface MailCampaignRecord {
  _id: string
  campaignId: string
  campaignName: string
  subject: string
  campaignType: string
  priority: string
  imageAlignment: string
  tags: string[]
  recipientModules: string[]
  recipientGroup: string[]
  recipientEmails: string[]
  recipientCount: number
  campaignBody: string
  footer: string
  image: string
  attachments: string[]
  status: string
  opens: number
  uniqueOpens: number
  clicks: number
  createdBy: string
  createdDate: string
  scheduledDate: string
  scheduledTime: string
  timezone: string
  sentDate: string
  testEmail: string
  campaignGroups?: MailCampaignGroup[]
  createdAt?: string
  updatedAt?: string
}

export interface MailCampaignListResponse {
  success: boolean
  data: MailCampaignRecord[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface MailCampaignReportRow {
  serialNumber: number
  campaignId: string
  campaignName: string
  sentBy: string
  sentTo: string
  subject: string
  opens: number
  clicks: number
}

export const getCampaigns = async (params?: Record<string, string | number>) => {
  const { data } = await api.get('/', { params })
  return data as MailCampaignListResponse
}

export const getCampaignById = async (id: string) => {
  const { data } = await api.get(`/${id}`)
  return data.data as MailCampaignRecord
}

export interface MailCampaignPreview {
  from: string
  to: string
  subject: string
  html: string
}

export const getCampaignPreview = async (id: string) => {
  const { data } = await api.get(`/${id}/preview`)
  return data as { success: boolean; data: MailCampaignPreview }
}

export const getCampaignReport = async (id: string) => {
  const { data } = await api.get(`/${id}/report`)
  return data as { success: boolean; data: MailCampaignReportRow[] }
}

export const createCampaign = async (formData: FormData) => {
  try {
    const { data } = await api.post('/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create campaign.'))
  }
}

export const updateCampaign = async (id: string, formData: FormData) => {
  try {
    const { data } = await api.put(`/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update campaign.'))
  }
}

export const deleteCampaign = async (id: string) => {
  try {
    const { data } = await api.delete(`/${id}`)
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to delete campaign.'))
  }
}

export const fetchRecipientCounts = async () => {
  const { data } = await api.get('/recipient-counts')
  return data
}

export const fetchRecipientData = async (modules?: string[]) => {
  const { data } = await api.get('/recipient-data', {
    params: { modules: modules?.join(',') || '' },
  })
  return data
}

export const sendCampaign = async (id: string, recipients?: string[]) => {
  try {
    const { data } = await api.post(`/${id}/send`, { recipients: recipients || [] })
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to send campaign.'))
  }
}

export const sendCampaignGroup = async (campaignId: string, groupId: string, recipients?: string[]) => {
  try {
    const { data } = await api.post(`/${campaignId}/send`, { groupId, recipients: recipients || [] })
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to send campaign group.'))
  }
}
