type Entry = { failures: number; windowStart: number; lockedUntil?: number }

// Attach to `global` so the Map survives Next.js hot-module reloads in dev,
// which otherwise re-evaluate this module and reset a plain `new Map()`.
const g = global as typeof global & { __rlStore?: Map<string, Entry> }
if (!g.__rlStore) g.__rlStore = new Map()
const store = g.__rlStore

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000  // 15 min sliding window
const LOCKOUT_MS = 15 * 60 * 1000 // 15 min lockout after limit hit

/** Returns remaining lockout seconds if the key is rate-limited, or 0 if allowed. */
export function getRateLimitBlock(key: string): number {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry) return 0

  if (entry.lockedUntil) {
    if (now < entry.lockedUntil) return Math.ceil((entry.lockedUntil - now) / 1000)
    store.delete(key)
    return 0
  }

  if (now - entry.windowStart > WINDOW_MS) {
    store.delete(key)
    return 0
  }

  return 0
}

/** Call after a failed login attempt.
 *  Returns `{ lockedFor }` (seconds) when the limit is hit, or `{ remaining }` attempts left. */
export function recordLoginFailure(key: string): { lockedFor: number; remaining?: never } | { remaining: number; lockedFor?: never } {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    store.set(key, { failures: 1, windowStart: now })
    return { remaining: MAX_FAILURES - 1 }
  }

  existing.failures += 1

  if (existing.failures >= MAX_FAILURES) {
    existing.lockedUntil = now + LOCKOUT_MS
    return { lockedFor: Math.ceil(LOCKOUT_MS / 1000) }
  }

  return { remaining: MAX_FAILURES - existing.failures }
}

/** Call on successful login to clear the failure record. */
export function clearLoginFailures(key: string): void {
  store.delete(key)
}

/** Periodically purge expired entries so the Map doesn't grow unbounded. */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      const expired = entry.lockedUntil
        ? now > entry.lockedUntil
        : now - entry.windowStart > WINDOW_MS
      if (expired) store.delete(key)
    }
  }, 5 * 60 * 1000)
}
