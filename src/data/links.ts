/**
 * Links, in both directions, and the deletes that Unlink without cascading
 * (spec 3.6, ADR-0001).
 *
 * Two relationships exist:
 *
 * - A **Reference** from a Grammar Note to a Vocabulary Entry, created by
 *   picking the word on the note. Seen from the word's side it is a **Backlink**,
 *   which is derived here and never stored.
 * - A **Pin** from a Journal Entry to a Vocabulary Entry or Grammar Note, made
 *   while writing, which doubles as the record that you practiced it.
 *
 * **Deleting never cascades, and the two relationships lose it differently.**
 * A Grammar Note loses the Reference outright. A Journal Entry keeps the Pin as
 * a Tombstone holding the Lemma or title it was made with, as plain text, so a
 * June entry does not quietly report two practiced words in September when it
 * recorded three. These behaviours look inconsistent and are deliberate; do not
 * unify them.
 *
 * Every delete first *reports* what is about to lose its link, as a
 * {@link DeletionImpact}, so the screen can say so before and after. The same
 * report is available on its own through `deletionImpactFor…`, for the
 * confirmation step.
 *
 * Re-capturing the same Lemma does not revive a Tombstone. A Lemma does not
 * identify a Vocabulary Entry, so a re-capture is simply a new word, and the old
 * Journal Entry keeps its text.
 */

import type { Backlink, GrammarNote, Reference } from '../domain/grammarNote.ts'
import type { CalendarDate } from '../domain/entity.ts'
import type { JournalEntry, Pin, PinnedKind } from '../domain/journalEntry.ts'
import type { Prompt } from '../domain/prompt.ts'
import { isBuiltInPrompt } from '../domain/prompt.ts'
import type { VocabularyEntry } from '../domain/vocabulary.ts'
import {
  encodeGrammarNote,
  encodeJournalEntry,
  getAllRecords,
  getRecord,
  INDEXES,
  now,
  request,
  STORES,
  withStores,
} from './db.ts'
import { journalEntryPreview } from './journalEntryRepository.ts'

/** A Grammar Note that is about to lose, or has just lost, a Reference. */
export interface AffectedGrammarNote {
  readonly id: string
  readonly title: string
}

/** A Journal Entry that is about to keep, or has just kept, a Tombstone. */
export interface AffectedJournalEntry {
  readonly id: string
  readonly date: CalendarDate
  /** Its first line, which is how an untitled entry is recognised. */
  readonly preview: string
}

/**
 * What loses a link when something is deleted. Nothing listed here is itself
 * destroyed.
 */
export interface DeletionImpact {
  /** These lose the Reference outright. */
  readonly grammarNotes: readonly AffectedGrammarNote[]
  /** These keep the Pin as a Tombstone — or, for a Prompt, lose the attachment. */
  readonly journalEntries: readonly AffectedJournalEntry[]
}

const NOTHING_AFFECTED: DeletionImpact = { grammarNotes: [], journalEntries: [] }

function affectedNote(note: GrammarNote): AffectedGrammarNote {
  return { id: note.id, title: note.title }
}

function affectedEntry(entry: JournalEntry): AffectedJournalEntry {
  return { id: entry.id, date: entry.date, preview: journalEntryPreview(entry) }
}

// --- Reference and Backlink ----------------------------------------------

/** The Vocabulary Entries a Grammar Note References, in the order they were picked. */
export function referencedVocabularyEntries(
  grammarNoteId: string,
): Promise<VocabularyEntry[]> {
  return withStores(
    [STORES.grammarNotes, STORES.vocabularyEntries],
    'readonly',
    async (transaction) => {
      const note = await getRecord<GrammarNote>(
        transaction.objectStore(STORES.grammarNotes),
        grammarNoteId,
      )
      if (note === undefined) return []

      const vocabulary = transaction.objectStore(STORES.vocabularyEntries)
      const entries: VocabularyEntry[] = []
      for (const reference of note.references) {
        const entry = await getRecord<VocabularyEntry>(vocabulary, reference.vocabularyEntryId)
        if (entry !== undefined) entries.push(entry)
      }
      return entries
    },
  )
}

/**
 * The same References seen from the word's side. Derived on read, never stored,
 * which is why a Backlink carries the note's title rather than a pointer.
 */
export async function backlinksForVocabularyEntry(
  vocabularyEntryId: string,
): Promise<Backlink[]> {
  const notes = await withStores([STORES.grammarNotes], 'readonly', (transaction) =>
    getAllRecords<GrammarNote>(
      transaction.objectStore(STORES.grammarNotes).index(INDEXES.byReference),
      vocabularyEntryId,
    ),
  )
  return notes
    .sort((a, b) => a.title.localeCompare(b.title, 'sv'))
    .map((note) => ({ grammarNoteId: note.id, title: note.title }))
}

/** Pick a word on a note. Picking the same word twice changes nothing. */
export function addReference(
  grammarNoteId: string,
  vocabularyEntryId: string,
): Promise<GrammarNote> {
  return withStores(
    [STORES.grammarNotes, STORES.vocabularyEntries],
    'readwrite',
    async (transaction) => {
      const notes = transaction.objectStore(STORES.grammarNotes)
      const note = await getRecord<GrammarNote>(notes, grammarNoteId)
      if (note === undefined) throw new Error(`No Grammar Note with id ${grammarNoteId}`)

      const entry = await getRecord<VocabularyEntry>(
        transaction.objectStore(STORES.vocabularyEntries),
        vocabularyEntryId,
      )
      if (entry === undefined) {
        throw new Error(`No Vocabulary Entry with id ${vocabularyEntryId}`)
      }

      if (note.references.some((reference) => reference.vocabularyEntryId === entry.id)) {
        return note
      }

      const reference: Reference = { vocabularyEntryId: entry.id }
      const saved: GrammarNote = {
        ...note,
        references: [...note.references, reference],
        updatedAt: now(),
      }
      await request(notes.put(encodeGrammarNote(saved)))
      return saved
    },
  )
}

/** Unlink: the Reference goes, both the note and the word survive. */
export function removeReference(
  grammarNoteId: string,
  vocabularyEntryId: string,
): Promise<GrammarNote> {
  return withStores([STORES.grammarNotes], 'readwrite', async (transaction) => {
    const notes = transaction.objectStore(STORES.grammarNotes)
    const note = await getRecord<GrammarNote>(notes, grammarNoteId)
    if (note === undefined) throw new Error(`No Grammar Note with id ${grammarNoteId}`)

    const saved: GrammarNote = {
      ...note,
      references: note.references.filter(
        (reference) => reference.vocabularyEntryId !== vocabularyEntryId,
      ),
      updatedAt: now(),
    }
    await request(notes.put(encodeGrammarNote(saved)))
    return saved
  })
}

// --- Pins -----------------------------------------------------------------

/**
 * A Pin beside the thing it points at. `target` is null for a Tombstone: the
 * Pin still reads, through `pin.pinnedAs`, but no longer links anywhere.
 */
export interface PinnedItem {
  readonly pin: Pin
  readonly target: VocabularyEntry | GrammarNote | null
}

/** A Journal Entry's Pins, in the order they were made, Tombstones included. */
export function pinnedItems(journalEntryId: string): Promise<PinnedItem[]> {
  return withStores(
    [STORES.journalEntries, STORES.vocabularyEntries, STORES.grammarNotes],
    'readonly',
    async (transaction) => {
      const entry = await getRecord<JournalEntry>(
        transaction.objectStore(STORES.journalEntries),
        journalEntryId,
      )
      if (entry === undefined) return []

      const vocabulary = transaction.objectStore(STORES.vocabularyEntries)
      const notes = transaction.objectStore(STORES.grammarNotes)

      const items: PinnedItem[] = []
      for (const pin of entry.pins) {
        if (pin.status === 'tombstone') {
          items.push({ pin, target: null })
          continue
        }
        const target =
          pin.pinnedKind === 'vocabularyEntry'
            ? await getRecord<VocabularyEntry>(vocabulary, pin.targetId)
            : await getRecord<GrammarNote>(notes, pin.targetId)
        items.push({ pin, target: target ?? null })
      }
      return items
    },
  )
}

/**
 * The other direction: the Journal Entries whose Pins point at this word or
 * note. Tombstones are not links and never appear here.
 */
export function journalEntriesPinning(targetId: string): Promise<JournalEntry[]> {
  return withStores([STORES.journalEntries], 'readonly', async (transaction) => {
    const entries = await getAllRecords<JournalEntry>(
      transaction.objectStore(STORES.journalEntries).index(INDEXES.byPinTarget),
      targetId,
    )
    return entries.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
  })
}

/**
 * Pin a word or note to a Journal Entry, capturing the Lemma or title it is
 * being pinned as — which is what the Pin keeps if the target is ever deleted.
 * Pinning the same thing twice changes nothing.
 */
export function pinToJournalEntry(
  journalEntryId: string,
  pinnedKind: PinnedKind,
  targetId: string,
): Promise<JournalEntry> {
  return withStores(
    [STORES.journalEntries, STORES.vocabularyEntries, STORES.grammarNotes],
    'readwrite',
    async (transaction) => {
      const journal = transaction.objectStore(STORES.journalEntries)
      const entry = await getRecord<JournalEntry>(journal, journalEntryId)
      if (entry === undefined) throw new Error(`No Journal Entry with id ${journalEntryId}`)

      let pinnedAs: string
      if (pinnedKind === 'vocabularyEntry') {
        const target = await getRecord<VocabularyEntry>(
          transaction.objectStore(STORES.vocabularyEntries),
          targetId,
        )
        if (target === undefined) throw new Error(`No Vocabulary Entry with id ${targetId}`)
        pinnedAs = target.lemma
      } else {
        const target = await getRecord<GrammarNote>(
          transaction.objectStore(STORES.grammarNotes),
          targetId,
        )
        if (target === undefined) throw new Error(`No Grammar Note with id ${targetId}`)
        pinnedAs = target.title
      }

      if (
        entry.pins.some((pin) => pin.status === 'resolved' && pin.targetId === targetId)
      ) {
        return entry
      }

      const saved: JournalEntry = {
        ...entry,
        pins: [...entry.pins, { status: 'resolved', pinnedKind, pinnedAs, targetId }],
        updatedAt: now(),
      }
      await request(journal.put(encodeJournalEntry(saved)))
      return saved
    },
  )
}

/**
 * Unpin: the Pin goes and both sides survive. This is you saying you did not use
 * the word after all, which is different from the word being deleted — that
 * leaves a Tombstone instead.
 */
export function unpinFromJournalEntry(
  journalEntryId: string,
  targetId: string,
): Promise<JournalEntry> {
  return withStores([STORES.journalEntries], 'readwrite', async (transaction) => {
    const journal = transaction.objectStore(STORES.journalEntries)
    const entry = await getRecord<JournalEntry>(journal, journalEntryId)
    if (entry === undefined) throw new Error(`No Journal Entry with id ${journalEntryId}`)

    const saved: JournalEntry = {
      ...entry,
      pins: entry.pins.filter(
        (pin) => !(pin.status === 'resolved' && pin.targetId === targetId),
      ),
      updatedAt: now(),
    }
    await request(journal.put(encodeJournalEntry(saved)))
    return saved
  })
}

// --- deleting, without cascading -----------------------------------------

/**
 * What deleting this Vocabulary Entry would cost: the Grammar Notes that lose a
 * Reference and the Journal Entries left holding a Tombstone. Read-only — show
 * it, then call {@link deleteVocabularyEntry}.
 */
export function deletionImpactForVocabularyEntry(
  vocabularyEntryId: string,
): Promise<DeletionImpact> {
  return withStores(
    [STORES.grammarNotes, STORES.journalEntries],
    'readonly',
    async (transaction) => readImpactOfRemovingTarget(transaction, vocabularyEntryId),
  )
}

/**
 * What deleting this Grammar Note would cost. Nothing References a note, so only
 * Journal Entries are affected, and they keep the Pin as a Tombstone holding the
 * title.
 */
export function deletionImpactForGrammarNote(grammarNoteId: string): Promise<DeletionImpact> {
  return withStores([STORES.journalEntries], 'readonly', async (transaction) => {
    const entries = await getAllRecords<JournalEntry>(
      transaction.objectStore(STORES.journalEntries).index(INDEXES.byPinTarget),
      grammarNoteId,
    )
    return { grammarNotes: [], journalEntries: entries.map(affectedEntry) }
  })
}

async function readImpactOfRemovingTarget(
  transaction: IDBTransaction,
  targetId: string,
): Promise<DeletionImpact> {
  const notes = await getAllRecords<GrammarNote>(
    transaction.objectStore(STORES.grammarNotes).index(INDEXES.byReference),
    targetId,
  )
  const entries = await getAllRecords<JournalEntry>(
    transaction.objectStore(STORES.journalEntries).index(INDEXES.byPinTarget),
    targetId,
  )
  return {
    grammarNotes: notes.map(affectedNote),
    journalEntries: entries.map(affectedEntry),
  }
}

/** Turn every resolved Pin on `entry` that points at `targetId` into a Tombstone. */
function withTombstonedPins(entry: JournalEntry, targetId: string): JournalEntry {
  return {
    ...entry,
    pins: entry.pins.map((pin): Pin =>
      pin.status === 'resolved' && pin.targetId === targetId
        ? // The Lemma or title the Pin was made with, kept as plain text. Storing
          // it twice was the point all along (ADR-0001).
          { status: 'tombstone', pinnedKind: pin.pinnedKind, pinnedAs: pin.pinnedAs }
        : pin,
    ),
    updatedAt: now(),
  }
}

/**
 * Delete a Vocabulary Entry and Unlink it everywhere, destroying nothing that
 * pointed at it: Grammar Notes lose the Reference, Journal Entries keep the Pin
 * as a Tombstone. Returns what lost its link, so the screen can say so.
 */
export function deleteVocabularyEntry(vocabularyEntryId: string): Promise<DeletionImpact> {
  return withStores(
    [STORES.vocabularyEntries, STORES.grammarNotes, STORES.journalEntries],
    'readwrite',
    async (transaction) => {
      const vocabulary = transaction.objectStore(STORES.vocabularyEntries)
      const entry = await getRecord<VocabularyEntry>(vocabulary, vocabularyEntryId)
      if (entry === undefined) return NOTHING_AFFECTED

      const impact = await readImpactOfRemovingTarget(transaction, vocabularyEntryId)

      const notes = transaction.objectStore(STORES.grammarNotes)
      for (const affected of impact.grammarNotes) {
        const note = await getRecord<GrammarNote>(notes, affected.id)
        if (note === undefined) continue
        // A Grammar Note loses the Reference outright: a note about ett-nouns
        // that loses one word is still the same explanation.
        await request(
          notes.put(
            encodeGrammarNote({
              ...note,
              references: note.references.filter(
                (reference) => reference.vocabularyEntryId !== vocabularyEntryId,
              ),
              updatedAt: now(),
            }),
          ),
        )
      }

      const journal = transaction.objectStore(STORES.journalEntries)
      for (const affected of impact.journalEntries) {
        const journalEntry = await getRecord<JournalEntry>(journal, affected.id)
        if (journalEntry === undefined) continue
        await request(
          journal.put(encodeJournalEntry(withTombstonedPins(journalEntry, vocabularyEntryId))),
        )
      }

      await request(vocabulary.delete(vocabularyEntryId))
      return impact
    },
  )
}

/**
 * Delete a Grammar Note. Journal Entries that Pinned it keep the Pin as a
 * Tombstone holding the title. Nothing else pointed at it.
 */
export function deleteGrammarNote(grammarNoteId: string): Promise<DeletionImpact> {
  return withStores(
    [STORES.grammarNotes, STORES.journalEntries],
    'readwrite',
    async (transaction) => {
      const notes = transaction.objectStore(STORES.grammarNotes)
      const note = await getRecord<GrammarNote>(notes, grammarNoteId)
      if (note === undefined) return NOTHING_AFFECTED

      const journal = transaction.objectStore(STORES.journalEntries)
      const entries = await getAllRecords<JournalEntry>(
        journal.index(INDEXES.byPinTarget),
        grammarNoteId,
      )

      for (const entry of entries) {
        await request(journal.put(encodeJournalEntry(withTombstonedPins(entry, grammarNoteId))))
      }

      await request(notes.delete(grammarNoteId))
      return { grammarNotes: [], journalEntries: entries.map(affectedEntry) }
    },
  )
}

/**
 * Delete a Custom Prompt. A Journal Entry Attached to it survives and loses the
 * attachment; the writing is untouched. A Built-in Prompt is never deleted —
 * hide it instead, through `setBuiltInPromptHidden`.
 *
 * A Prompt is Attached, not Pinned, so no Tombstone is kept: what you practiced
 * is recorded by the Pins, and the Prompt was only the suggestion that started
 * the entry.
 */
export function deletePrompt(promptId: string): Promise<DeletionImpact> {
  return withStores(
    [STORES.prompts, STORES.journalEntries],
    'readwrite',
    async (transaction) => {
      const prompts = transaction.objectStore(STORES.prompts)
      const prompt = await getRecord<Prompt>(prompts, promptId)
      if (prompt === undefined) return NOTHING_AFFECTED
      if (isBuiltInPrompt(prompt)) {
        throw new Error('A Built-in Prompt is never deleted; hide it from the picker instead')
      }

      const journal = transaction.objectStore(STORES.journalEntries)
      const entries = await getAllRecords<JournalEntry>(
        journal.index(INDEXES.byAttachedPrompt),
        promptId,
      )

      for (const entry of entries) {
        const detached: JournalEntry = { ...entry, updatedAt: now() }
        delete (detached as { attachedPromptId?: string }).attachedPromptId
        await request(journal.put(encodeJournalEntry(detached)))
      }

      await request(prompts.delete(promptId))
      return { grammarNotes: [], journalEntries: entries.map(affectedEntry) }
    },
  )
}
