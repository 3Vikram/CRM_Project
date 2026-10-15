const API_URL = import.meta.env.VITE_API_URL || ''
export const INVENTORY_SESSION_KEY = 'inventory-session-token'
const INVENTORY_API_PREFIXES = [
  '/api/inventory',
  '/api/assets',
  '/api/products',
  '/api/delivery-challans',
  '/api/returned-challans',
  '/api/daily-email',
  '/api/accessories',
]
let inventoryApiAuthorizationInstalled = false

export interface InventoryUser {
  id?: string
  name?: string
  email?: string
  role: 'admin' | 'employee'
}

export function getInventorySessionToken(): string | null {
  if (typeof window === 'undefined') return null

  // Remove tokens persisted by earlier versions; Inventory sessions are tab-scoped.
  window.localStorage.removeItem(INVENTORY_SESSION_KEY)
  return window.sessionStorage.getItem(INVENTORY_SESSION_KEY)
}

export function setInventorySessionToken(token: string): void {
  window.localStorage.removeItem(INVENTORY_SESSION_KEY)
  window.sessionStorage.setItem(INVENTORY_SESSION_KEY, token)
}

export function clearInventorySession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(INVENTORY_SESSION_KEY)
  window.sessionStorage.removeItem(INVENTORY_SESSION_KEY)
}

export function installInventoryApiAuthorization(): void {
  if (typeof window === 'undefined' || inventoryApiAuthorizationInstalled) return

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const requestUrl = input instanceof Request ? input.url : String(input)
    let pathname: string
    try {
      pathname = new URL(requestUrl, window.location.href).pathname
    } catch {
      return originalFetch(input, init)
    }

    const isInventoryApi = INVENTORY_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
    if (!isInventoryApi) return originalFetch(input, init)

    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    const token = getInventorySessionToken()
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return originalFetch(input, { ...init, headers })
  }
  inventoryApiAuthorizationInstalled = true
}

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

export async function getInventorySession(token: string): Promise<InventoryUser | null> {
  const response = await fetch(`${API_URL}/api/inventory/auth/session`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 401) return null
  if (!response.ok) throw new Error('Unable to verify Inventory session.')

  const data: {
    authenticated?: boolean
    role?: InventoryUser['role']
    user?: InventoryUser
  } = await response.json()
  if (!data.authenticated) return null

  const role = data.user?.role ?? data.role
  if (role !== 'admin' && role !== 'employee') {
    throw new Error('Unable to verify Inventory session.')
  }

  return {
    ...data.user,
    role,
    ...(data.user?.id || role !== 'admin' ? {} : { id: 'admin' }),
  }
}

export async function verifyInventorySession(token: string): Promise<boolean> {
  return Boolean(await getInventorySession(token))
}
