import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
