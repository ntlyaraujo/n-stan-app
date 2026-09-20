/**
 * Persistent storage (#23, spec 6).
 *
 * Browsers evict site data under pressure, and a journal built over months is
 * the worst possible thing to lose that way. `navigator.storage.persist()` asks
 * the browser to exempt this site, which costs one call and materially lowers
 * the risk.
 *
 * Three outcomes, none of which is an error worth showing:
 *
 * - **Granted.** Chrome decides silently from engagement heuristics; Firefox
 *   asks. Either way the database is no longer evicted under pressure.
 * - **Declined.** The app works exactly as before, just with the ordinary
 *   eviction risk — which is precisely what the export reminder is for.
 * - **Unsupported.** Older Safari has no Storage API at all. Also not an error.
 *
 * Boot asks once and then leaves it alone, so a browser that prompts does not
 * prompt on every start. Settings shows the current state and offers an
 * explicit ask, which is the right place for a request that may show a prompt:
 * the person pressed a button.
 */

import { readPreference, writePreference } from './localPreferences.ts'

export type PersistentStorageState =
  /** The browser has exempted this site from eviction under pressure. */
  | 'persisted'
  /** Storage is evictable — either not yet asked for, or declined. */
  | 'not-persisted'
  /** No Storage API in this browser. Nothing to ask. */
  | 'unsupported'

const ASKED_KEY = 'persistentStorageAsked'

function storageManager(): StorageManager | undefined {
  if (typeof navigator === 'undefined') return undefined
  const manager = navigator.storage as StorageManager | undefined
  return typeof manager?.persist === 'function' ? manager : undefined
}

export async function persistentStorageState(): Promise<PersistentStorageState> {
  const manager = storageManager()
  if (manager === undefined) return 'unsupported'
  try {
    return (await manager.persisted()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'unsupported'
  }
}

/** Whether this browser has already been asked once, on any previous start. */
export function hasAskedForPersistentStorage(): boolean {
  return readPreference(ASKED_KEY) === 'true'
}

/**
 * Ask the browser to keep this site's data.
 *
 * Boot calls this with no arguments: it asks at most once ever, and returns the
 * resulting state rather than throwing, so a declined or missing API cannot
 * fail a start. Settings passes `{ ask: 'again' }` when the person asks for it
 * by hand.
 */
export async function requestPersistentStorage(
  { ask }: { ask?: 'once' | 'again' } = {},
): Promise<PersistentStorageState> {
  const manager = storageManager()
  if (manager === undefined) return 'unsupported'

  try {
    if (await manager.persisted()) return 'persisted'
    if (ask !== 'again' && hasAskedForPersistentStorage()) return 'not-persisted'

    writePreference(ASKED_KEY, 'true')
    return (await manager.persist()) ? 'persisted' : 'not-persisted'
  } catch {
    // A refusal, a missing permission, a browser that throws instead of
    // resolving false: all the same outcome, and none of them is a failure.
    return 'not-persisted'
  }
}

export interface StorageUsage {
  readonly usage: number
  readonly quota: number
}

/** Roughly how much room the database is using, when the browser will say. */
export async function storageUsage(): Promise<StorageUsage | undefined> {
  const manager = storageManager()
  if (manager === undefined || typeof manager.estimate !== 'function') return undefined
  try {
    const estimate = await manager.estimate()
    if (estimate.usage === undefined || estimate.quota === undefined) return undefined
    return { usage: estimate.usage, quota: estimate.quota }
  } catch {
    return undefined
  }
}
