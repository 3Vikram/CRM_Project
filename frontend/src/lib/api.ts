import type { ComputedInvoice, Entity, InvoiceDraft } from '@crm/shared'

const API_BASE = '/api'

export async function fetchEntities(): Promise<Entity[]> {
  const res = await fetch(`${API_BASE}/entities`)
  if (!res.ok) throw new Error(`Failed to load entities (${res.status})`)
  return (await res.json()) as Entity[]
}

export async function computeInvoice(draft: InvoiceDraft): Promise<ComputedInvoice> {
  const res = await fetch(`${API_BASE}/invoices/compute`, {
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