/**
 * The Dictionary cache (spec 4, 7): every Lookup result is kept forever, so a
 * word is fetched from SALDO once. Cached here rather than by the service
 * worker, so caching stays in one place.
 *
 * The shape of `payload` belongs to the Dictionary auto-fill ticket: this store
 * deliberately holds it as an opaque value and only owns the key, the timestamp
 * and the round-trip. When auto-fill pins the mapped shape down, a migration in
 * `db.ts` can carry these records forward.
 */

import { getRecord, now, request, STORES, withStores } from './db.ts'
import { lemmaKey } from './vocabularyRepository.ts'

export interface DictionaryCacheRecord {
  /** The case-folded Lemma the response was fetched for. The primary key. */
  readonly lemmaKey: string
  /** The Lemma as it was looked up, in its original spelling. */
  readonly lemma: string
  /** When it was fetched. A cached response is never evicted by age; this is for support. */
  readonly fetchedAt: string
  /** The mapped Dictionary response. Owned by the auto-fill ticket. */
  readonly payload: unknown
}

/** The cached Lookup for a Lemma, or undefined when it has never been fetched. */
export function readDictionaryCache(lemma: string): Promise<DictionaryCacheRecord | undefined> {
  return withStores([STORES.dictionaryCache], 'readonly', (transaction) =>
    getRecord<DictionaryCacheRecord>(
      transaction.objectStore(STORES.dictionaryCache),
      lemmaKey(lemma),
    ),
  )
}

/** Cache a Lookup result. Looking the same Lemma up again replaces it. */
export async function writeDictionaryCache(
  lemma: string,
  payload: unknown,
): Promise<DictionaryCacheRecord> {
  const record: DictionaryCacheRecord = {
    lemmaKey: lemmaKey(lemma),
    lemma,
    fetchedAt: now(),
    payload,
  }
  await withStores([STORES.dictionaryCache], 'readwrite', async (transaction) => {
    await request(transaction.objectStore(STORES.dictionaryCache).put(record))
  })
  return record
}
