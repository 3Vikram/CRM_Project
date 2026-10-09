const API_URL = import.meta.env.VITE_API_URL || ''
export const INVENTORY_SESSION_KEY = 'inventory-session-token'

export async function signInToInventory(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/inventory/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid email or password.')
    if (response.status === 503) {
      throw new Error('Inventory sign-in is not configured. Contact your administrator.')
    }
    throw new Error('Unable to sign in. Please try again.')
  }

  const data: { token?: string } = await response.json()
  if (!data.token) throw new Error('Unable to sign in. Please try again.')
  return data.token
}

export async function verifyInventorySession(token: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/inventory/auth/session`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  return response.ok
}
