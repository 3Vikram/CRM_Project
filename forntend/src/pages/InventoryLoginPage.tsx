import { FormEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  INVENTORY_SESSION_KEY,
  signInToInventory,
  verifyInventorySession,
} from '@/lib/inventoryAuth'

interface LoginLocationState {
  from?: string
}

export default function InventoryLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const requestedPath = (location.state as LoginLocationState | null)?.from
  const destination =
    requestedPath?.startsWith('/inventory/') && requestedPath !== '/inventory/login'
      ? requestedPath
      : '/inventory'

  useEffect(() => {
    const token = localStorage.getItem(INVENTORY_SESSION_KEY)
    if (!token) return

    let cancelled = false
    verifyInventorySession(token)
      .then((isValid) => {
        if (cancelled) return
        if (isValid) navigate(destination, { replace: true })
        else localStorage.removeItem(INVENTORY_SESSION_KEY)
      })
      .catch(() => {
        if (!cancelled) localStorage.removeItem(INVENTORY_SESSION_KEY)
      })

    return () => {
      cancelled = true
    }
  }, [destination, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const token = await signInToInventory(email, password)
      localStorage.setItem(INVENTORY_SESSION_KEY, token)
      navigate(destination, { replace: true })
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : 'Unable to sign in. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6F8] flex items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[#DDE4EA] bg-white p-8 shadow-[0_18px_48px_rgba(6,40,61,0.10)] sm:p-10">
        <header className="mb-8 text-center">
          <img
            alt="Synov IT Services"
            className="mx-auto mb-4 h-14 w-14 object-contain"
            src="/synov-logo.png"
          />
          <div className="mb-5 text-xs font-semibold tracking-[0.2em] text-[#5F6B76]">
            SYNOV IT SERVICES
          </div>
          <h1 className="text-2xl font-semibold text-[#06283D]">Inventory sign in</h1>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-[#06283D]" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="username"
              className="w-full rounded-xl border border-[#D7DEE8] bg-white px-4 py-3 text-sm text-[#06283D] outline-none transition focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#06283D]" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#D7DEE8] bg-white px-4 py-3 text-sm text-[#06283D] outline-none transition focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            className="w-full rounded-xl bg-[#06283D] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0B3A53] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
