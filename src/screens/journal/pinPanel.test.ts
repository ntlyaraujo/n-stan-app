/**
 * What the side panel shows (#40–#42).
 *
 * Component tests are out of scope (spec section 7); the rules underneath them
 * are not, and two of these have to hold for years:
 *
 * - Pins belong to one Journal Entry, survive a reopen and never carry over.
 * - **A Tombstone Pin still renders.** The panel draws what the entry recorded,
 *   not what still exists, so a word deleted in September must not quietly
 *   remove itself from what June says you practiced (ADR-0001).
 *
 * The round trip runs against the real storage layer rather than a stub, since
 * the thing being pinned down is exactly the handover between `links.ts` and the
 * panel.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  createGrammarNote,
  createJournalEntry,
  createVocabularyEntry,
  deleteDatabase,
  deleteGrammarNote,
  deleteVocabularyEntry,
  getJournalEntry,
  listGrammarNotes,
  listVocabularyEntries,
  pinnedItems,
  pinToJournalEntry,
  saveVocabularyEntry,
  unpinFromJournalEntry,
  type PinnedItem,
} from '../../data/index.ts'
import type { GrammarNote, VocabularyEntry } from '../../domain/index.ts'
import { matchRows, pinChips, pinnedTargetIds, pinRows } from './pinPanel.ts'

beforeEach(async () => {
  await deleteDatabase()
})

async function capture(lemma: string, translation = ''): Promise<VocabularyEntry> {
  const { entry } = await createVocabularyEntry({
    lemma,
    partOfSpeech: 'verb',
    translation,
    forms: {},
  })
  return entry
}

function note(title: string): Promise<GrammarNote> {
  return createGrammarNote({ title })
}

describe('the Pins of one Journal Entry', () => {
  it('round-trips through the panel: pinned, reopened, unpinned', async () => {
    const skriva = await capture('skriva', 'to write')
    const ettOrd = await note('Ett-ord')
    const entry = await createJournalEntry({ body: 'Idag skrev jag.' })

    await pinToJournalEntry(entry.id, 'vocabularyEntry', skriva.id)
    await pinToJournalEntry(entry.id, 'grammarNote', ettOrd.id)

    // Reopening the entry is this read and nothing else.
    const rows = pinRows(await pinnedItems(entry.id))
    expect(rows.map((row) => row.label)).toEqual(['skriva', 'Ett-ord'])
    expect(rows.map((row) => row.to)).toEqual([
      `/vocabulary/${skriva.id}`,
      `/grammar/${ettOrd.id}`,
    ])
    expect(rows.map((row) => row.kindLabel)).toEqual(['Vocabulary', 'Grammar Note'])
    expect(rows.every((row) => !row.tombstone)).toBe(true)

    // What you did not end up using comes back off.
    await unpinFromJournalEntry(entry.id, skriva.id)
    expect(pinRows(await pinnedItems(entry.id)).map((row) => row.label)).toEqual(['Ett-ord'])
  })

  it('starts the next entry of the same evening with none', async () => {
    const skriva = await capture('skriva')
    const first = await createJournalEntry({ body: 'Först.' })
    await pinToJournalEntry(first.id, 'vocabularyEntry', skriva.id)

    const second = await createJournalEntry({ body: 'Sedan.' })

    expect(pinRows(await pinnedItems(second.id))).toEqual([])
    expect(pinRows(await pinnedItems(first.id))).toHaveLength(1)
  })

  it('follows a Lemma that is corrected, because the word is still there', async () => {
    const entry = await createJournalEntry({ body: 'Text.' })
    const skriv = await capture('skirva', 'to write')
    await pinToJournalEntry(entry.id, 'vocabularyEntry', skriv.id)

    await saveVocabularyEntry({ ...skriv, lemma: 'skriva' })

    const [row] = pinRows(await pinnedItems(entry.id))
    expect(row.label).toBe('skriva')
  })
})

describe('a Tombstone Pin', () => {
  it('still renders, as plain unlinked text, once the word is deleted', async () => {
    const skriva = await capture('skriva', 'to write')
    const entry = await createJournalEntry({ body: 'Idag skrev jag.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', skriva.id)

    await deleteVocabularyEntry(skriva.id)

    const rows = pinRows(await pinnedItems(entry.id))
    // One Pin before, one Pin after: the record of what you practiced is the
    // same in September as it was in June.
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row.label).toBe('skriva')
    expect(row.tombstone).toBe(true)
    expect(row.to).toBeNull()
    // Nothing to unpin: Unpinning is you saying you did not use the word, and
    // that is not what happened here.
    expect(row.targetId).toBeNull()
  })

  it('does the same for a deleted Grammar Note, keeping the title', async () => {
    const ettOrd = await note('Ett-ord')
    const entry = await createJournalEntry({ body: 'Text.' })
    await pinToJournalEntry(entry.id, 'grammarNote', ettOrd.id)

    await deleteGrammarNote(ettOrd.id)

    const [row] = pinRows(await pinnedItems(entry.id))
    expect(row.label).toBe('Ett-ord')
    expect(row.kindLabel).toBe('Grammar Note')
    expect(row.to).toBeNull()
  })

  it('survives a resolved Pin whose target failed to load', () => {
    // Not something storage should ever hand back — and the panel must not drop
    // a Pin or throw if it ever does.
    const stranded: PinnedItem = {
      pin: { status: 'resolved', pinnedKind: 'vocabularyEntry', pinnedAs: 'skriva', targetId: 'gone' },
      target: null,
    }

    const [row] = pinRows([stranded])
    expect(row.label).toBe('skriva')
    expect(row.to).toBeNull()
    expect(row.tombstone).toBe(true)
  })

  it('is on the bar beside the writing too, where there is no target to read', async () => {
    const skriva = await capture('skriva')
    const ettOrd = await note('Ett-ord')
    const entry = await createJournalEntry({ body: 'Text.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', skriva.id)
    await pinToJournalEntry(entry.id, 'grammarNote', ettOrd.id)
    await deleteVocabularyEntry(skriva.id)

    const stored = await getJournalEntry(entry.id)
    const chips = pinChips(stored?.pins ?? [])

    expect(chips.map((chip) => chip.label)).toEqual(['skriva', 'Ett-ord'])
    expect(chips.map((chip) => chip.tombstone)).toEqual([true, false])
  })
})

describe('searching Vocabulary and Grammar Notes together', () => {
  it('offers both kinds from one term, and says which are already Pinned', async () => {
    const skriva = await capture('skriva', 'to write')
    await capture('läsa', 'to read')
    await note('Skrivregler')
    await note('Ordföljd')
    const entry = await createJournalEntry({ body: 'Text.' })
    await pinToJournalEntry(entry.id, 'vocabularyEntry', skriva.id)

    const items = await pinnedItems(entry.id)
    const { rows, hidden } = matchRows(
      await listVocabularyEntries({ search: 'skriv' }),
      await listGrammarNotes({ search: 'skriv' }),
      pinnedTargetIds(items),
    )

    expect(rows.map((row) => row.label)).toEqual(['skriva', 'Skrivregler'])
    expect(rows.map((row) => row.kind)).toEqual(['vocabularyEntry', 'grammarNote'])
    expect(rows.map((row) => row.pinned)).toEqual([true, false])
    expect(hidden).toBe(0)
    // The search is the storage layer's, so an unrelated word stays out of it.
    expect(rows.some((row) => row.label === 'läsa')).toBe(false)
  })

  it('caps each kind and counts what it left out', async () => {
    const vocabulary = await Promise.all(['a', 'b', 'c'].map((lemma) => capture(lemma)))
    const notes = await Promise.all(['x', 'y'].map((title) => note(title)))

    const { rows, hidden } = matchRows(vocabulary, notes, new Set(), 1)

    expect(rows.map((row) => row.label)).toEqual(['a', 'x'])
    expect(hidden).toBe(3)
  })

  it('names an untitled Grammar Note rather than offering a blank row', async () => {
    const untitled = await note('   ')

    const { rows } = matchRows([], [untitled], new Set())

    expect(rows[0].label).toBe('Untitled Grammar Note')
  })
})
