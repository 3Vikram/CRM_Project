import { getAuthHeaders } from './apiAuth'

export type NotificationItem = {
  id: string
  category: string
  module: string
  title: string
  description: string
  createdAt: string
  link: string
  mine: boolean
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    const response = await fetch('/api/notifications', { headers: getAuthHeaders() })
    if (!response.ok) return []
    const result = await response.json() as { success?: boolean; data?: NotificationItem[] }
    return Array.isArray(result.data) ? result.data : []
  } catch {
    return []
  }
}
