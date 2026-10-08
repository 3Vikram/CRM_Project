import type { ReactNode } from 'react'
import { hasPermission, type PermissionAction } from '@/lib/permissions'

export function PermissionGate({ moduleName, action = 'view', children }: { moduleName: string; action?: PermissionAction; children: ReactNode }) {
  return hasPermission(moduleName, action) ? <>{children}</> : null
}