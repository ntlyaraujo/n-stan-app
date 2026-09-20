/**
 * Vocabulary Entry storage: create, read, update, delete and the queries the
 * list view needs — by Tag, by Part of Speech, by completeness (spec 3.1, 3.5).
 *
 * Two rules worth stating out loud, because both are easy to get wrong:
 *
 * - **Complete is derived at query time** by `isComplete`. It is never stored
 *   and never indexed, so an entry cannot drift out of agreement with its own
 *   Forms. Gender is not part of it — `missingGender` is a separate filter,
 *   never a redefinition of Complete.
 * - **A duplicate Lemma warns and never blocks.** `bok` the book and `bok` the
 *   beech tree are two Vocabulary Entries, so {@link createVocabularyEntry}
 *   always writes and hands back a warning beside the entry it wrote.
 *
 * Deleting is in `links.ts`: it Unlinks as it goes, and there is deliberately
 * no delete here that skips that.
 */

import type { Entity } from '../domain/entity.ts'
import type { Tag } from '../domain/tag.ts'
import { hasTag, tagKey } from '../domain/tag.ts'
import type { PartOfSpeech, VocabularyEntry } from '../domain/vocabulary.ts'
import { isComplete } from '../domain/vocabulary.ts'
import {
  encodeVocabularyEntry,
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

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Fields a draft may leave out; capture stays fast and they get sane defaults. */
type Defaulted = 'translation' | 'exampleSentence' | 'tags' | 'lookupOutcome'

/**
 * What a capture form hands over: a Lemma, a Part of Speech, whatever Forms are
 * known, and nothing else required.
 */
export type VocabularyEntryDraft = DistributiveOmit<
  VocabularyEntry,
  keyof Entity | Defaulted
> &
  Partial<Pick<VocabularyEntry, Defaulted>>

/**
 * The existing Vocabulary Entries that share a Lemma. Shown as a warning beside
 * the saved entry — never as a reason not to save it.
 */
export interface DuplicateLemmaWarning {
  readonly lemma: string
  readonly existing: readonly VocabularyEntry[]
}

export interface VocabularyEntryWriteResult {
  /** Always written. The warning below never prevents this. */
  readonly entry: VocabularyEntry
  readonly duplicateWarning: DuplicateLemmaWarning | null
}

export type Completeness = 'complete' | 'incomplete'

export interface VocabularyQuery {
  /** Matched without regard to case, per the glossary. */
  readonly tag?: Tag
  readonly partOfSpeech?: PartOfSpeech
  /** Derived from the Paradigm at query time; never a stored flag. */
  readonly completeness?: Completeness
  /**
   * Only nouns with no Gender yet. Deliberately *not* part of
   * {@link Completeness}: Gender is not a Form and a noun with four Forms and
   * no Gender is Complete, which the glossary fixes and a test pins. This is a
   * review list of its own, for the one thing spec section 4 opens by saying
   * cannot be guessed.
   */
  readonly missingGender?: boolean
  /** Live search across Lemma, translation and example sentence (spec 5). */
  readonly search?: string
}

/**
 * The key two Lemmas are compared by: case-folded and Unicode-normalised, so
 * *Bok* and *bok* are flagged as the same word. A matching key only — never
 * stored, never shown.
 */
export function lemmaKey(lemma: string): string {
  return lemma.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

function sortByLemma(entries: VocabularyEntry[]): VocabularyEntry[] {
  return entries.sort((a, b) => a.lemma.localeCompare(b.lemma, 'sv'))
}

export async function createVocabularyEntry(
  draft: VocabularyEntryDraft,
): Promise<VocabularyEntryWriteResult> {
  const timestamp = now()
  const captured = {
    translation: '',
    exampleSentence: '',
    tags: [],
    lookupOutcome: 'never-attempted',
    ...draft,
    id: newId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  } as VocabularyEntry

  // The whole Tag namespace is in scope, not just this store: a Tag first used
  // on a Grammar Note or a Journal Entry keeps its spelling here too.
  return withStores(TAGGED_STORES, 'readwrite', async (transaction) => {
    const store = transaction.objectStore(STORES.vocabularyEntries)
    const existing = await getAllRecords<VocabularyEntry>(store)
    const key = lemmaKey(captured.lemma)
    const duplicates = existing.filter((candidate) => lemmaKey(candidate.lemma) === key)

    const entry = {
      ...captured,
      tags: await canonicaliseTags(transaction, captured.tags),
    } as VocabularyEntry

    await request(store.add(encodeVocabularyEntry(entry)))

    return {
      entry,
      duplicateWarning:
        duplicates.length === 0 ? null : { lemma: entry.lemma, existing: duplicates },
    }
  })
}

/**
 * Write an entry back, stamping `updatedAt`. Whole-entry rather than patch:
 * a Vocabulary Entry is a union on Part of Speech, and a partial update across
 * that union is where wrong-Paradigm Forms would creep in.
 */
export async function saveVocabularyEntry(entry: VocabularyEntry): Promise<VocabularyEntry> {
  return withStores(TAGGED_STORES, 'readwrite', async (transaction) => {
    const saved = {
      ...entry,
      tags: await canonicaliseTags(transaction, entry.tags, { ignoreId: entry.id }),
      updatedAt: now(),
    } as VocabularyEntry
    const store = transaction.objectStore(STORES.vocabularyEntries)
    await request(store.put(encodeVocabularyEntry(saved)))
    return saved
  })
}

export function getVocabularyEntry(id: string): Promise<VocabularyEntry | undefined> {
  return withStores([STORES.vocabularyEntries], 'readonly', (transaction) =>
    getRecord<VocabularyEntry>(transaction.objectStore(STORES.vocabularyEntries), id),
  )
}

export function listVocabularyEntries(
  query: VocabularyQuery = {},
): Promise<VocabularyEntry[]> {
  return withStores([STORES.vocabularyEntries], 'readonly', async (transaction) => {
    const store = transaction.objectStore(STORES.vocabularyEntries)

    // Narrow through an index where one exists, then apply the rest in memory.
    // Completeness has no index on purpose: it is derived from the Paradigm.
    const narrowed =
      query.tag !== undefined
        ? await getAllRecords<VocabularyEntry>(
            store.index(INDEXES.byTagKey),
            tagKey(query.tag),
          )
        : query.partOfSpeech !== undefined
          ? await getAllRecords<VocabularyEntry>(
              store.index(INDEXES.byPartOfSpeech),
              query.partOfSpeech,
            )
          : await getAllRecords<VocabularyEntry>(store)

    const search = query.search?.trim().toLowerCase()

    return sortByLemma(
      narrowed.filter((entry) => {
        if (query.tag !== undefined && !hasTag(entry.tags, query.tag)) return false
        if (query.partOfSpeech !== undefined && entry.partOfSpeech !== query.partOfSpeech) {
          return false
        }
        if (query.completeness !== undefined) {
          const complete = isComplete(entry)
          if (complete !== (query.completeness === 'complete')) return false
        }
        if (query.missingGender === true) {
          if (entry.partOfSpeech !== 'noun' || entry.gender !== undefined) return false
        }
        if (search !== undefined && search !== '') {
          const haystack =
            `${entry.lemma}\n${entry.translation}\n${entry.exampleSentence}`.toLowerCase()
          if (!haystack.includes(search)) return false
        }
        return true
      }),
    )
  })
}

/**
 * The Vocabulary Entries already holding this Lemma, matched without regard to
 * case. What the capture form calls before saving to warn in advance; the
 * warning {@link createVocabularyEntry} returns is the same set.
 */
export function findVocabularyEntriesByLemma(lemma: string): Promise<VocabularyEntry[]> {
  const key = lemmaKey(lemma)
  return withStores([STORES.vocabularyEntries], 'readonly', async (transaction) => {
    const entries = await getAllRecords<VocabularyEntry>(
      transaction.objectStore(STORES.vocabularyEntries),
    )
    return sortByLemma(entries.filter((entry) => lemmaKey(entry.lemma) === key))
  })
}

/** The warning a capture form shows, or `null` when the Lemma is new. */
export async function duplicateLemmaWarning(
  lemma: string,
  options: { readonly ignoreId?: string } = {},
): Promise<DuplicateLemmaWarning | null> {
  const existing = (await findVocabularyEntriesByLemma(lemma)).filter(
    (entry) => entry.id !== options.ignoreId,
  )
  return existing.length === 0 ? null : { lemma, existing }
}
