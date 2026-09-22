import { createContext, useContext } from 'react'

export const AUTH_TOKEN_KEY = 'crm-auth-token'

export type AuthUser = { id: string; email: string; name: string; role: string }

export type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
