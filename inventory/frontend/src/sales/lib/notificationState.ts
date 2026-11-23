import { getStoredAuth } from './auth'

type NotificationState = {
  read: string[]
  cleared: string[]
}

const emptyState = (): NotificationState => ({ read: [], cleared: [] })
const storageKey = (): string | null => {
  const userId = getStoredAuth()?.user?.id
  return userId ? `sales-notifications:${userId}` : null
}

export function getNotificationState(): NotificationState {
  try {
    const key = storageKey()
    if (!key || typeof window === 'undefined') return emptyState()
    const stored = window.localStorage.getItem(key)
    if (!stored) return emptyState()
    const parsed = JSON.parse(stored) as Partial<NotificationState>
    return {
      read: Array.isArray(parsed.read) ? parsed.read.filter((id): id is string => typeof id === 'string').slice(-500) : [],
      cleared: Array.isArray(parsed.cleared) ? parsed.cleared.filter((id): id is string => typeof id === 'string').slice(-500) : [],
    }
  } catch {
    return emptyState()
  }
}

function updateNotificationState(update: (state: NotificationState) => NotificationState): NotificationState {
  const next = update(getNotificationState())
  try {
    const key = storageKey()
    if (key && typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify({
        read: next.read.slice(-500),
        cleared: next.cleared.slice(-500),
      }))
    }
  } catch {
    return next
  }
  return next
}

export function markRead(ids: string[]): NotificationState {
  return updateNotificationState((state) => ({
    ...state,
    read: [...new Set([...state.read, ...ids])].slice(-500),
  }))
}

export function clearNotifications(ids: string[]): NotificationState {
  return updateNotificationState((state) => ({
    ...state,
    cleared: [...new Set([...state.cleared, ...ids])].slice(-500),
  }))
}
