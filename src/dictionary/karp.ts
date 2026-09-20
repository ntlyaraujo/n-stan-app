/**
 * The Karp v7 wire format for Språkbanken's `saldom` resource, and the single
 * request the Dictionary makes against it.
 *
 * Nothing in this file knows about the domain model: it deals in SALDO's own
 * vocabulary (lemgram, paradigm, msd) and hands raw entries on to `saldom.ts`.
 *
 * Verified live 2026-09-20. No API key; a plain `GET` with no custom headers,
 * which also keeps the request CORS-simple and avoids a preflight.
 */

/** The only base URL that serves the query endpoint. */
export const KARP_BASE_URL = 'https://spraakbanken4.it.gu.se/karp/v7'

/**
 * Saldos morfologi. The sibling resource `saldo` is the *semantic* lexicon and
 * carries no inflection tables — it is the wrong one.
 */
export const SALDOM_RESOURCE = 'saldom'

/**
 * Karp's own default is 25, which would silently truncate a lemma with more
 * senses than that. `bok` has 4, `stor` 11; 50 is far past anything observed.
 */
export const LOOKUP_SIZE = 50

/** SALDO's part-of-speech codes for the three Parts of Speech we look up. */
export const SALDOM_PART_OF_SPEECH = {
  noun: 'nn',
  verb: 'vb',
  adjective: 'av',
} as const

export type SaldomPartOfSpeech =
  (typeof SALDOM_PART_OF_SPEECH)[keyof typeof SALDOM_PART_OF_SPEECH]

/** One row of an `inflectionTable`. Rows repeat their `msd`; see `saldom.ts`. */
export interface SaldomInflection {
  /** Morpho-syntactic descriptor, e.g. `sg indef nom`, `pret ind aktiv`. */
  readonly msd: string
  readonly writtenForm: string
  /** Undeclared, present on multi-word entries. Extra keys are possible. */
  readonly index?: string
}

/** One SALDO sense. The six declared fields of the `saldom` resource. */
export interface SaldomEntry {
  /** Unique id of this sense, e.g. `bok..nn.1`. */
  readonly lemgram: string
  readonly baseform: string
  /** e.g. `nn_3u_bok`, `vb_va_tala`, `av_2_ung`. */
  readonly paradigm: string
  readonly partOfSpeech: string
  /**
   * For `nn`, exactly one of `u` | `n` | `v` | `p` — see `saldom.ts`. For other
   * Parts of Speech it means something else entirely, or is absent.
   */
  readonly inherent?: readonly string[]
  readonly inflectionTable: readonly SaldomInflection[]
}

export interface KarpHit {
  readonly resource: string
  readonly id: string
  readonly entry: SaldomEntry
}

export interface KarpQueryResponse {
  readonly total: number
  readonly hits: readonly KarpHit[]
}

/**
 * Build the lookup request.
 *
 * `equals|baseform|…` is *analyzed*: it matches tokens case-insensitively, so
 * it pulls in multi-word entries (`tala` returns fifteen `vbm` phrases plus
 * `tala..vb.1`). The part-of-speech clause removes the `…m` multi-word and
 * `…a` abbreviation codes, and `saldom.ts` re-checks `baseform` in JS anyway.
 *
 * The lemma is wrapped in the DSL's quoted-string form so that a space inside
 * it cannot be read as a second token — verified against the live API.
 *
 * `lexicon_stats=false` looks like an obvious payload trim and is **not**:
 * any falsy value for it makes the server answer HTTP 500. Omit the parameter.
 */
export function buildLookupUrl(
  lemma: string,
  partOfSpeech: SaldomPartOfSpeech,
  baseUrl: string = KARP_BASE_URL,
): URL {
  const url = new URL(`${baseUrl}/query/${SALDOM_RESOURCE}`)
  url.searchParams.set(
    'q',
    `and(equals|baseform|"${lemma}"||equals|partOfSpeech|${partOfSpeech})`,
  )
  url.searchParams.set('size', String(LOOKUP_SIZE))
  return url
}

/**
 * A lemma Karp can be asked about at all. `"` would close the quoted string in
 * the query DSL and there is no verified escape for it; no SALDO baseform
 * contains one, so such a lemma is a miss rather than a request worth making.
 */
export function isQueryableLemma(lemma: string): boolean {
  return lemma.trim() !== '' && !lemma.includes('"')
}

function isInflection(value: unknown): value is SaldomInflection {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.msd === 'string' && typeof row.writtenForm === 'string'
}

function isEntry(value: unknown): value is SaldomEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.lemgram === 'string' &&
    typeof entry.baseform === 'string' &&
    typeof entry.paradigm === 'string' &&
    typeof entry.partOfSpeech === 'string' &&
    Array.isArray(entry.inflectionTable) &&
    entry.inflectionTable.every(isInflection) &&
    (entry.inherent === undefined ||
      (Array.isArray(entry.inherent) &&
        entry.inherent.every((item) => typeof item === 'string')))
  )
}

function isHit(value: unknown): value is KarpHit {
  if (typeof value !== 'object' || value === null) return false
  const hit = value as Record<string, unknown>
  return isEntry(hit.entry)
}

/**
 * Narrow a decoded JSON payload to the response we understand, or `undefined`
 * if it is not one. A 200 carrying something unexpected is a failed Lookup,
 * not an empty one — the caller must not read it as "no such word".
 */
export function parseKarpResponse(payload: unknown): KarpQueryResponse | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const body = payload as Record<string, unknown>
  if (typeof body.total !== 'number' || !Array.isArray(body.hits)) return undefined
  if (!body.hits.every(isHit)) return undefined
  return { total: body.total, hits: body.hits }
}
