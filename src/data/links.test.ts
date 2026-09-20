/**
 * Links and deletion (spec 3.6, ADR-0001).
 *
 * Deleting never cascades, and the two relationships lose a link differently on
 * purpose: a Grammar Note loses the Reference outright, a Journal Entry keeps the
 * Pin as a Tombstone. These tests exist so that neither behaviour can be
 * "tidied up" into the other without something going red.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { isResolvedPin, isTombstonePin } from '../domain/journalEntry.ts'
import type { JournalEntry } from '../domain/journalEntry.ts'
import { deleteDatabase } from './db.ts'
import { createGrammarNote, getGrammarNote } from './grammarNoteRepository.ts'
import { createJournalEntry, getJournalEntry } from './journalEntryRepository.ts'
import {
  addReference,
  backlinksForVocabularyEntry,
  deleteGrammarNote,
  deletePrompt,
  deletionImpactForGrammarNote,
  deletionImpactForVocabularyEntry,
  deleteVocabularyEntry,
  journalEntriesPinning,
  pinnedItems,
  pinToJournalEntry,
  referencedVocabularyEntries,
  removeReference,
  unpinFromJournalEntry,
} from './links.ts'
import {
  createCustomPrompt,
  listPrompts,
  seedBuiltInPrompts,
} from './promptRepository.ts'
import { createVocabularyEntry, getVocabularyEntry } from './vocabularyRepository.ts'

beforeEach(async () => {
  await deleteDatabase()
})

async function captureBok(translation = 'book') {
  const { entry } = await createVocabularyEntry({
    lemma: 'bok',
    partOfSpeech: 'noun',
    gender: 'en',
    translation,
    forms: {},
  })
  return entry
}

describe('References and Backlinks', () => {
  it('resolves in both directions', async () => {
    const bok = await captureBok()
    const hus = (
      await createVocabularyEntry({ lemma: 'hus', partOfSpeech: 'noun', forms: {} })
    ).entry
    const note = await createGrammarNote({ title: 'Ett-ord' })

    await addReference(note.id, bok.id)
    await addReference(note.id, hus.id)

    // Note to word.
    expect((await referencedVocabularyEntries(note.id)).map((entry) => entry.lemma)).toEqual([
      'bok',
      'hus',
    ])

    // Word to note: the Backlink, derived and carrying the title.
    expect(await backlinksForVocabularyEntry(bok.id)).toEqual([
      { grammarNoteId: note.id, title: 'Ett-ord' },
    ])
  })

  it('picking the same word twice References it once', async () => {
    const bok = await captureBok()
    const note = await createGrammarNote({ title: 'Ett-ord' })

    await addReference(note.id, bok.id)
    const again = await addReference(note.id, bok.id)

    expect(again.references).toHaveLength(1)
  })

  it('Unlinking removes the Reference and keeps both sides', async () => {
    const bok = await captureBok()
    const note = await createGrammarNote({ title: 'Ett-ord' })
    await addReference(note.id, bok.id)

    await removeReference(note.id, bok.id)

    expect(await backlinksForVocabularyEntry(bok.id)).toEqual([])
    expect(await getVocabularyEntry(bok.id)).toBeDefined()
    expect((await getGrammarNote(note.id))?.references).toEqual([])
  })
})

describe('Pins', () => {
  it('resolve in both directions and record the Lemma they were made with', async () => {
    const bok = await captureBok()
    const note = await createGrammarNote({ title: 'Ett-ord' })
    const entry = await createJournalEntry({ body: 'Idag läste jag en bok.' })

    await pinToJournalEntry(entry.id, 'vocabularyEntry', bok.id)
    await pinToJournalEntry(entry.id, 'grammarNote', note.id)

    const items = await pinnedItems(entry.id)
    expect(items.map((item) => item.pin.pinnedAs)).toEqual(['bok', 'Ett-ord'])
    expect(items.map((item) => item.target?.id)).toEqual([bok.id, note.id])

    // And from the word's side.
    expect((await journalEntriesPinning(bok.id)).map((found) => found.id)).toEqual([entry.id])
    expect((await journalEntriesPinning(note.id)).map((found) => found.id)).toEqual([entry.id])
  })

  it('belong to one Journal Entry and never carry over to the next', async () => {
    const bok = await captureBok()
    const first = await createJournalEntry({ body: 'Först.' })
    await pinToJournalEntry(first.id, 'vocabularyEntry', bok.id)

    const second = await createJournalEntry({ body: 'Sedan.' })

    expect(second.pins).toEqual([])
    expect((await journalEntriesPinning(bok.id)).map((entry) => entry.id)).toEqual([first.id])
  })

  it('Unpinning removes the Pin outright, which is not what deletion does', async () => {
    const bok = await captureBok()
    const entry = await createJournalEntry({ body: 'Text.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', bok.id)

    await unpinFromJournalEntry(entry.id, bok.id)

    expect((await getJournalEntry(entry.id))?.pins).toEqual([])
  })
})

describe('deleting a Vocabulary Entry', () => {
  it('reports what is about to lose its link before anything changes', async () => {
    const bok = await captureBok()
    const note = await createGrammarNote({ title: 'Ett-ord' })
    await addReference(note.id, bok.id)
    const entry = await createJournalEntry({ date: '2026-09-18', body: 'Jag läste en bok.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', bok.id)

    const impact = await deletionImpactForVocabularyEntry(bok.id)

    expect(impact.grammarNotes).toEqual([{ id: note.id, title: 'Ett-ord' }])
    expect(impact.journalEntries).toEqual([
      { id: entry.id, date: '2026-09-18', preview: 'Jag läste en bok.' },
    ])
    // Reporting changes nothing.
    expect(await getVocabularyEntry(bok.id)).toBeDefined()
    expect((await getGrammarNote(note.id))?.references).toHaveLength(1)
  })

  it('never destroys the Grammar Note that Referenced it, and removes only the Reference', async () => {
    const bok = await captureBok()
    const hus = (
      await createVocabularyEntry({ lemma: 'hus', partOfSpeech: 'noun', forms: {} })
    ).entry
    const note = await createGrammarNote({ title: 'Ett-ord', body: 'Regeln står kvar.' })
    await addReference(note.id, bok.id)
    await addReference(note.id, hus.id)

    const impact = await deleteVocabularyEntry(bok.id)

    const survivor = await getGrammarNote(note.id)
    expect(survivor?.body).toBe('Regeln står kvar.')
    expect(survivor?.references).toEqual([{ vocabularyEntryId: hus.id }])
    expect(impact.grammarNotes).toEqual([{ id: note.id, title: 'Ett-ord' }])
    expect(await getVocabularyEntry(bok.id)).toBeUndefined()
  })

  it('leaves the Journal Entry holding a Tombstone with the Lemma it was made with', async () => {
    const bok = await captureBok()
    const entry = await createJournalEntry({ body: 'Jag läste en bok.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', bok.id)

    await deleteVocabularyEntry(bok.id)

    const survivor = (await getJournalEntry(entry.id)) as JournalEntry
    expect(survivor.body).toBe('Jag läste en bok.')
    expect(survivor.pins).toHaveLength(1)
    const [pin] = survivor.pins
    expect(isTombstonePin(pin)).toBe(true)
    expect(pin.pinnedKind).toBe('vocabularyEntry')
    expect(pin.pinnedAs).toBe('bok')
    expect('targetId' in pin).toBe(false)
  })

  it('loses the link differently on each side, on purpose', async () => {
    const bok = await captureBok()
    const note = await createGrammarNote({ title: 'Ett-ord' })
    await addReference(note.id, bok.id)
    const entry = await createJournalEntry({ body: 'Text.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', bok.id)

    await deleteVocabularyEntry(bok.id)

    // The Grammar Note's Reference is gone; the Journal Entry's Pin is not.
    expect((await getGrammarNote(note.id))?.references).toHaveLength(0)
    expect((await getJournalEntry(entry.id))?.pins).toHaveLength(1)
  })

  it('tombstones the Pin in every Journal Entry that made one, and only that Pin', async () => {
    const bok = await captureBok()
    const hus = (
      await createVocabularyEntry({ lemma: 'hus', partOfSpeech: 'noun', forms: {} })
    ).entry
    const june = await createJournalEntry({ date: '2026-06-02', body: 'Juni.' })
    const july = await createJournalEntry({ date: '2026-07-02', body: 'Juli.' })
    for (const entry of [june, july]) {
      await pinToJournalEntry(entry.id, 'vocabularyEntry', bok.id)
      await pinToJournalEntry(entry.id, 'vocabularyEntry', hus.id)
    }

    const impact = await deleteVocabularyEntry(bok.id)

    expect(impact.journalEntries.map((entry) => entry.id).sort()).toEqual(
      [june.id, july.id].sort(),
    )
    for (const entry of [june, july]) {
      const pins = (await getJournalEntry(entry.id))?.pins ?? []
      // The entry still reports two practiced words, one of them now text only.
      expect(pins).toHaveLength(2)
      expect(pins.filter(isTombstonePin).map((pin) => pin.pinnedAs)).toEqual(['bok'])
      expect(pins.filter(isResolvedPin).map((pin) => pin.pinnedAs)).toEqual(['hus'])
    }
  })

  it('leaves a Tombstone that is no longer a link', async () => {
    const bok = await captureBok()
    const entry = await createJournalEntry({ body: 'Text.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', bok.id)

    await deleteVocabularyEntry(bok.id)

    expect(await journalEntriesPinning(bok.id)).toEqual([])
    const [item] = await pinnedItems(entry.id)
    expect(item.target).toBeNull()
    expect(item.pin.pinnedAs).toBe('bok')
  })

  it('does not revive a Tombstone when the same Lemma is captured again', async () => {
    const bok = await captureBok('book')
    const entry = await createJournalEntry({ body: 'Text.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', bok.id)
    await deleteVocabularyEntry(bok.id)

    const recaptured = await captureBok('beech')

    const pins = (await getJournalEntry(entry.id))?.pins ?? []
    expect(pins.every(isTombstonePin)).toBe(true)
    expect(await journalEntriesPinning(recaptured.id)).toEqual([])
    const [item] = await pinnedItems(entry.id)
    expect(item.target).toBeNull()
  })

  it('reports nothing for a word nothing pointed at', async () => {
    const bok = await captureBok()

    expect(await deleteVocabularyEntry(bok.id)).toEqual({
      grammarNotes: [],
      journalEntries: [],
    })
  })
})

describe('deleting a Grammar Note', () => {
  it('reports the Journal Entries that will keep a Tombstone', async () => {
    const note = await createGrammarNote({ title: 'Ett-ord' })
    const entry = await createJournalEntry({ date: '2026-09-18', body: 'Om ett-ord.' })
    await pinToJournalEntry(entry.id, 'grammarNote', note.id)

    expect(await deletionImpactForGrammarNote(note.id)).toEqual({
      grammarNotes: [],
      journalEntries: [{ id: entry.id, date: '2026-09-18', preview: 'Om ett-ord.' }],
    })
    expect(await getGrammarNote(note.id)).toBeDefined()
  })

  it('leaves the Journal Entry holding a Tombstone with the title', async () => {
    const note = await createGrammarNote({ title: 'Ett-ord' })
    const entry = await createJournalEntry({ body: 'Om ett-ord.' })
    await pinToJournalEntry(entry.id, 'grammarNote', note.id)

    await deleteGrammarNote(note.id)

    const survivor = (await getJournalEntry(entry.id)) as JournalEntry
    expect(survivor.body).toBe('Om ett-ord.')
    const [pin] = survivor.pins
    expect(isTombstonePin(pin)).toBe(true)
    expect(pin.pinnedKind).toBe('grammarNote')
    expect(pin.pinnedAs).toBe('Ett-ord')
    expect(await getGrammarNote(note.id)).toBeUndefined()
  })

  it('does not touch the words it Referenced', async () => {
    const bok = await captureBok()
    const note = await createGrammarNote({ title: 'Ett-ord' })
    await addReference(note.id, bok.id)

    await deleteGrammarNote(note.id)

    expect(await getVocabularyEntry(bok.id)).toEqual(bok)
    expect(await backlinksForVocabularyEntry(bok.id)).toEqual([])
  })
})

describe('deleting a Prompt', () => {
  it('leaves the Journal Entry it was Attached to, and its writing, intact', async () => {
    const prompt = await createCustomPrompt({ text: 'Vad gjorde du igår?', level: 'beginner' })
    const entry = await createJournalEntry({
      body: 'Igår gick jag till skogen.',
      attachedPromptId: prompt.id,
    })

    const impact = await deletePrompt(prompt.id)

    expect(impact.journalEntries.map((affected) => affected.id)).toEqual([entry.id])
    const survivor = (await getJournalEntry(entry.id)) as JournalEntry
    expect(survivor.body).toBe('Igår gick jag till skogen.')
    expect(survivor.attachedPromptId).toBeUndefined()
  })

  it('refuses to delete a Built-in Prompt, which is hidden rather than removed', async () => {
    await seedBuiltInPrompts()
    const [builtIn] = await listPrompts({ level: 'beginner' })

    await expect(deletePrompt(builtIn.id)).rejects.toThrow(/Built-in Prompt/)
    expect((await listPrompts({ level: 'beginner' })).map((prompt) => prompt.id)).toContain(
      builtIn.id,
    )
  })
})
