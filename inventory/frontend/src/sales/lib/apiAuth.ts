import { getStoredAuth } from './auth'

export const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredAuth()?.token
  return token ? { Authorization: `Bearer ${token}` } : {}
}