/**
 * Auto-fill, and the offline promise behind it (#20, #22, spec section 4).
 *
 * Three rules this module exists to keep:
 *
 * 1. **A Lookup never blocks capture.** Offline it is not even attempted, and
 *    online it carries a timeout, so a captive portal that swallows requests
 *    costs a few seconds and not the word. The entry saves either way, with its
 *    Lookup outcome marked `deferred`.
 * 2. **The retry is on open, not in a queue.** There is no background sync: the
 *    next time you open an entry whose Lookup was deferred or never attempted,
 *    and you have a connection, it is tried again. `shouldAttemptLookup` — not
 *    completeness — decides that.
 * 3. **Auto-fill prefills and never locks.** Everything written here lands in an
 *    ordinary editable field, and the automatic fill keeps whatever you typed.
 */

import { saveVocabularyEntry } from '../../data/index.ts'
import type { VocabularyEntry } from '../../domain/index.ts'
import { shouldAttemptLookup } from '../../domain/index.ts'
import type {
  DictionaryLookup,
  LookupOptions,
  LookupPartOfSpeech,
} from '../../dictionary/index.ts'
import { lookUpLemmaOnce, supportsLookup } from '../../dictionary/index.ts'
import { draftFromEntry, draftWithSense, entryFromDraft } from './vocabularyDraft.ts'

/**
 * Long enough for a slow connection, short enough that a network which accepts
 * the request and never answers still lets you get on with capturing.
 */
const LOOKUP_TIMEOUT_MS = 8000

/** Pessimistic only when the browser is sure. Unknown counts as online. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

/**
 * One Lookup, through the permanent cache, that cannot hang and cannot throw.
 * Offline it short-circuits to `deferred` without touching the network at all.
 */
export function attemptLookup(
  lemma: string,
  partOfSpeech: LookupPartOfSpeech,
  options: LookupOptions = {},
): Promise<DictionaryLookup> {
  if (!isOnline()) {
    return Promise.resolve({
      outcome: 'deferred',
      lemma: lemma.trim(),
      reason: 'No connection',
    })
  }
  return lookUpLemmaOnce(lemma, partOfSpeech, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    ...options,
  })
}

export interface AutoFillResult {
  /** The entry as it now stands, saved if the Lookup changed anything. */
  readonly entry: VocabularyEntry
  readonly lookup: DictionaryLookup
}

/**
 * The retry of spec section 4, behaviour 4: run when a Vocabulary Entry is
 * opened. Resolves to `null` when no attempt was due — an already-answered
 * Lookup, a Part of Speech SALDO has no Paradigm for, or no connection.
 *
 * Only empty Forms are filled: reopening an entry must never overwrite a Form
 * that was corrected by hand.
 */
export async function autoFillOnOpen(
  entry: VocabularyEntry,
  options: LookupOptions = {},
): Promise<AutoFillResult | null> {
  if (!shouldAttemptLookup(entry)) return null
  if (!supportsLookup(entry.partOfSpeech)) return null
  if (entry.lemma.trim() === '') return null
  if (!isOnline()) return null

  const lookup = await attemptLookup(entry.lemma, entry.partOfSpeech, options)

  // Still no answer, and the entry already says so: nothing to write.
  if (lookup.outcome === 'deferred' && entry.lookupOutcome === 'deferred') {
    return { entry, lookup }
  }

  const draft = draftFromEntry(entry)
  const filled =
    lookup.outcome === 'filled'
      ? draftWithSense(draft, lookup.senses[0], { keepTyped: true })
      : draft

  const saved = await saveVocabularyEntry(
    entryFromDraft(entry, { ...filled, lookupOutcome: lookup.outcome }),
  )
  return { entry: saved, lookup }
}

/** How a Lookup outcome reads on screen. */
export const LOOKUP_OUTCOME_LABELS = {
  'never-attempted': 'Dictionary not checked',
  filled: 'Filled from SALDO',
  'not-found': 'Not in SALDO',
  deferred: 'Waiting for a connection',
} as const
