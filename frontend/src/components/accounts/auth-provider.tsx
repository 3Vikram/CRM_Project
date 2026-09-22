import { useCallback, useMemo, useState } from 'react'
import { AuthContext, AUTH_TOKEN_KEY, type AuthUser } from '@/lib/auth'

const USER_KEY = 'crm-auth-user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { const raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) as AuthUser : null } catch { return null }
  })

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error ?? `Login failed (${res.status})`)
    localStorage.setItem(AUTH_TOKEN_KEY, body.token)
    localStorage.setItem(USER_KEY, JSON.stringify(body.user))
    setToken(body.token)
    setUser(body.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ token, user, login, logout }), [token, user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
