/**
 * A few small, losable preferences: when the last backup was taken, whether the
 * reminder is snoozed, whether persistent storage has been asked for.
 *
 * These live in `localStorage` rather than in IndexedDB on purpose. None of
 * them is your writing — if they are lost, the app nudges you to export sooner
 * than it strictly had to, which is the harmless direction to fail in. Keeping
 * them out of the database also keeps them out of the backup file, where a
 * "last export" date restored from a file would only ever be misleading.
 *
 * Every access is guarded: `localStorage` throws in a private window with site
 * data blocked, and does not exist at all under the test runner's node
 * environment. When it is unavailable the values live in memory for the session
 * instead, so nothing here can fail a boot.
 */

const PREFIX = 'n-stan-app:'

const fallback = new Map<string, string>()

function store(): Storage | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined
    // Reading a property is what throws when site data is blocked.
    return localStorage.length >= 0 ? localStorage : undefined
  } catch {
    return undefined
  }
}

export function readPreference(key: string): string | undefined {
  const available = store()
  if (available === undefined) return fallback.get(PREFIX + key)
  try {
    return available.getItem(PREFIX + key) ?? undefined
  } catch {
    return fallback.get(PREFIX + key)
  }
}

export function writePreference(key: string, value: string): void {
  fallback.set(PREFIX + key, value)
  try {
    store()?.setItem(PREFIX + key, value)
  } catch {
    // Full or blocked: the in-memory copy carries the session.
  }
}

export function clearPreference(key: string): void {
  fallback.delete(PREFIX + key)
  try {
    store()?.removeItem(PREFIX + key)
  } catch {
    // Nothing to undo.
  }
}
