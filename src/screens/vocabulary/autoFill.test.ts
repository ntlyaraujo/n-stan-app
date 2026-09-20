/**
 * #22 — the automatic fill retry, and the draft conversion under it (#20).
 *
 * Not a component test: what is exercised here is the decision and the write —
 * when a Lookup is owed, what it is allowed to overwrite, and what the entry
 * looks like afterwards. The screens only call this.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  createVocabularyEntry,
  deleteDatabase,
  getVocabularyEntry,
} from '../../data/index.ts'
import type { NounVocabularyEntry, VocabularyEntry } from '../../domain/index.ts'
import { isComplete } from '../../domain/index.ts'
import { FIXTURES } from '../../dictionary/fixtures.ts'
import { autoFillOnOpen } from './autoFill.ts'
import {
  draftFromEntry,
  entryFromDraft,
  paradigmIsUntouched,
  vocabularyEntryDraftOf,
} from './vocabularyDraft.ts'

beforeEach(async () => {
  await deleteDatabase()
})

/** A `fetch` that replays one recorded Karp response. */
function replay(body: unknown): typeof globalThis.fetch {
  return () => Promise.resolve(new Response(JSON.stringify(body)))
}

/** A `fetch` that fails the way being offline fails. */
const dead: typeof globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'))

async function captureBok(
  overrides: Partial<NounVocabularyEntry> = {},
): Promise<VocabularyEntry> {
  const { entry } = await createVocabularyEntry({
    lemma: 'bok',
    partOfSpeech: 'noun',
    forms: {},
    lookupOutcome: 'deferred',
    ...overrides,
  })
  return entry
}

describe('autoFillOnOpen', () => {
  it('fills a word captured offline the next time it is opened', async () => {
    const entry = await captureBok()

    const result = await autoFillOnOpen(entry, { fetch: replay(FIXTURES.bokNn) })

    expect(result?.lookup.outcome).toBe('filled')
    expect(result?.entry.lookupOutcome).toBe('filled')
    expect(isComplete(result!.entry)).toBe(true)

    // And it was written through, not merely shown.
    const reread = await getVocabularyEntry(entry.id)
    expect(reread?.partOfSpeech).toBe('noun')
    expect(reread?.lookupOutcome).toBe('filled')
  })

  it('fills in the Gender, which is the thing that cannot be guessed', async () => {
    const entry = await captureBok()

    const result = await autoFillOnOpen(entry, { fetch: replay(FIXTURES.bokNn) })

    expect(result?.entry.partOfSpeech).toBe('noun')
    if (result?.entry.partOfSpeech !== 'noun') throw new Error('Expected a noun')
    expect(result.entry.gender).toBe('en')
  })

  it('never overwrites a Form that was typed by hand', async () => {
    const entry = await captureBok({ forms: { definiteSingular: 'MINE' } })

    const result = await autoFillOnOpen(entry, { fetch: replay(FIXTURES.bokNn) })

    if (result?.entry.partOfSpeech !== 'noun') throw new Error('Expected a noun')
    expect(result.entry.forms.definiteSingular).toBe('MINE')
    expect(result.entry.forms.indefinitePlural).toBe('böcker')
  })

  it('leaves an entry whose Lookup already succeeded completely alone', async () => {
    const entry = await captureBok({ lookupOutcome: 'filled' })

    expect(await autoFillOnOpen(entry, { fetch: replay(FIXTURES.bokNn) })).toBeNull()
  })

  it('attempts a Lookup that was never tried, whatever the completeness', async () => {
    // Completeness never decides this; the Lookup outcome does. A phrase is
    // Complete from the moment it is captured and still gets no Lookup, because
    // SALDO has no Paradigm for one.
    const { entry: phrase } = await createVocabularyEntry({
      lemma: 'det spelar ingen roll',
      partOfSpeech: 'phrase',
    })
    expect(isComplete(phrase)).toBe(true)
    expect(await autoFillOnOpen(phrase, { fetch: replay(FIXTURES.bokNn) })).toBeNull()

    const noun = await captureBok({ lookupOutcome: 'never-attempted' })
    expect((await autoFillOnOpen(noun, { fetch: replay(FIXTURES.bokNn) }))?.lookup.outcome).toBe(
      'filled',
    )
  })

  it('stays deferred, with its Forms blank, when the Dictionary is still unreachable', async () => {
    const entry = await captureBok()

    const result = await autoFillOnOpen(entry, { fetch: dead })

    expect(result?.lookup.outcome).toBe('deferred')
    expect(result?.entry.lookupOutcome).toBe('deferred')
    if (result?.entry.partOfSpeech !== 'noun') throw new Error('Expected a noun')
    expect(result.entry.forms).toEqual({})
  })

  it('records a word SALDO does not have, so it is not asked again', async () => {
    const entry = await captureBok({ lemma: 'kvasimodo' })

    const result = await autoFillOnOpen(entry, { fetch: replay(FIXTURES.notFoundNn) })

    expect(result?.entry.lookupOutcome).toBe('not-found')
    expect(await autoFillOnOpen(result!.entry, { fetch: replay(FIXTURES.bokNn) })).toBeNull()
  })
})

describe('the capture draft', () => {
  it('round-trips an entry through the form without changing it', async () => {
    const entry = await captureBok({
      forms: { indefiniteSingular: 'bok', definiteSingular: 'boken' },
      gender: 'en',
      translation: 'book',
      exampleSentence: 'Jag läser en bok.',
      tags: ['en-words'],
    })

    expect(entryFromDraft(entry, draftFromEntry(entry))).toEqual(entry)
  })

  it('keeps the Forms of the other Paradigms while the Part of Speech changes', () => {
    const draft = {
      ...draftFromEntry({
        id: 'x',
        createdAt: '',
        updatedAt: '',
        lemma: 'bok',
        partOfSpeech: 'noun',
        translation: '',
        exampleSentence: '',
        tags: [],
        lookupOutcome: 'never-attempted',
        forms: { indefiniteSingular: 'bok' },
      }),
      partOfSpeech: 'verb' as const,
    }

    // The verb has none of the noun's Forms…
    expect(vocabularyEntryDraftOf(draft)).toMatchObject({ partOfSpeech: 'verb', forms: {} })
    // …but switching back finds them where they were left.
    expect(vocabularyEntryDraftOf({ ...draft, partOfSpeech: 'noun' })).toMatchObject({
      forms: { indefiniteSingular: 'bok' },
    })
  })

  it('drops a whitespace-only Form, which means "not filled in"', () => {
    const entry: VocabularyEntry = {
      id: 'x',
      createdAt: '',
      updatedAt: '',
      lemma: 'bok',
      partOfSpeech: 'noun',
      translation: '',
      exampleSentence: '',
      tags: [],
      lookupOutcome: 'never-attempted',
      forms: {},
    }
    const draft = draftFromEntry(entry)

    expect(paradigmIsUntouched(draft)).toBe(true)
    expect(
      vocabularyEntryDraftOf({
        ...draft,
        forms: { ...draft.forms, definiteSingular: '   ' },
      }),
    ).toMatchObject({ forms: {} })
  })
})
