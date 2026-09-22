'use client'

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

const input = 'w-full rounded border border-gray-300 px-3 py-2 text-sm'
const button = 'w-full rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate(location.state?.from ?? '/accounts', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-[#EFECE5] bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900">Accounts sign in</h1>
          <p className="mt-1 text-sm text-gray-600">Sign in to access the accounting books.</p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
          <input className={input} type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
          <input className={input} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className={button} type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}
