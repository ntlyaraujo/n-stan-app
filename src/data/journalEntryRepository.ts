/**
 * Journal Entry storage and the queries its list needs (spec 3.3, 3.5).
 *
 * Journal Entries are keyed by id and indexed by Date, never keyed by Date:
 * several entries may belong to the same day, and the list groups rather than
 * replaces. The Date is the day the entry belongs to and is chosen by you;
 * `createdAt` is when it was written and is never edited.
 *
 * Pins are created and removed in `links.ts`, which is what captures the Lemma
 * a Pin was made with.
 */

import type { CalendarDate, Entity } from '../domain/entity.ts'
import type { JournalEntry } from '../domain/journalEntry.ts'
import type { Tag } from '../domain/tag.ts'
import { hasTag, tagKey } from '../domain/tag.ts'
import {
  encodeJournalEntry,
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

type Defaulted = 'date' | 'body' | 'pins' | 'tags'

export type JournalEntryDraft = Omit<JournalEntry, keyof Entity | Defaulted> &
  Partial<Pick<JournalEntry, Defaulted>>

export interface JournalEntryQuery {
  /** Matched without regard to case. */
  readonly tag?: Tag
  /** One Date exactly. */
  readonly date?: CalendarDate
  /** An inclusive Date range. */
  readonly from?: CalendarDate
  readonly to?: CalendarDate
  readonly attachedPromptId?: string
  readonly search?: string
}

/** One day of the journal list: the Date and the entries that belong to it. */
export interface JournalEntryDateGroup {
  readonly date: CalendarDate
  readonly entries: readonly JournalEntry[]
}

/** Today as a Date, in local time. The default a new Journal Entry gets. */
export function today(): CalendarDate {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The first non-blank line of the body, which is how an untitled entry is
 * identified in a list (spec 3.3).
 */
export function journalEntryPreview(entry: JournalEntry): string {
  return entry.body.split('\n').find((line) => line.trim() !== '')?.trim() ?? ''
}

/** Newest Date first, and within a Date the most recently written first. */
function sortNewestFirst(entries: JournalEntry[]): JournalEntry[] {
  return entries.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}

export async function createJournalEntry(
  draft: JournalEntryDraft = {},
): Promise<JournalEntry> {
  const timestamp = now()
  const written: JournalEntry = {
    date: today(),
    body: '',
    pins: [],
    tags: [],
    ...draft,
    id: newId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  // The whole Tag namespace is in scope: a Tag first used on a word or a
  // Grammar Note keeps its spelling here too.
  return withStores(TAGGED_STORES, 'readwrite', async (transaction) => {
    const entry: JournalEntry = {
      ...written,
      tags: await canonicaliseTags(transaction, written.tags),
    }
    await request(
      transaction.objectStore(STORES.journalEntries).add(encodeJournalEntry(entry)),
    )
    return entry
  })
}

export async function saveJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
  return withStores(TAGGED_STORES, 'readwrite', async (transaction) => {
    const saved: JournalEntry = {
      ...entry,
      tags: await canonicaliseTags(transaction, entry.tags, { ignoreId: entry.id }),
      updatedAt: now(),
    }
    await request(
      transaction.objectStore(STORES.journalEntries).put(encodeJournalEntry(saved)),
    )
    return saved
  })
}

export function getJournalEntry(id: string): Promise<JournalEntry | undefined> {
  return withStores([STORES.journalEntries], 'readonly', (transaction) =>
    getRecord<JournalEntry>(transaction.objectStore(STORES.journalEntries), id),
  )
}

/**
 * Nothing points at a Journal Entry, so this is the one delete that Unlinks
 * nothing. Its Pins go with it; the words and notes they pointed at survive.
 */
export async function deleteJournalEntry(id: string): Promise<void> {
  await withStores([STORES.journalEntries], 'readwrite', async (transaction) => {
    await request(transaction.objectStore(STORES.journalEntries).delete(id))
  })
}

export function listJournalEntries(query: JournalEntryQuery = {}): Promise<JournalEntry[]> {
  return withStores([STORES.journalEntries], 'readonly', async (transaction) => {
    const store = transaction.objectStore(STORES.journalEntries)

    const narrowed =
      query.tag !== undefined
        ? await getAllRecords<JournalEntry>(store.index(INDEXES.byTagKey), tagKey(query.tag))
        : query.date !== undefined
          ? await getAllRecords<JournalEntry>(store.index(INDEXES.byDate), query.date)
          : query.attachedPromptId !== undefined
            ? await getAllRecords<JournalEntry>(
                store.index(INDEXES.byAttachedPrompt),
                query.attachedPromptId,
              )
            : query.from !== undefined || query.to !== undefined
              ? await getAllRecords<JournalEntry>(
                  store.index(INDEXES.byDate),
                  boundedDateRange(query.from, query.to),
                )
              : await getAllRecords<JournalEntry>(store)

    const search = query.search?.trim().toLowerCase()

    return sortNewestFirst(
      narrowed.filter((entry) => {
        if (query.tag !== undefined && !hasTag(entry.tags, query.tag)) return false
        if (query.date !== undefined && entry.date !== query.date) return false
        if (query.from !== undefined && entry.date < query.from) return false
        if (query.to !== undefined && entry.date > query.to) return false
        if (
          query.attachedPromptId !== undefined &&
          entry.attachedPromptId !== query.attachedPromptId
        ) {
          return false
        }
        if (search !== undefined && search !== '' && !entry.body.toLowerCase().includes(search)) {
          return false
        }
        return true
      }),
    )
  })
}

function boundedDateRange(from?: CalendarDate, to?: CalendarDate): IDBKeyRange {
  if (from !== undefined && to !== undefined) return IDBKeyRange.bound(from, to)
  if (from !== undefined) return IDBKeyRange.lowerBound(from)
  return IDBKeyRange.upperBound(to as CalendarDate)
}

/**
 * The journal list: entries grouped by Date, newest Date first. Several entries
 * on one day are one group, in the order they were written, newest first.
 */
export async function listJournalEntriesByDate(
  query: JournalEntryQuery = {},
): Promise<JournalEntryDateGroup[]> {
  const entries = await listJournalEntries(query)
  const groups: JournalEntryDateGroup[] = []
  for (const entry of entries) {
    const last = groups.at(-1)
    if (last !== undefined && last.date === entry.date) {
      ;(last.entries as JournalEntry[]).push(entry)
    } else {
      groups.push({ date: entry.date, entries: [entry] })
    }
  }
  return groups
}
