/**
 * The one Tag namespace, shared by Vocabulary Entries, Grammar Notes and
 * Journal Entries (spec 3.5, glossary *Tag*).
 *
 * `addTag` in the domain keeps the spelling first used *within one record's own
 * Tags*. That is not enough on its own: the namespace is shared, so *Verb
 * tenses* typed on a word and *verb tenses* typed later on a Grammar Note are
 * one Tag and must be stored under one spelling. Canonicalising lives here, in
 * the data layer, so every write path gets it rather than each screen
 * remembering to.
 *
 * Two rules:
 *
 * - **The spelling first used wins**, across all three stores — the oldest
 *   record carrying the Tag decides, with the id as a tie-break so the answer
 *   never depends on which store was read first.
 * - **Nothing is scanned naively.** Every store already indexes `tagKeys`, so
 *   looking a Tag up in the namespace reads only the records that carry it.
 *
 * A record being written is excluded from the search, which is what lets you
 * re-spell a Tag nothing else uses.
 */

import type { Tag } from '../domain/tag.ts'
import { normaliseTag, tagKey } from '../domain/tag.ts'
import { getAllRecords, INDEXES, STORES, withStores } from './db.ts'

/** The three stores whose records carry Tags. The namespace is their union. */
export const TAGGED_STORES = [
  STORES.vocabularyEntries,
  STORES.grammarNotes,
  STORES.journalEntries,
] as const

/** All this module reads of a record: who it is, when, and its Tags. */
export interface TaggedRecord {
  readonly id: string
  readonly createdAt: string
  readonly tags: readonly Tag[]
}

/** Older wins. The id breaks a tie, so store order never decides a spelling. */
function isFirstUsed(candidate: TaggedRecord, incumbent: TaggedRecord): boolean {
  if (candidate.createdAt !== incumbent.createdAt) {
    return candidate.createdAt < incumbent.createdAt
  }
  return candidate.id < incumbent.id
}

/** The spelling the namespace already holds for a Tag key, if any. */
async function spellingInUse(
  transaction: IDBTransaction,
  key: string,
  ignoreId: string | undefined,
): Promise<Tag | undefined> {
  let holder: TaggedRecord | undefined
  let spelling: Tag | undefined

  for (const storeName of TAGGED_STORES) {
    const records = await getAllRecords<TaggedRecord>(
      transaction.objectStore(storeName).index(INDEXES.byTagKey),
      key,
    )
    for (const record of records) {
      if (record.id === ignoreId) continue
      const used = record.tags.find((tag) => tagKey(tag) === key)
      if (used === undefined) continue
      if (holder === undefined || isFirstUsed(record, holder)) {
        holder = record
        spelling = used
      }
    }
  }

  return spelling
}

/**
 * The Tags as they should be stored: normalised, de-duplicated without regard
 * to case, and each one in the spelling the namespace is already using.
 *
 * The transaction must span {@link TAGGED_STORES}, since the namespace is all
 * three of them.
 */
export async function canonicaliseTags(
  transaction: IDBTransaction,
  tags: readonly Tag[],
  options: { readonly ignoreId?: string } = {},
): Promise<readonly Tag[]> {
  const canonical: Tag[] = []
  const seen = new Set<string>()

  for (const raw of tags) {
    const tag = normaliseTag(raw)
    if (tag === '') continue
    const key = tagKey(tag)
    if (seen.has(key)) continue
    seen.add(key)
    canonical.push((await spellingInUse(transaction, key, options.ignoreId)) ?? tag)
  }

  return canonical
}

/**
 * Every distinct Tag a set of records carries, folded without regard to case
 * and given back in the spelling first used. What a Tag filter's options are
 * built from, so one Tag can never appear twice in a dropdown.
 */
export function distinctTags(records: readonly TaggedRecord[]): readonly Tag[] {
  const spelling = new Map<string, Tag>()
  const oldestFirst = [...records].sort((a, b) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
  )

  for (const record of oldestFirst) {
    for (const tag of record.tags) {
      const key = tagKey(tag)
      if (!spelling.has(key)) spelling.set(key, tag)
    }
  }

  return [...spelling.values()].sort((a, b) => a.localeCompare(b, 'sv'))
}

/**
 * Every Tag in the whole namespace, in the spelling first used. What a Tag
 * input suggests from — all three screens suggest from the same list, because
 * offering only one entity type's Tags is how divergent spellings start.
 */
export function listTags(): Promise<readonly Tag[]> {
  return withStores(TAGGED_STORES, 'readonly', async (transaction) => {
    const records: TaggedRecord[] = []
    for (const storeName of TAGGED_STORES) {
      records.push(
        ...(await getAllRecords<TaggedRecord>(transaction.objectStore(storeName))),
      )
    }
    return distinctTags(records)
  })
}
