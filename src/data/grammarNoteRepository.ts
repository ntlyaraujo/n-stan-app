/**
 * Grammar Note storage and the queries its list needs (spec 3.2, 3.5).
 *
 * References are created and removed in `links.ts`, together with the Backlinks
 * they produce, and deleting a note lives there too because a Journal Entry
 * that Pinned it must be left holding a Tombstone.
 */

import type { Entity } from '../domain/entity.ts'
import type { GrammarNote } from '../domain/grammarNote.ts'
import type { Tag } from '../domain/tag.ts'
import { hasTag, tagKey } from '../domain/tag.ts'
import {
  encodeGrammarNote,
  getAllRecords,
  getRecord,
  INDEXES,
  newId,
  now,
  request,
  STORES,
  withStores,
} from './db.ts'
import { canonicaliseTags, TAGGED_STORES } from './tagNamespace.ts'

type Defaulted = 'body' | 'tags' | 'references'

export type GrammarNoteDraft = Omit<GrammarNote, keyof Entity | Defaulted> &
  Partial<Pick<GrammarNote, Defaulted>>

export interface GrammarNoteQuery {
  /** Matched without regard to case. */
  readonly tag?: Tag
  /** Live search across title and body (spec 5). */
  readonly search?: string
  /** Only notes that Reference this Vocabulary Entry. */
  readonly referencesVocabularyEntryId?: string
}

export async function createGrammarNote(draft: GrammarNoteDraft): Promise<GrammarNote> {
  const timestamp = now()
  const written: GrammarNote = {
    body: '',
    tags: [],
    references: [],
    ...draft,
    id: newId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  // The whole Tag namespace is in scope: a Tag first used on a word or a
  // Journal Entry keeps its spelling here too.
  return withStores(TAGGED_STORES, 'readwrite', async (transaction) => {
    const note: GrammarNote = {
      ...written,
      tags: await canonicaliseTags(transaction, written.tags),
    }
    await request(transaction.objectStore(STORES.grammarNotes).add(encodeGrammarNote(note)))
    return note
  })
}

export async function saveGrammarNote(note: GrammarNote): Promise<GrammarNote> {
  return withStores(TAGGED_STORES, 'readwrite', async (transaction) => {
    const saved: GrammarNote = {
      ...note,
      tags: await canonicaliseTags(transaction, note.tags, { ignoreId: note.id }),
      updatedAt: now(),
    }
    await request(transaction.objectStore(STORES.grammarNotes).put(encodeGrammarNote(saved)))
    return saved
  })
}

export function getGrammarNote(id: string): Promise<GrammarNote | undefined> {
  return withStores([STORES.grammarNotes], 'readonly', (transaction) =>
    getRecord<GrammarNote>(transaction.objectStore(STORES.grammarNotes), id),
  )
}

export function listGrammarNotes(query: GrammarNoteQuery = {}): Promise<GrammarNote[]> {
  return withStores([STORES.grammarNotes], 'readonly', async (transaction) => {
    const store = transaction.objectStore(STORES.grammarNotes)

    const narrowed =
      query.tag !== undefined
        ? await getAllRecords<GrammarNote>(store.index(INDEXES.byTagKey), tagKey(query.tag))
        : query.referencesVocabularyEntryId !== undefined
          ? await getAllRecords<GrammarNote>(
              store.index(INDEXES.byReference),
              query.referencesVocabularyEntryId,
            )
          : await getAllRecords<GrammarNote>(store)

    const search = query.search?.trim().toLowerCase()

    return narrowed
      .filter((note) => {
        if (query.tag !== undefined && !hasTag(note.tags, query.tag)) return false
        if (
          query.referencesVocabularyEntryId !== undefined &&
          !note.references.some(
            (reference) =>
              reference.vocabularyEntryId === query.referencesVocabularyEntryId,
          )
        ) {
          return false
        }
        if (search !== undefined && search !== '') {
          if (!`${note.title}\n${note.body}`.toLowerCase().includes(search)) return false
        }
        return true
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'sv'))
  })
}
