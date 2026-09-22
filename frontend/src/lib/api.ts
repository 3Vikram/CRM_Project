import type { ComputedInvoice, Entity, InvoiceDraft } from '@crm/shared'
import { AUTH_TOKEN_KEY } from './auth'

const API_BASE = '/api'

/**
 * fetch() wrapper for every Accounts-module API call: attaches the bearer
 * token and, on a 401, clears it and sends the browser to /login.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  })
  if (res.status === 401) {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    if (!location.pathname.startsWith('/login')) location.href = '/login'
  }
  return res
}

export async function fetchEntities(): Promise<Entity[]> {
  const res = await apiFetch('/entities')
  if (!res.ok) throw new Error(`Failed to load entities (${res.status})`)
  return (await res.json()) as Entity[]
}

export async function computeInvoice(draft: InvoiceDraft): Promise<ComputedInvoice> {
  const res = await apiFetch('/invoices/compute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (res.status === 400) {
    const body = await res.json().catch(() => ({ issues: [] }))
    throw new ComputationError('Invalid invoice draft', body.issues ?? [])
  }
  if (!res.ok) {
    throw new ComputationError(`Compute failed (${res.status})`, [])
  }
  return (await res.json()) as ComputedInvoice
}

export class ComputationError extends Error {
  issues: unknown[]
  constructor(message: string, issues: unknown[]) {
    super(message)
    this.issues = issues
  }
}