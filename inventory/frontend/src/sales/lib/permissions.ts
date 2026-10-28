import { getStoredAuth, type EmployeePermissions, type PermissionBlock } from './auth'

export type PermissionModule = string
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

export const canManageCustomerMapping = () => {
  const user = getStoredAuth()?.user
  if (!user) return false
  if (user.role === 'admin') return true
  return ['admin', 'manager'].includes(String(user.employeeType || '').trim().toLowerCase())
}

export const hasPermission = (
  moduleName: PermissionModule,
  action: PermissionAction = 'view',
  permissions?: EmployeePermissions,
) => {
  const session = getStoredAuth()
  if (session?.user.role === 'admin') return true
  if (moduleName === 'customerMapping') return canManageCustomerMapping()
  const source = permissions || session?.user.permissions
  if (!source) return false
  if (moduleName === 'dashboard') return action === 'view' && source.dashboard === true
  const block = source[moduleName] as PermissionBlock | undefined
  return Boolean(block && typeof block === 'object' && block[action] === true)
}

export const getSessionPermissions = () => getStoredAuth()?.user.permissions