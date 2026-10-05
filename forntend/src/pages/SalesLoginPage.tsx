'use client'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import synovLogo from '../assets.png'
import { setStoredAuth } from '@/lib/auth'

const SALES_AUTH_KEY = 'sales_logged_in'
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
const firstAccessiblePath = (permissions?: Record<string, unknown>) => {
  if (permissions?.dashboard === true) return '/sales/dashboard'

  const modulePaths: Array<[string, string]> = [
    ['contacts', '/sales/contacts'],
    ['quotations', '/sales/quotations'],
    ['mailCampaign', '/sales/mail-campaign'],
    ['leads', '/sales/leads'],
    ['activities', '/sales/activities'],
    ['calendar', '/sales/calendar'],
    ['customers', '/sales/customers'],
    ['suppliers', '/sales/suppliers'],
    ['funnels', '/sales/funnels'],
    ['opf', '/sales/opf'],
    ['renewals', '/sales/renewals'],
    ['reports', '/reports'],
    ['dataAdmin', '/sales/data-admin'],
    ['employees', '/sales/employees'],
    ['companyProfiles', '/sales/company-profiles'],
    ['inventory', '/sales/inventory'],
    ['purchaseOrders', '/sales/purchase-orders'],
    ['dcTracking', '/sales/dc-tracking'],
    ['billSale', '/sales/bill-sale'],
  ]

  return modulePaths.find(([moduleName]) => {
    const permission = permissions?.[moduleName]
    return Boolean(permission && typeof permission === 'object' && (permission as { view?: boolean }).view)
  })?.[1] || '/sales/dashboard'
}

export default function SalesLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    try {
      setIsSubmitting(true)
      const credentials = { email: email.trim(), password }
      let response

      try {
        response = await axios.post(`${API_BASE_URL}/auth/admin-login`, credentials)
      } catch (adminError) {
        if (!axios.isAxiosError(adminError) || adminError.response?.status !== 401) {
          throw adminError
        }
        response = await axios.post(`${API_BASE_URL}/auth/employee-login`, credentials)
      }

      if (!response.data?.success || !response.data.token) {
        setError(response.data?.message || 'Invalid email or password')
        return
      }
      setStoredAuth({ token: response.data.token, user: response.data.user }, true)
      localStorage.setItem(SALES_AUTH_KEY, 'true')
      navigate(firstAccessiblePath(response.data.user?.permissions), { replace: true })
    } catch (loginError) {
      if (axios.isAxiosError(loginError)) {
        setError(loginError.response?.data?.message || 'Unable to connect to the server.')
      } else {
        setError('Invalid email or password')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F7F3] px-4 py-10">
      <div className="w-full max-w-[420px] rounded-xl border border-[#E7E3DA] bg-white p-8 shadow-[0_20px_45px_rgba(31,29,26,0.08)]">
        <div className="mb-8 flex flex-col items-center">
          <img src={synovLogo} alt="Synov IT Services logo" className="h-16 w-auto object-contain" />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1F1D1A]">Sales sign in</h1>
          <p className="mt-2 text-sm text-[#6B6657]">Sign in to access the sales workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="sales-email" className="mb-2 block text-sm font-medium text-[#1F1D1A]">Email</label>
            <input
              id="sales-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-[#E7E3DA] bg-[#F8F7F3] px-3 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B8B0A0] focus:ring-2 focus:ring-[#E7E3DA]"
              placeholder="admin@synov.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="sales-password" className="mb-2 block text-sm font-medium text-[#1F1D1A]">Password</label>
            <input
              id="sales-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[#E7E3DA] bg-[#F8F7F3] px-3 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B8B0A0] focus:ring-2 focus:ring-[#E7E3DA]"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#1F1D1A] px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#2b2925] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
