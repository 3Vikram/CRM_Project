// In-memory login throttle: 5 failed attempts per key (email+IP) per 15 minutes.
// Single-process only, which matches how this backend is deployed today.
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const attempts = new Map<string, number[]>()

export function isRateLimited(key: string): boolean {
  const now = Date.now()
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  attempts.set(key, recent)
  return recent.length >= MAX_ATTEMPTS
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now()
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  attempts.set(key, recent)
}

export function clearAttempts(key: string): void {
  attempts.delete(key)
}
