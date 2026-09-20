/**
 * #17 — Karp client and response mapping, against recorded live responses.
 *
 * `lookUpLemma` is exercised through an injected `fetch` that replays a
 * fixture, so the suite never touches the network.
 */

import { describe, expect, it } from 'vitest'
import { buildLookupUrl, KARP_BASE_URL, parseKarpResponse } from './karp.ts'
import { FIXTURES } from './fixtures.ts'
import {
  lookUpLemma,
  mapKarpResponse,
  supportsLookup,
  type DictionaryLookup,
  type FilledLookup,
  type LookupPartOfSpeech,
} from './lookup.ts'

function mapped(
  fixture: unknown,
  lemma: string,
  partOfSpeech: LookupPartOfSpeech,
): DictionaryLookup {
  const response = parseKarpResponse(fixture)
  if (response === undefined) throw new Error('Fixture is not a Karp response')
  return mapKarpResponse(response, lemma, partOfSpeech)
}

function filled(
  fixture: unknown,
  lemma: string,
  partOfSpeech: LookupPartOfSpeech,
): FilledLookup {
  const lookup = mapped(fixture, lemma, partOfSpeech)
  if (lookup.outcome !== 'filled') throw new Error(`Expected a filled Lookup, got ${lookup.outcome}`)
  return lookup
}

/** A `fetch` that answers every request with one recorded body. */
function replay(body: unknown, init: ResponseInit = {}): typeof globalThis.fetch {
  return () => Promise.resolve(new Response(JSON.stringify(body), init))
}

describe('buildLookupUrl', () => {
  it('quotes the lemma and constrains the part of speech', () => {
    const url = buildLookupUrl('bok', 'nn')
    expect(url.origin + url.pathname).toBe(`${KARP_BASE_URL}/query/saldom`)
    expect(url.searchParams.get('q')).toBe(
      'and(equals|baseform|"bok"||equals|partOfSpeech|nn)',
    )
  })

  it('asks for more than Karp\'s default page of 25, which would truncate senses', () => {
    expect(Number(buildLookupUrl('stor', 'av').searchParams.get('size'))).toBeGreaterThan(25)
  })

  it('never sends lexicon_stats, which makes the server answer 500', () => {
    // Suppressing the per-resource hit count looks like a free payload trim.
    // Any falsy value for it is an HTTP 500 — verified live 2026-09-20.
    expect(buildLookupUrl('bok', 'nn').searchParams.has('lexicon_stats')).toBe(false)
  })

  it('encodes Swedish letters and the DSL metacharacters', () => {
    // `URLSearchParams` percent-encodes the parentheses too, which
    // `encodeURIComponent` leaves alone. Karp accepts this exact URL —
    // verified live 2026-09-20, 200 with both senses of *köpa*.
    expect(buildLookupUrl('köpa', 'vb').toString()).toBe(
      'https://spraakbanken4.it.gu.se/karp/v7/query/saldom' +
        '?q=and%28equals%7Cbaseform%7C%22k%C3%B6pa%22%7C%7Cequals%7CpartOfSpeech%7Cvb%29' +
        '&size=50',
    )
  })
})

describe('nouns', () => {
  it("maps the spec's worked example", () => {
    const lookup = filled(FIXTURES.bokNn, 'bok', 'noun')
    const [bok] = lookup.senses
    expect(bok).toMatchObject({
      partOfSpeech: 'noun',
      lemgram: 'bok..nn.1',
      gender: 'en',
      forms: {
        indefiniteSingular: 'bok',
        definiteSingular: 'boken',
        indefinitePlural: 'böcker',
        definitePlural: 'böckerna',
      },
    })
  })

  it('keeps every sense, lowest lemgram number first', () => {
    // SALDO has no gloss to tell the book from the beech tree apart, so the
    // other senses are handed on rather than thrown away.
    const lookup = filled(FIXTURES.bokNn, 'bok', 'noun')
    expect(lookup.senses.map((sense) => sense.lemgram)).toEqual(['bok..nn.1', 'bok..nn.2'])
    expect(lookup.senses[1]).toMatchObject({ forms: { indefinitePlural: 'bokar' } })
  })

  it('reads an ett word from the inherent marker', () => {
    expect(filled(FIXTURES.husNn, 'hus', 'noun').senses[0]).toMatchObject({
      gender: 'ett',
      forms: { indefiniteSingular: 'hus', definiteSingular: 'huset', definitePlural: 'husen' },
    })
  })

  it('leaves the Gender empty when the noun takes both en and ett', () => {
    const [vacillating, utrum] = filled(FIXTURES.acceptNn, 'accept', 'noun').senses
    expect(vacillating).toMatchObject({ lemgram: 'accept..nn.1', gender: undefined })
    expect(utrum).toMatchObject({ lemgram: 'accept..nn.2', gender: 'en' })
  })

  it('leaves the Gender and the singular empty for a plural-only noun', () => {
    const [sense] = filled(FIXTURES.abstinensbesvarNn, 'abstinensbesvär', 'noun').senses
    expect(sense).toMatchObject({
      gender: undefined,
      forms: {
        indefiniteSingular: undefined,
        definiteSingular: undefined,
        indefinitePlural: 'abstinensbesvär',
        definitePlural: 'abstinensbesvären',
      },
    })
  })
})

describe('verbs', () => {
  it("maps the spec's worked example, taking the first of the duplicate rows", () => {
    // `tala..vb.1` carries two `pret ind aktiv` rows (talade, talte) and two
    // `sup aktiv` rows (talat, talt). Building a map from the table keeps the
    // *last* of each and prints the rarer variant.
    const [tala] = filled(FIXTURES.talaVb, 'tala', 'verb').senses
    expect(tala).toMatchObject({
      partOfSpeech: 'verb',
      conjugationGroup: undefined,
      forms: {
        infinitive: 'tala',
        present: 'talar',
        preterite: 'talade',
        supine: 'talat',
      },
    })
  })

  it('fills the Conjugation Group when the paradigm determines one', () => {
    expect(filled(FIXTURES.kopaVb, 'köpa', 'verb').senses[0]).toMatchObject({
      conjugationGroup: '2b',
      forms: { infinitive: 'köpa', present: 'köper', preterite: 'köpte', supine: 'köpt' },
    })
  })

  it('finds a deponent verb and fills none of its Forms', () => {
    // A found word with nothing to prefill. Not a miss: asking again will
    // never produce active forms, so the Lookup must not stay retryable.
    const lookup = filled(FIXTURES.andasVb, 'andas', 'verb')
    expect(lookup.outcome).toBe('filled')
    expect(lookup.senses[0]).toMatchObject({
      forms: {
        infinitive: undefined,
        present: undefined,
        preterite: undefined,
        supine: undefined,
      },
    })
  })
})

describe('adjectives', () => {
  it("maps the spec's worked example", () => {
    expect(filled(FIXTURES.storAv, 'stor', 'adjective').senses[0]).toMatchObject({
      partOfSpeech: 'adjective',
      lemgram: 'stor..av.1',
      forms: { positiveEnForm: 'stor', positiveEttForm: 'stort', positivePlural: 'stora' },
    })
  })

  it('fills all three Forms of an invariable adjective from its single form', () => {
    expect(filled(FIXTURES.abborrliknandeAv, 'abborrliknande', 'adjective').senses[0]).toMatchObject(
      {
        forms: {
          positiveEnForm: 'abborrliknande',
          positiveEttForm: 'abborrliknande',
          positivePlural: 'abborrliknande',
        },
      },
    )
  })
})

describe('filtering what the analyzed baseform match drags in', () => {
  it('drops multi-word entries and keeps the single-word verb', () => {
    // Unconstrained, `tala` returns fifteen `vbm` phrases *before* `tala..vb.1`
    // — so "take the first hit" is wrong as well as "take every hit".
    const lookup = filled(FIXTURES.talaUnfiltered, 'tala', 'verb')
    expect(lookup.senses).toHaveLength(1)
    expect(lookup.senses[0].lemgram).toBe('tala..vb.1')
  })

  it('reports a miss when nothing in the response is the right part of speech', () => {
    expect(mapped(FIXTURES.talaUnfiltered, 'tala', 'noun').outcome).toBe('not-found')
  })

  it('accepts a differently cased lemma, because the API match is case-insensitive', () => {
    expect(filled(FIXTURES.bokNn, 'BOK', 'noun').senses[0].lemgram).toBe('bok..nn.1')
  })

  it('reports a miss when the hits are a different word', () => {
    expect(mapped(FIXTURES.bokNn, 'bocken', 'noun').outcome).toBe('not-found')
  })
})

describe('lookUpLemma outcomes', () => {
  it('is filled when SALDO has the word', async () => {
    const lookup = await lookUpLemma('bok', 'noun', { fetch: replay(FIXTURES.bokNn) })
    expect(lookup.outcome).toBe('filled')
  })

  it('is not-found on a 200 with total 0, never a 404', async () => {
    const lookup = await lookUpLemma('xyzzyqwerty', 'noun', {
      fetch: replay(FIXTURES.notFoundNn),
    })
    expect(lookup).toEqual({ outcome: 'not-found', lemma: 'xyzzyqwerty' })
  })

  it('is deferred when the request fails outright', async () => {
    const lookup = await lookUpLemma('bok', 'noun', {
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    })
    expect(lookup).toMatchObject({ outcome: 'deferred', reason: 'Failed to fetch' })
  })

  it('is deferred, not not-found, on a server error', async () => {
    const lookup = await lookUpLemma('bok', 'noun', {
      fetch: replay({ detail: 'Internal server error' }, { status: 500 }),
    })
    expect(lookup.outcome).toBe('deferred')
  })

  it('is deferred when a 200 carries something that is not a Karp response', async () => {
    const lookup = await lookUpLemma('bok', 'noun', { fetch: replay({ oops: true }) })
    expect(lookup.outcome).toBe('deferred')
  })

  it('tells a miss, an answer with no Forms and a failure apart', async () => {
    const outcomes = await Promise.all([
      lookUpLemma('andas', 'verb', { fetch: replay(FIXTURES.andasVb) }),
      lookUpLemma('xyzzyqwerty', 'noun', { fetch: replay(FIXTURES.notFoundNn) }),
      lookUpLemma('bok', 'noun', { fetch: () => Promise.reject(new Error('offline')) }),
    ])
    expect(outcomes.map((lookup) => lookup.outcome)).toEqual([
      'filled',
      'not-found',
      'deferred',
    ])
  })

  it('does not call the API for a lemma the query DSL cannot express', async () => {
    let called = false
    const lookup = await lookUpLemma('bo"k', 'noun', {
      fetch: () => {
        called = true
        return Promise.reject(new Error('should not be called'))
      },
    })
    expect(called).toBe(false)
    expect(lookup.outcome).toBe('not-found')
  })

  it('sends a plain GET with no headers and no credentials, to stay CORS-simple', async () => {
    let seen: RequestInit | undefined
    await lookUpLemma('bok', 'noun', {
      fetch: (_url, init) => {
        seen = init
        return Promise.resolve(new Response(JSON.stringify(FIXTURES.bokNn)))
      },
    })
    expect(seen?.method).toBeUndefined()
    expect(seen?.headers).toBeUndefined()
    expect(seen?.credentials).toBeUndefined()
  })
})

describe('supportsLookup', () => {
  it('covers the three Parts of Speech with a Paradigm and no others', () => {
    expect((['noun', 'verb', 'adjective'] as const).map(supportsLookup)).toEqual([true, true, true])
    expect((['adverb', 'phrase', 'other'] as const).map(supportsLookup)).toEqual([
      false,
      false,
      false,
    ])
  })
})
