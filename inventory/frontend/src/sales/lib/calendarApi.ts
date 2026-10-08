import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

export interface CalendarApiEvent {
  id: string
  title: string
  module: string
  date: string
  time: string
  customerName?: string
  contactName?: string
  assignedTo?: string
  priority?: 'Low' | 'Medium' | 'High'
  status?: string
  description?: string
  referenceId?: string
  referenceModule?: string
  sourceField?: string
  eventType?: string
  color?: string
}

export const fetchCalendarEvents = async (): Promise<CalendarApiEvent[]> => {
  const { data } = await axios.get(`${API_BASE_URL}/calendar/events`)
  return Array.isArray(data?.data) ? data.data : []
}

export const completeCalendarEvent = async (module: string, id: string) => {
  const { data } = await axios.patch(`${API_BASE_URL}/calendar/events/${encodeURIComponent(module)}/${encodeURIComponent(id)}/complete`)
  return data
}

export const deleteCalendarEvent = async (module: string, id: string, sourceField: string) => {
  const { data } = await axios.delete(`${API_BASE_URL}/calendar/events/${encodeURIComponent(module)}/${encodeURIComponent(id)}`, { data: { sourceField } })
  return data
}
