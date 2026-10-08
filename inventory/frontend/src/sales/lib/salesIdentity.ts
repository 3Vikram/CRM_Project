import { getStoredAuth } from './auth'

export interface SalesEmployeeIdentity {
  employeeId: string
  employeeName: string
}

export function getSalesEmployeeIdentity(): SalesEmployeeIdentity {
  const user = getStoredAuth()?.user
  return {
    employeeId: user?.id || '',
    employeeName: user?.role === 'admin' ? 'Admin' : user?.name || '',
  }
}