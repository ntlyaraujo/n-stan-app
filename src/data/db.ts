/**
 * The IndexedDB database: object stores, indexes, versioning and the small
 * promise wrapper every repository is built on (spec 6, 7).
 *
 * Three rules this file exists to keep:
 *
 * 1. **The schema is versioned from the start.** Later phases will add stores
 *    and indexes, so upgrades run through {@link MIGRATIONS} — an ordered list
 *    where each step is applied once, in version order, to whatever version the
 *    browser happens to be holding. {@link rewriteStore} is how a step carries
 *    existing data forward.
 * 2. **Nothing derived is stored as data.** Complete is derived at query time
 *    from `isComplete` and is neither stored nor indexed. The only derived
 *    fields written down are the *index keys* below, which exist because
 *    IndexedDB cannot index a computed value; they are stripped on read, so a
 *    round-trip returns exactly the domain object that went in.
 * 3. **Tags are matched without regard to case**, so the tag index is built on
 *    `tagKey` rather than on the stored spelling.
 */

import type { GrammarNote } from '../domain/grammarNote.ts'
import type { JournalEntry } from '../domain/journalEntry.ts'
import type { Prompt } from '../domain/prompt.ts'
import { tagKey } from '../domain/tag.ts'
import type { VocabularyEntry } from '../domain/vocabulary.ts'

export const DATABASE_NAME = 'n-stan-app'

export const STORES = {
  vocabularyEntries: 'vocabularyEntries',
  grammarNotes: 'grammarNotes',
  journalEntries: 'journalEntries',
  prompts: 'prompts',
  dictionaryCache: 'dictionaryCache',
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

/**
 * Index names. Every one of these backs a filter a list view actually offers:
 * tags everywhere, Part of Speech on vocabulary, Date on the journal, level on
 * Prompts, plus the two reverse-link indexes that let a word report what
 * references it (spec 3.5, 3.6).
 */
export const INDEXES = {
  byLemma: 'by-lemma',
  byPartOfSpeech: 'by-part-of-speech',
  byTagKey: 'by-tag-key',
  byUpdatedAt: 'by-updated-at',
  byReference: 'by-reference',
  byDate: 'by-date',
  byPinTarget: 'by-pin-target',
  byAttachedPrompt: 'by-attached-prompt',
  byFetchedAt: 'by-fetched-at',
  byLevel: 'by-level',
  byOrigin: 'by-origin',
} as const

/**
 * The index-only fields. They are written alongside a record and removed again
 * on read: no caller ever sees one, and no caller should ever set one.
 */
const INDEX_KEY_FIELDS = ['tagKeys', 'referenceIds', 'pinTargetIds'] as const

interface IndexKeys {
  /** Case-folded Tags, so a Tag filter matches regardless of spelling. */
  readonly tagKeys?: readonly string[]
  /** The Vocabulary Entry ids a Grammar Note References, for Backlinks. */
  readonly referenceIds?: readonly string[]
  /** The ids a Journal Entry's *resolved* Pins point at. Tombstones have none. */
  readonly pinTargetIds?: readonly string[]
}

export type Stored<T> = T & IndexKeys

// --- encoding -------------------------------------------------------------

function tagKeysOf(tags: readonly string[]): readonly string[] {
  return [...new Set(tags.map(tagKey))]
}

export function encodeVocabularyEntry(entry: VocabularyEntry): Stored<VocabularyEntry> {
  return { ...entry, tagKeys: tagKeysOf(entry.tags) }
}

export function encodeGrammarNote(note: GrammarNote): Stored<GrammarNote> {
  return {
    ...note,
    tagKeys: tagKeysOf(note.tags),
    referenceIds: [...new Set(note.references.map((reference) => reference.vocabularyEntryId))],
  }
}

export function encodeJournalEntry(entry: JournalEntry): Stored<JournalEntry> {
  return {
    ...entry,
    tagKeys: tagKeysOf(entry.tags),
    pinTargetIds: [
      ...new Set(
        entry.pins.flatMap((pin) => (pin.status === 'resolved' ? [pin.targetId] : [])),
      ),
    ],
  }
}

export function encodePrompt(prompt: Prompt): Stored<Prompt> {
  return { ...prompt }
}

/** Strip the index-only fields, so what comes out is what went in. */
export function decode<T>(stored: Stored<T> | undefined): T | undefined {
  if (stored === undefined) return undefined
  const copy = { ...stored } as Record<string, unknown>
  for (const field of INDEX_KEY_FIELDS) delete copy[field]
  return copy as T
}

export function decodeAll<T>(stored: readonly Stored<T>[]): T[] {
  return stored.map((record) => decode(record) as T)
}

// --- schema and migrations ------------------------------------------------

interface Migration {
  readonly version: number
  /** Why the step exists. Read as a changelog when a later one is added. */
  readonly describe: string
  readonly migrate: (db: IDBDatabase, transaction: IDBTransaction) => void
}

/**
 * Rewrite every record in a store through `transform`. This is how a migration
 * carries existing data forward — re-deriving an index key, filling a field
 * added in a later version, dropping one that went away.
 *
 * Only callable inside a `versionchange` transaction, which is exactly where a
 * migration runs.
 */
export function rewriteStore(
  transaction: IDBTransaction,
  storeName: StoreName,
  transform: (record: Record<string, unknown>) => Record<string, unknown>,
): void {
  const store = transaction.objectStore(storeName)
  const cursorRequest = store.openCursor()
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (cursor === null) return
    cursor.update(transform(cursor.value as Record<string, unknown>))
    cursor.continue()
  }
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    describe: 'The five v1 stores and the indexes the list filters need.',
    migrate: (db) => {
      const vocabulary = db.createObjectStore(STORES.vocabularyEntries, { keyPath: 'id' })
      // Not unique: a Lemma does not identify a Vocabulary Entry, so *bok* the
      // book and *bok* the beech tree both live here (spec 3.1).
      vocabulary.createIndex(INDEXES.byLemma, 'lemma')
      vocabulary.createIndex(INDEXES.byPartOfSpeech, 'partOfSpeech')
      vocabulary.createIndex(INDEXES.byTagKey, 'tagKeys', { multiEntry: true })
      vocabulary.createIndex(INDEXES.byUpdatedAt, 'updatedAt')

      const grammarNotes = db.createObjectStore(STORES.grammarNotes, { keyPath: 'id' })
      grammarNotes.createIndex(INDEXES.byTagKey, 'tagKeys', { multiEntry: true })
      grammarNotes.createIndex(INDEXES.byReference, 'referenceIds', { multiEntry: true })
      grammarNotes.createIndex(INDEXES.byUpdatedAt, 'updatedAt')

      // Keyed by id, never by Date: several Journal Entries may share one Date
      // (spec 3.3), and the Date index is what groups the list.
      const journalEntries = db.createObjectStore(STORES.journalEntries, { keyPath: 'id' })
      journalEntries.createIndex(INDEXES.byDate, 'date')
      journalEntries.createIndex(INDEXES.byTagKey, 'tagKeys', { multiEntry: true })
      journalEntries.createIndex(INDEXES.byPinTarget, 'pinTargetIds', { multiEntry: true })
      journalEntries.createIndex(INDEXES.byAttachedPrompt, 'attachedPromptId')

      const prompts = db.createObjectStore(STORES.prompts, { keyPath: 'id' })
      prompts.createIndex(INDEXES.byLevel, 'level')
      prompts.createIndex(INDEXES.byOrigin, 'origin')

      // Dictionary responses are cached here rather than in the service worker,
      // so caching stays in one place (spec 7). A word is fetched once.
      const dictionaryCache = db.createObjectStore(STORES.dictionaryCache, {
        keyPath: 'lemmaKey',
      })
      dictionaryCache.createIndex(INDEXES.byFetchedAt, 'fetchedAt')
    },
  },
]

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

// --- opening --------------------------------------------------------------

let openPromise: Promise<IDBDatabase> | null = null

export function openDatabase(): Promise<IDBDatabase> {
  openPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, SCHEMA_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const transaction = request.transaction
      if (transaction === null) throw new Error('Upgrade without a transaction')
      for (const migration of MIGRATIONS) {
        if (migration.version > event.oldVersion && migration.version <= SCHEMA_VERSION) {
          migration.migrate(db, transaction)
        }
      }
    }

    request.onsuccess = () => {
      const db = request.result
      // A newer tab wants to upgrade: let go rather than block it.
      db.onversionchange = () => {
        db.close()
        openPromise = null
      }
      resolve(db)
    }

    request.onerror = () => reject(request.error ?? new Error('Could not open the database'))
    request.onblocked = () =>
      reject(new Error('The database is open in another tab and is blocking the upgrade'))
  })

  return openPromise
}

export async function closeDatabase(): Promise<void> {
  if (openPromise === null) return
  const db = await openPromise
  db.close()
  openPromise = null
}

/** Drops everything. Used by tests and by a future "start over" action. */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Could not delete the database'))
    request.onblocked = () => resolve()
  })
}

// --- transactions ---------------------------------------------------------

export function request<T>(idbRequest: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result)
    idbRequest.onerror = () => reject(idbRequest.error ?? new Error('Request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'))
  })
}

/**
 * Run `work` against the named stores in one transaction, resolving only once
 * the transaction has committed. Anything that must happen together — a delete
 * and the Unlinking it implies, above all — belongs in a single call.
 *
 * Only await IndexedDB requests inside `work`: awaiting anything else lets the
 * transaction commit out from under you.
 */
export async function withStores<T>(
  storeNames: readonly StoreName[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase()
  const transaction = db.transaction([...storeNames], mode)
  const done = transactionDone(transaction)
  try {
    const value = await work(transaction)
    await done
    return value
  } catch (error) {
    done.catch(() => {
      // Already reported through the error being rethrown below.
    })
    try {
      transaction.abort()
    } catch {
      // Already finished; nothing to abort.
    }
    throw error
  }
}

/** Every record a store or index holds, decoded. */
export async function getAllRecords<T>(
  source: IDBObjectStore | IDBIndex,
  query?: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const records = await request<Stored<T>[]>(source.getAll(query) as IDBRequest<Stored<T>[]>)
  return decodeAll(records)
}

/** One record by primary key, decoded. */
export async function getRecord<T>(
  store: IDBObjectStore,
  key: IDBValidKey,
): Promise<T | undefined> {
  const record = await request<Stored<T> | undefined>(
    store.get(key) as IDBRequest<Stored<T> | undefined>,
  )
  return decode(record)
}

// --- identity -------------------------------------------------------------

export function newId(): string {
  return crypto.randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}
