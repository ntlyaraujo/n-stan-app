/**
 * Storage: schema, round-trips and the queries the lists offer.
 *
 * This is where a silent bug would quietly lose writing (spec 7), so these tests
 * check behaviour the spec and the glossary describe — what a round-trip returns,
 * what a filter matches — rather than the shape of the implementation.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { isComplete } from '../domain/vocabulary.ts'
import type { GrammarNote } from '../domain/grammarNote.ts'
import type { JournalEntry } from '../domain/journalEntry.ts'
import { builtInPrompts } from './builtInPrompts.ts'
import {
  closeDatabase,
  deleteDatabase,
  openDatabase,
  SCHEMA_VERSION,
  STORES,
} from './db.ts'
import { readDictionaryCache, writeDictionaryCache } from './dictionaryCache.ts'
import {
  createGrammarNote,
  getGrammarNote,
  listGrammarNotes,
  saveGrammarNote,
} from './grammarNoteRepository.ts'
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  journalEntryPreview,
  listJournalEntries,
  listJournalEntriesByDate,
  today,
} from './journalEntryRepository.ts'
import {
  createCustomPrompt,
  createCustomPromptFromBuiltIn,
  getPrompt,
  listPrompts,
  seedBuiltInPrompts,
  setBuiltInPromptHidden,
} from './promptRepository.ts'
import { listTags } from './tagNamespace.ts'
import {
  createVocabularyEntry,
  duplicateLemmaWarning,
  findVocabularyEntriesByLemma,
  getVocabularyEntry,
  listVocabularyEntries,
  saveVocabularyEntry,
} from './vocabularyRepository.ts'

beforeEach(async () => {
  await deleteDatabase()
})

const bokForms = {
  indefiniteSingular: 'bok',
  definiteSingular: 'boken',
  indefinitePlural: 'böcker',
  definitePlural: 'böckerna',
} as const

describe('the schema', () => {
  it('opens at the current version with every store and the indexes the lists need', async () => {
    const db = await openDatabase()

    expect(db.version).toBe(SCHEMA_VERSION)
    expect([...db.objectStoreNames].sort()).toEqual(
      [
        STORES.dictionaryCache,
        STORES.grammarNotes,
        STORES.journalEntries,
        STORES.prompts,
        STORES.vocabularyEntries,
      ].sort(),
    )

    const transaction = db.transaction(
      [STORES.vocabularyEntries, STORES.journalEntries, STORES.prompts],
      'readonly',
    )
    expect([...transaction.objectStore(STORES.vocabularyEntries).indexNames]).toContain(
      'by-part-of-speech',
    )
    expect([...transaction.objectStore(STORES.vocabularyEntries).indexNames]).toContain(
      'by-tag-key',
    )
    expect([...transaction.objectStore(STORES.journalEntries).indexNames]).toContain('by-date')
    expect([...transaction.objectStore(STORES.prompts).indexNames]).toContain('by-level')
  })

  it('has no stored completeness to drift out of date', async () => {
    const db = await openDatabase()
    const indexes = [
      ...db
        .transaction(STORES.vocabularyEntries, 'readonly')
        .objectStore(STORES.vocabularyEntries).indexNames,
    ]

    expect(indexes.join(' ')).not.toMatch(/complete/i)
  })

  it('keeps what was written when the database is closed and opened again', async () => {
    const { entry } = await createVocabularyEntry({ lemma: 'bok', partOfSpeech: 'noun', forms: {} })
    await closeDatabase()

    expect(await getVocabularyEntry(entry.id)).toEqual(entry)
  })
})

describe('Vocabulary Entry storage', () => {
  it('round-trips exactly what was written', async () => {
    const { entry } = await createVocabularyEntry({
      lemma: 'bok',
      partOfSpeech: 'noun',
      gender: 'en',
      translation: 'book',
      exampleSentence: 'Jag läser en bok varje kväll.',
      tags: ['Substantiv'],
      forms: bokForms,
    })

    expect(await getVocabularyEntry(entry.id)).toEqual(entry)
  })

  it('gives every entry an id and timestamps', async () => {
    const { entry } = await createVocabularyEntry({ lemma: 'hus', partOfSpeech: 'noun', forms: {} })

    expect(entry.id).not.toBe('')
    expect(entry.createdAt).toBe(entry.updatedAt)
    expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false)
  })

  it('defaults an entry captured with nothing but a Lemma and a Part of Speech', async () => {
    const { entry } = await createVocabularyEntry({
      lemma: 'det spelar ingen roll',
      partOfSpeech: 'phrase',
    })

    expect(entry.translation).toBe('')
    expect(entry.tags).toEqual([])
    expect(entry.lookupOutcome).toBe('never-attempted')
  })

  it('updates an entry in place and stamps updatedAt', async () => {
    const { entry } = await createVocabularyEntry({ lemma: 'bok', partOfSpeech: 'noun', forms: {} })
    const saved = await saveVocabularyEntry({
      ...entry,
      partOfSpeech: 'noun',
      translation: 'book',
      forms: bokForms,
    })

    expect(await getVocabularyEntry(entry.id)).toEqual(saved)
    expect(saved.createdAt).toBe(entry.createdAt)
    expect(saved.updatedAt >= entry.updatedAt).toBe(true)
  })
})

describe('the duplicate Lemma warning', () => {
  it('warns and still writes, because homonyms are real', async () => {
    const first = await createVocabularyEntry({
      lemma: 'bok',
      partOfSpeech: 'noun',
      translation: 'book',
      forms: {},
    })
    const second = await createVocabularyEntry({
      lemma: 'bok',
      partOfSpeech: 'noun',
      translation: 'beech',
      forms: {},
    })

    expect(first.duplicateWarning).toBeNull()
    expect(second.duplicateWarning?.existing.map((entry) => entry.id)).toEqual([
      first.entry.id,
    ])

    const stored = await findVocabularyEntriesByLemma('bok')
    expect(stored.map((entry) => entry.translation).sort()).toEqual(['beech', 'book'])
    expect(await getVocabularyEntry(second.entry.id)).toEqual(second.entry)
  })

  it('matches a Lemma without regard to case', async () => {
    await createVocabularyEntry({ lemma: 'Bok', partOfSpeech: 'noun', forms: {} })

    expect((await duplicateLemmaWarning('bok'))?.existing).toHaveLength(1)
    expect(await duplicateLemmaWarning('björk')).toBeNull()
  })

  it('does not warn an entry about itself when its own Lemma is checked', async () => {
    const { entry } = await createVocabularyEntry({
      lemma: 'bok',
      partOfSpeech: 'noun',
      forms: {},
    })

    expect(await duplicateLemmaWarning('bok', { ignoreId: entry.id })).toBeNull()
  })
})

describe('the vocabulary list filters', () => {
  beforeEach(async () => {
    await createVocabularyEntry({
      lemma: 'bok',
      partOfSpeech: 'noun',
      tags: ['Substantiv', 'Läsning'],
      forms: bokForms,
    })
    await createVocabularyEntry({
      lemma: 'tala',
      partOfSpeech: 'verb',
      tags: ['verb tenses'],
      forms: { infinitive: 'tala', present: 'talar', preterite: 'talade' },
    })
    await createVocabularyEntry({
      lemma: 'ofta',
      partOfSpeech: 'adverb',
      tags: ['Verb tenses'],
    })
  })

  it('filters by Part of Speech', async () => {
    const nouns = await listVocabularyEntries({ partOfSpeech: 'noun' })

    expect(nouns.map((entry) => entry.lemma)).toEqual(['bok'])
  })

  it('filters by Tag without regard to case', async () => {
    const matches = await listVocabularyEntries({ tag: 'VERB TENSES' })

    expect(matches.map((entry) => entry.lemma).sort()).toEqual(['ofta', 'tala'])
  })

  it('filters by completeness, derived from the Paradigm rather than stored', async () => {
    const complete = await listVocabularyEntries({ completeness: 'complete' })
    const incomplete = await listVocabularyEntries({ completeness: 'incomplete' })

    // *ofta* is an adverb: an empty Paradigm is always Complete.
    expect(complete.map((entry) => entry.lemma).sort()).toEqual(['bok', 'ofta'])
    expect(incomplete.map((entry) => entry.lemma)).toEqual(['tala'])
  })

  it('moves an entry between the completeness filters as its Forms are filled in', async () => {
    const [tala] = await listVocabularyEntries({ partOfSpeech: 'verb' })
    expect(isComplete(tala)).toBe(false)

    await saveVocabularyEntry({
      ...tala,
      partOfSpeech: 'verb',
      forms: { infinitive: 'tala', present: 'talar', preterite: 'talade', supine: 'talat' },
    })

    const complete = await listVocabularyEntries({ completeness: 'complete' })
    expect(complete.map((entry) => entry.lemma).sort()).toEqual(['bok', 'ofta', 'tala'])
  })

  it('combines a Tag filter with a Part of Speech filter', async () => {
    const matches = await listVocabularyEntries({ tag: 'verb tenses', partOfSpeech: 'verb' })

    expect(matches.map((entry) => entry.lemma)).toEqual(['tala'])
  })
})

describe('Grammar Note storage', () => {
  it('round-trips exactly what was written', async () => {
    const note = await createGrammarNote({
      title: 'Ett-ord',
      body: '| ord | form |\n| --- | --- |',
      tags: ['Substantiv'],
    })

    expect(await getGrammarNote(note.id)).toEqual(note)
  })

  it('filters by Tag without regard to case', async () => {
    await createGrammarNote({ title: 'Ett-ord', tags: ['Substantiv'] })
    await createGrammarNote({ title: 'Preteritum', tags: ['Verb tenses'] })

    const matches = await listGrammarNotes({ tag: 'substantiv' })
    expect(matches.map((note) => note.title)).toEqual(['Ett-ord'])
  })

  it('keeps a Tag re-spelled on save searchable under the new spelling', async () => {
    const note = await createGrammarNote({ title: 'Preteritum', tags: ['verb'] })
    const saved: GrammarNote = { ...note, tags: ['Verbtempus'] }
    await saveGrammarNote(saved)

    expect(await listGrammarNotes({ tag: 'verb' })).toEqual([])
    expect((await listGrammarNotes({ tag: 'verbtempus' })).map((found) => found.id)).toEqual([
      note.id,
    ])
  })
})

describe('Journal Entry storage', () => {
  it('round-trips exactly what was written', async () => {
    const entry = await createJournalEntry({
      date: '2026-09-18',
      body: 'Idag läste jag en bok.\nDen var bra.',
      tags: ['Läsning'],
    })

    expect(await getJournalEntry(entry.id)).toEqual(entry)
  })

  it('defaults the Date to today and keeps createdAt separate from it', async () => {
    const entry = await createJournalEntry({ body: 'Hej.' })

    expect(entry.date).toBe(today())
    expect(entry.createdAt).toContain('T')
  })

  it('keeps several entries on the same Date', async () => {
    const morning = await createJournalEntry({ date: '2026-09-18', body: 'Morgon.' })
    const evening = await createJournalEntry({ date: '2026-09-18', body: 'Kväll.' })

    const sameDay = await listJournalEntries({ date: '2026-09-18' })
    expect(sameDay.map((entry) => entry.id).sort()).toEqual([morning.id, evening.id].sort())
    expect(await getJournalEntry(morning.id)).toEqual(morning)
  })

  it('groups the list by Date, newest first', async () => {
    await createJournalEntry({ date: '2026-09-17', body: 'Onsdag.' })
    await createJournalEntry({ date: '2026-09-18', body: 'Torsdag morgon.' })
    await createJournalEntry({ date: '2026-09-18', body: 'Torsdag kväll.' })

    const groups = await listJournalEntriesByDate()

    expect(groups.map((group) => group.date)).toEqual(['2026-09-18', '2026-09-17'])
    expect(groups[0].entries).toHaveLength(2)
    expect(groups[1].entries).toHaveLength(1)
  })

  it('previews an untitled entry by its first non-blank line', async () => {
    const entry = await createJournalEntry({ body: '\n  Idag regnar det.\nSedan blev det bra.' })

    expect(journalEntryPreview(entry)).toBe('Idag regnar det.')
  })

  it('filters by Tag without regard to case and by Date range', async () => {
    await createJournalEntry({ date: '2026-09-10', body: 'A', tags: ['Resa'] })
    await createJournalEntry({ date: '2026-09-20', body: 'B', tags: ['resa'] })
    await createJournalEntry({ date: '2026-09-25', body: 'C', tags: ['Mat'] })

    expect(await listJournalEntries({ tag: 'RESA' })).toHaveLength(2)
    expect(
      (await listJournalEntries({ from: '2026-09-15', to: '2026-09-22' })).map(
        (entry) => entry.body,
      ),
    ).toEqual(['B'])
  })

  it('deletes an entry without touching anything else', async () => {
    const kept = await createJournalEntry({ body: 'Kvar.' })
    const removed = await createJournalEntry({ body: 'Borta.' })

    await deleteJournalEntry(removed.id)

    expect(await getJournalEntry(removed.id)).toBeUndefined()
    expect(await getJournalEntry(kept.id)).toEqual(kept)
  })

  it('round-trips an entry whose Pins include a Tombstone', async () => {
    const entry = await createJournalEntry({
      body: 'Text.',
      pins: [
        { status: 'resolved', pinnedKind: 'vocabularyEntry', pinnedAs: 'bok', targetId: 'abc' },
        { status: 'tombstone', pinnedKind: 'grammarNote', pinnedAs: 'Ett-ord' },
      ],
    })

    const stored = (await getJournalEntry(entry.id)) as JournalEntry
    expect(stored.pins).toEqual(entry.pins)
  })
})

describe('Prompt storage', () => {
  it('seeds the shipped Built-in Prompt set', async () => {
    await seedBuiltInPrompts()

    const prompts = await listPrompts()
    expect(prompts).toHaveLength(builtInPrompts.length)
    expect(prompts.every((prompt) => prompt.origin === 'built-in')).toBe(true)
  })

  it('filters by level', async () => {
    await seedBuiltInPrompts()

    const beginner = await listPrompts({ level: 'beginner' })
    expect(beginner.length).toBeGreaterThan(0)
    expect(beginner.every((prompt) => prompt.level === 'beginner')).toBe(true)
  })

  it('keeps a hidden Built-in Prompt out of the picker without deleting it', async () => {
    await seedBuiltInPrompts()
    const [first] = await listPrompts({ level: 'beginner' })

    await setBuiltInPromptHidden(first.id, true)

    expect((await listPrompts()).map((prompt) => prompt.id)).not.toContain(first.id)
    expect((await listPrompts({ includeHidden: true })).map((prompt) => prompt.id)).toContain(
      first.id,
    )
    expect(await getPrompt(first.id)).toBeDefined()
  })

  it('re-seeding a revised set keeps what you hid', async () => {
    await seedBuiltInPrompts()
    const [first] = await listPrompts({ level: 'beginner' })
    await setBuiltInPromptHidden(first.id, true)

    await seedBuiltInPrompts([
      { id: first.id, text: 'Reviderad text.', level: 'beginner', origin: 'built-in' },
    ])

    const reseeded = await getPrompt(first.id)
    expect(reseeded?.text).toBe('Reviderad text.')
    expect(reseeded?.origin === 'built-in' && reseeded.hidden).toBe(true)
  })

  it('edits a Built-in Prompt into a Custom Prompt, leaving the original alone', async () => {
    await seedBuiltInPrompts()
    const [original] = await listPrompts({ level: 'advanced' })

    const custom = await createCustomPromptFromBuiltIn(original.id, { text: 'Min egen version.' })

    expect(custom.origin).toBe('custom')
    expect(custom.derivedFrom).toBe(original.id)
    expect((await getPrompt(original.id))?.text).toBe(original.text)
  })

  it('round-trips a Custom Prompt', async () => {
    const prompt = await createCustomPrompt({ text: 'Vad åt du till frukost?', level: 'beginner' })

    expect(await getPrompt(prompt.id)).toEqual(prompt)
    expect((await listPrompts({ origin: 'custom' })).map((found) => found.id)).toEqual([
      prompt.id,
    ])
  })
})

describe('the one Tag namespace', () => {
  it('keeps a Tag in the spelling first used, whichever kind of record it reaches next', async () => {
    const { entry } = await createVocabularyEntry({
      lemma: 'tala',
      partOfSpeech: 'verb',
      tags: ['Verb tenses'],
      forms: {},
    })
    expect(entry.tags).toEqual(['Verb tenses'])

    const note = await createGrammarNote({ title: 'Preteritum', tags: ['verb tenses'] })
    const journalEntry = await createJournalEntry({ body: 'Jag talade.', tags: ['VERB TENSES'] })

    expect(note.tags).toEqual(['Verb tenses'])
    expect(journalEntry.tags).toEqual(['Verb tenses'])
    expect((await getGrammarNote(note.id))?.tags).toEqual(['Verb tenses'])
    expect((await getJournalEntry(journalEntry.id))?.tags).toEqual(['Verb tenses'])
  })

  it('keeps the spelling first used when a Tag is added to an existing record', async () => {
    await createGrammarNote({ title: 'Substantiv', tags: ['En-ord'] })
    const { entry } = await createVocabularyEntry({ lemma: 'bok', partOfSpeech: 'noun', forms: {} })

    const saved = await saveVocabularyEntry({ ...entry, tags: ['en-ord'] })

    expect(saved.tags).toEqual(['En-ord'])
    expect((await getVocabularyEntry(entry.id))?.tags).toEqual(['En-ord'])
  })

  it('lets a record re-spell a Tag nothing else is using', async () => {
    const note = await createGrammarNote({ title: 'Preteritum', tags: ['verb tenses'] })

    const saved = await saveGrammarNote({ ...note, tags: ['Verb Tenses'] })

    expect(saved.tags).toEqual(['Verb Tenses'])
    expect((await listGrammarNotes({ tag: 'VERB TENSES' })).map((found) => found.id)).toEqual([
      note.id,
    ])
  })

  it('de-duplicates Tags written in two spellings at once', async () => {
    const journalEntry = await createJournalEntry({ tags: ['Resa', 'resa', ' resa '] })

    expect(journalEntry.tags).toEqual(['Resa'])
  })

  it('finds a Tag anywhere in the namespace, whichever kind of record introduced it', async () => {
    await createVocabularyEntry({ lemma: 'bok', partOfSpeech: 'noun', tags: ['Läsning'], forms: {} })
    await createGrammarNote({ title: 'Preteritum', tags: ['Verb tenses'] })
    await createJournalEntry({ tags: ['resa', 'läsning'] })

    expect(await listTags()).toEqual(['Läsning', 'resa', 'Verb tenses'])
  })
})

describe('the missing-Gender review list', () => {
  it('offers back the nouns with no Gender, without touching what Complete means', async () => {
    const { entry: bok } = await createVocabularyEntry({
      lemma: 'bok',
      partOfSpeech: 'noun',
      forms: bokForms,
    })
    await createVocabularyEntry({
      lemma: 'hus',
      partOfSpeech: 'noun',
      gender: 'ett',
      forms: {},
    })
    await createVocabularyEntry({ lemma: 'ofta', partOfSpeech: 'adverb' })

    // The two filters are orthogonal: *bok* is Complete by the glossary's
    // four/four/three and still missing its Gender, while *hus* has its Gender
    // and not its Forms.
    expect(isComplete(bok)).toBe(true)
    expect(
      (await listVocabularyEntries({ completeness: 'incomplete' })).map((e) => e.lemma),
    ).toEqual(['hus'])
    expect((await listVocabularyEntries({ missingGender: true })).map((e) => e.lemma)).toEqual([
      'bok',
    ])

    await saveVocabularyEntry({ ...bok, partOfSpeech: 'noun', gender: 'en', forms: bokForms })
    expect(await listVocabularyEntries({ missingGender: true })).toEqual([])
  })
})

describe('the Dictionary cache', () => {
  it('round-trips a cached Lookup, keyed by Lemma without regard to case', async () => {
    await writeDictionaryCache('Bok', { gender: 'en' })

    const cached = await readDictionaryCache('bok')
    expect(cached?.payload).toEqual({ gender: 'en' })
    expect(cached?.lemma).toBe('Bok')
    expect(await readDictionaryCache('björk')).toBeUndefined()
  })
})
