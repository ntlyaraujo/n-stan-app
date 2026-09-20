/**
 * #19 — the permanent Dictionary cache.
 *
 * The behaviour worth pinning is about the network, not the shape of the record:
 * a word is fetched once, a word SALDO does not have is also fetched once, and a
 * Lookup that never reached the Dictionary is not remembered as an answer.
 *
 * Every `fetch` here is a counting stub over a recorded response, so the suite
 * never touches the network.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { deleteDatabase } from '../data/db.ts'
import { readDictionaryCache, writeDictionaryCache } from '../data/dictionaryCache.ts'
import { FIXTURES } from './fixtures.ts'
import { cacheLookup, lookUpLemmaOnce, readCachedLookup } from './cachedLookup.ts'

beforeEach(async () => {
  await deleteDatabase()
})

interface CountingFetch {
  readonly fetch: typeof globalThis.fetch
  readonly calls: () => number
}

/** A `fetch` that replays one recorded body and counts how often it was asked. */
function replay(body: unknown, init: ResponseInit = {}): CountingFetch {
  let calls = 0
  return {
    fetch: () => {
      calls += 1
      return Promise.resolve(new Response(JSON.stringify(body), init))
    },
    calls: () => calls,
  }
}

/** A `fetch` that fails the way being offline fails. */
function offline(): CountingFetch {
  let calls = 0
  return {
    fetch: () => {
      calls += 1
      return Promise.reject(new TypeError('Failed to fetch'))
    },
    calls: () => calls,
  }
}

describe('lookUpLemmaOnce', () => {
  it('fetches a Lemma it has never seen, and keeps the answer', async () => {
    const network = replay(FIXTURES.bokNn)

    const lookup = await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })

    expect(network.calls()).toBe(1)
    expect(lookup.outcome).toBe('filled')
    expect(await readDictionaryCache('bok')).toBeDefined()
  })

  it('serves a second Lookup of the same word from the cache, with no network', async () => {
    const network = replay(FIXTURES.bokNn)

    const first = await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })
    const second = await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })

    expect(network.calls()).toBe(1)
    expect(second).toEqual(first)
  })

  it('matches a cached Lemma without regard to case or surrounding space', async () => {
    const network = replay(FIXTURES.bokNn)

    await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })
    const again = await lookUpLemmaOnce('  Bok ', 'noun', { fetch: network.fetch })

    expect(network.calls()).toBe(1)
    expect(again.outcome).toBe('filled')
  })

  it('caches a word the Dictionary does not have, so a miss is also fetched once', async () => {
    const network = replay(FIXTURES.notFoundNn)

    const first = await lookUpLemmaOnce('kvasimodo', 'noun', { fetch: network.fetch })
    const second = await lookUpLemmaOnce('kvasimodo', 'noun', { fetch: network.fetch })

    expect(first.outcome).toBe('not-found')
    expect(second.outcome).toBe('not-found')
    expect(network.calls()).toBe(1)
  })

  it('never caches a deferred Lookup: no answer is not the same as no Forms', async () => {
    const network = offline()

    const lookup = await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })

    expect(lookup.outcome).toBe('deferred')
    expect(await readDictionaryCache('bok')).toBeUndefined()
    expect(await readCachedLookup('bok', 'noun')).toBeUndefined()
  })

  it('tries again after a deferred Lookup, and caches what it finally gets', async () => {
    const dead = offline()
    await lookUpLemmaOnce('bok', 'noun', { fetch: dead.fetch })

    const network = replay(FIXTURES.bokNn)
    const lookup = await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })

    expect(lookup.outcome).toBe('filled')
    expect(network.calls()).toBe(1)
    expect(await readCachedLookup('bok', 'noun')).toBeDefined()
  })

  it('does not cache a server error either — a 500 is deferred, not an answer', async () => {
    const network = replay(FIXTURES.bokNn, { status: 500 })

    const lookup = await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })

    expect(lookup.outcome).toBe('deferred')
    expect(await readDictionaryCache('bok')).toBeUndefined()
  })

  it('keeps one Lemma looked up under two Parts of Speech apart', async () => {
    const verb = replay(FIXTURES.talaVb)
    const noun = replay(FIXTURES.notFoundNn)

    const asVerb = await lookUpLemmaOnce('tala', 'verb', { fetch: verb.fetch })
    // The record is keyed by Lemma alone, so the second Part of Speech has to
    // reach the network rather than read the verb's answer back.
    const asNoun = await lookUpLemmaOnce('tala', 'noun', { fetch: noun.fetch })

    expect(asVerb.outcome).toBe('filled')
    expect(asNoun.outcome).toBe('not-found')
    expect(noun.calls()).toBe(1)

    // And neither has displaced the other.
    expect((await readCachedLookup('tala', 'verb'))?.outcome).toBe('filled')
    expect((await readCachedLookup('tala', 'noun'))?.outcome).toBe('not-found')
    expect((await lookUpLemmaOnce('tala', 'verb', { fetch: verb.fetch })).outcome).toBe(
      'filled',
    )
    expect(verb.calls()).toBe(1)
  })

  it('asks the Dictionary nothing for a Lemma it could not query', async () => {
    const network = replay(FIXTURES.bokNn)

    const lookup = await lookUpLemmaOnce('   ', 'noun', { fetch: network.fetch })

    expect(lookup.outcome).toBe('not-found')
    expect(network.calls()).toBe(0)
  })
})

describe('the cached payload', () => {
  it('survives the round-trip with its Forms intact', async () => {
    const network = replay(FIXTURES.bokNn)
    await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })

    const cached = await readCachedLookup('bok', 'noun')
    expect(cached?.outcome).toBe('filled')
    if (cached?.outcome !== 'filled') throw new Error('Expected a filled Lookup')
    expect(cached.senses[0].forms).toMatchObject({
      indefiniteSingular: 'bok',
      definiteSingular: 'boken',
    })
  })

  it('ignores a payload written by a shape this version does not know', async () => {
    // Older record, or one from a future version: read as a miss rather than
    // mis-read, so the word is simply fetched again.
    await writeDictionaryCache('bok', { version: 99, senses: [] })

    expect(await readCachedLookup('bok', 'noun')).toBeUndefined()

    const network = replay(FIXTURES.bokNn)
    expect((await lookUpLemmaOnce('bok', 'noun', { fetch: network.fetch })).outcome).toBe(
      'filled',
    )
    expect(network.calls()).toBe(1)
  })

  it('drops a deferred Lookup handed to it directly', async () => {
    await cacheLookup('bok', 'noun', {
      outcome: 'deferred',
      lemma: 'bok',
      reason: 'Failed to fetch',
    })

    expect(await readDictionaryCache('bok')).toBeUndefined()
  })
})
