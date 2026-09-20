/**
 * One Lookup against the Dictionary (#17).
 *
 * `lookUpLemma` is the whole public surface: lemma and Part of Speech in, a
 * `DictionaryLookup` out, never throwing. The permanent per-word cache of
 * spec section 4 wraps this function; it is deliberately not built in here.
 */

import type {
  AdjectiveForms,
  ConjugationGroup,
  Gender,
  LookupOutcome,
  NounForms,
  PartOfSpeech,
  VerbForms,
} from '../domain/index.ts'
import type { KarpQueryResponse, SaldomEntry, SaldomPartOfSpeech } from './karp.ts'
import {
  buildLookupUrl,
  isQueryableLemma,
  KARP_BASE_URL,
  parseKarpResponse,
  SALDOM_PART_OF_SPEECH,
} from './karp.ts'
import { deriveConjugationGroup } from './conjugationGroup.ts'
import {
  adjectiveForms,
  genderOf,
  matchesLemma,
  nounForms,
  senseNumber,
  verbForms,
} from './saldom.ts'

/** The Parts of Speech SALDO has a Paradigm for. The rest carry no Forms. */
export type LookupPartOfSpeech = keyof typeof SALDOM_PART_OF_SPEECH

export function supportsLookup(
  partOfSpeech: PartOfSpeech,
): partOfSpeech is LookupPartOfSpeech {
  return partOfSpeech in SALDOM_PART_OF_SPEECH
}

interface SenseCommon {
  /** SALDO's id for this sense, e.g. `bok..nn.1`. Stable, and a good cache key. */
  readonly lemgram: string
  /** SALDO's paradigm identifier, e.g. `nn_3u_bok`. Kept for diagnosis. */
  readonly paradigm: string
}

export interface NounSense extends SenseCommon {
  readonly partOfSpeech: 'noun'
  readonly gender?: Gender
  readonly forms: NounForms
}

export interface VerbSense extends SenseCommon {
  readonly partOfSpeech: 'verb'
  readonly conjugationGroup?: ConjugationGroup
  readonly forms: VerbForms
}

export interface AdjectiveSense extends SenseCommon {
  readonly partOfSpeech: 'adjective'
  readonly forms: AdjectiveForms
}

export type DictionarySense = NounSense | VerbSense | AdjectiveSense

/**
 * A Lookup that reached SALDO and found the word. `senses` is never empty and
 * is ordered by sense number, so `senses[0]` is what Auto-fill prefills.
 *
 * SALDO offers no gloss to tell senses apart — *bok* is both *böcker* and
 * *bokar* — so the rest are handed on rather than discarded: spec section 4
 * wants duplicates to warn and never block.
 *
 * Its Forms may all be empty. A deponent verb or a plural-only noun is a
 * *found* word with nothing to prefill, which is not the same as a miss and
 * must not be retried.
 */
export interface FilledLookup {
  readonly outcome: Extract<LookupOutcome, 'filled'>
  readonly lemma: string
  readonly senses: readonly [DictionarySense, ...DictionarySense[]]
}

/** SALDO answered and has no such word. Asking again will not change that. */
export interface NotFoundLookup {
  readonly outcome: Extract<LookupOutcome, 'not-found'>
  readonly lemma: string
}

/**
 * The Lookup never got an answer — offline, a server error, or a body that was
 * not the response we understand. The entry saves with blank Forms and is
 * tried again later, per spec section 4.
 */
export interface DeferredLookup {
  readonly outcome: Extract<LookupOutcome, 'deferred'>
  readonly lemma: string
  /** Why it failed. For diagnosis and a hint in the UI; not for branching on. */
  readonly reason: string
}

export type DictionaryLookup = FilledLookup | NotFoundLookup | DeferredLookup

export interface LookupOptions {
  /** Injectable for tests against recorded responses. Defaults to global `fetch`. */
  readonly fetch?: typeof globalThis.fetch
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

function toSense(entry: SaldomEntry, partOfSpeech: LookupPartOfSpeech): DictionarySense {
  const common = { lemgram: entry.lemgram, paradigm: entry.paradigm }
  switch (partOfSpeech) {
    case 'noun':
      return {
        ...common,
        partOfSpeech: 'noun',
        gender: genderOf(entry),
        forms: nounForms(entry),
      }
    case 'verb':
      return {
        ...common,
        partOfSpeech: 'verb',
        conjugationGroup: deriveConjugationGroup(entry),
        forms: verbForms(entry),
      }
    case 'adjective':
      return { ...common, partOfSpeech: 'adjective', forms: adjectiveForms(entry) }
  }
}

/**
 * Turn a Karp response into a Lookup outcome.
 *
 * Separate from the request so it can be tested against recorded responses,
 * and so the hit filtering lives in one place: the query's part-of-speech
 * clause is re-applied here, because the response is the only thing this
 * function is allowed to trust.
 */
export function mapKarpResponse(
  response: KarpQueryResponse,
  lemma: string,
  partOfSpeech: LookupPartOfSpeech,
): FilledLookup | NotFoundLookup {
  const code: SaldomPartOfSpeech = SALDOM_PART_OF_SPEECH[partOfSpeech]
  const entries = response.hits
    .map((hit) => hit.entry)
    .filter((entry) => entry.partOfSpeech === code && matchesLemma(entry, lemma))
    .sort((a, b) => senseNumber(a) - senseNumber(b))

  const [first, ...rest] = entries.map((entry) => toSense(entry, partOfSpeech))
  if (first === undefined) return { outcome: 'not-found', lemma }
  return { outcome: 'filled', lemma, senses: [first, ...rest] }
}

/**
 * Look a lemma up in SALDO. Resolves to one of the three outcomes and never
 * rejects: a miss, an answer, and a failure to get an answer are different
 * things and the caller must be able to tell them apart.
 */
export async function lookUpLemma(
  lemma: string,
  partOfSpeech: LookupPartOfSpeech,
  options: LookupOptions = {},
): Promise<DictionaryLookup> {
  const trimmed = lemma.trim()
  if (!isQueryableLemma(trimmed)) return { outcome: 'not-found', lemma: trimmed }

  const fetchImpl = options.fetch ?? globalThis.fetch
  const url = buildLookupUrl(
    trimmed,
    SALDOM_PART_OF_SPEECH[partOfSpeech],
    options.baseUrl ?? KARP_BASE_URL,
  )

  let payload: unknown
  try {
    // A plain GET: no headers, no credentials, no API key. Karp reflects the
    // request Origin rather than sending `*`, and staying CORS-simple avoids
    // the preflight altogether.
    const response = await fetchImpl(url, { signal: options.signal })
    if (!response.ok) {
      return {
        outcome: 'deferred',
        lemma: trimmed,
        reason: `Karp responded ${String(response.status)}`,
      }
    }
    payload = await response.json()
  } catch (error) {
    return {
      outcome: 'deferred',
      lemma: trimmed,
      reason: error instanceof Error ? error.message : 'Lookup failed',
    }
  }

  const parsed = parseKarpResponse(payload)
  if (parsed === undefined) {
    return {
      outcome: 'deferred',
      lemma: trimmed,
      reason: 'Karp returned an unrecognised response',
    }
  }

  // A missing lemma is HTTP 200 with `total: 0`, never a 404 — the miss is
  // read off the body, never off the status code.
  return mapKarpResponse(parsed, trimmed, partOfSpeech)
}
