/**
 * The permanent Dictionary cache (#19, spec section 4 behaviour 2): a word is
 * fetched from SALDO once, ever, and served from IndexedDB from then on.
 *
 * This is what makes a runtime Lookup viable at all — the alternative was
 * shipping a multi-megabyte dataset in the bundle. The cache lives here rather
 * than in the service worker so that caching stays in one place (spec 7).
 *
 * It sits in the Dictionary rather than in `src/data/` because the cached
 * payload *is* a `DictionaryLookup`: `dictionaryCache.ts` deliberately owns only
 * the key, the timestamp and the round-trip, and holds the payload as an opaque
 * value whose shape belongs to Auto-fill. This module is where that shape is
 * pinned down, read back and validated.
 *
 * **A deferred Lookup is never cached.** Deferred means "we could not reach the
 * Dictionary", not "this word has no Forms"; caching it would turn one minute on
 * the underground into a permanently empty Paradigm.
 */

import { readDictionaryCache, writeDictionaryCache } from '../data/index.ts'
import { isQueryableLemma } from './karp.ts'
import type {
  DictionaryLookup,
  FilledLookup,
  LookupOptions,
  LookupPartOfSpeech,
  NotFoundLookup,
} from './lookup.ts'
import { lookUpLemma } from './lookup.ts'

/**
 * The outcomes worth keeping. A found word and a word SALDO does not have are
 * both final answers; asking either again cannot change them.
 */
export type CacheableLookup = FilledLookup | NotFoundLookup

/**
 * The shape stored in `DictionaryCacheRecord.payload`.
 *
 * Keyed by Part of Speech because the cache record is keyed by Lemma alone, and
 * one Lemma can be looked up under more than one Part of Speech — *bok* is a
 * noun and *boka* a verb, and SALDO answers them separately.
 *
 * `version` is here so a later change of shape can be recognised and re-fetched
 * rather than mis-read; an unrecognised payload is treated as a miss.
 */
export interface DictionaryCachePayload {
  readonly version: 1
  readonly byPartOfSpeech: {
    readonly [K in LookupPartOfSpeech]?: CacheableLookup
  }
}

const PAYLOAD_VERSION = 1

function isCacheableLookup(value: unknown): value is CacheableLookup {
  if (typeof value !== 'object' || value === null) return false
  const lookup = value as Record<string, unknown>
  if (typeof lookup.lemma !== 'string') return false
  if (lookup.outcome === 'not-found') return true
  return (
    lookup.outcome === 'filled' && Array.isArray(lookup.senses) && lookup.senses.length > 0
  )
}

/** Read a stored payload back, rejecting anything this version cannot trust. */
function parsePayload(value: unknown): DictionaryCachePayload | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const payload = value as Record<string, unknown>
  if (payload.version !== PAYLOAD_VERSION) return undefined
  const byPartOfSpeech = payload.byPartOfSpeech
  if (typeof byPartOfSpeech !== 'object' || byPartOfSpeech === null) return undefined
  return {
    version: PAYLOAD_VERSION,
    // Each entry is validated on the way out, by `isCacheableLookup`.
    byPartOfSpeech: byPartOfSpeech as DictionaryCachePayload['byPartOfSpeech'],
  }
}

/**
 * The cached Lookup for this Lemma and Part of Speech, or undefined when the
 * Dictionary has never answered for it.
 */
export async function readCachedLookup(
  lemma: string,
  partOfSpeech: LookupPartOfSpeech,
): Promise<CacheableLookup | undefined> {
  const record = await readDictionaryCache(lemma)
  if (record === undefined) return undefined
  const payload = parsePayload(record.payload)
  const cached = payload?.byPartOfSpeech[partOfSpeech]
  return isCacheableLookup(cached) ? cached : undefined
}

/**
 * Keep a Lookup result forever. A deferred outcome is dropped on the floor —
 * see the note at the top of this file.
 */
export async function cacheLookup(
  lemma: string,
  partOfSpeech: LookupPartOfSpeech,
  lookup: DictionaryLookup,
): Promise<void> {
  if (lookup.outcome === 'deferred') return

  const existing = parsePayload((await readDictionaryCache(lemma))?.payload)
  const payload: DictionaryCachePayload = {
    version: PAYLOAD_VERSION,
    byPartOfSpeech: { ...existing?.byPartOfSpeech, [partOfSpeech]: lookup },
  }
  await writeDictionaryCache(lemma, payload)
}

/**
 * Look a Lemma up, at most once ever per Lemma and Part of Speech.
 *
 * A cache hit costs no network at all — this is the function every screen calls,
 * and {@link lookUpLemma} is for the one place that genuinely wants the wire.
 * Like it, this never rejects: the three outcomes are the whole answer.
 */
export async function lookUpLemmaOnce(
  lemma: string,
  partOfSpeech: LookupPartOfSpeech,
  options: LookupOptions = {},
): Promise<DictionaryLookup> {
  const trimmed = lemma.trim()
  // Nothing the Dictionary could be asked, so nothing worth a cache record.
  if (!isQueryableLemma(trimmed)) return { outcome: 'not-found', lemma: trimmed }

  const cached = await readCachedLookup(trimmed, partOfSpeech)
  if (cached !== undefined) return cached

  const lookup = await lookUpLemma(trimmed, partOfSpeech, options)
  await cacheLookup(trimmed, partOfSpeech, lookup)
  return lookup
}
