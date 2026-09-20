/**
 * Prompt storage: the shipped Built-in Prompt set, the Custom Prompts you write
 * and the level filter the picker needs (spec 3.4).
 *
 * A Built-in Prompt is read-only. You may hide one from the picker, and editing
 * one produces a Custom Prompt instead — which is what lets a revised Prompt set
 * ship later without discarding your wording.
 *
 * Deleting a Prompt is in `links.ts`, because a Journal Entry may be Attached to
 * it and must survive.
 */

import type { Entity } from '../domain/entity.ts'
import type { BuiltInPrompt, CustomPrompt, Prompt, PromptLevel } from '../domain/prompt.ts'
import { isBuiltInPrompt, PROMPT_LEVELS } from '../domain/prompt.ts'
import { builtInPrompts } from './builtInPrompts.ts'
import type { BuiltInPromptSeed } from './builtInPrompts.ts'
import {
  encodePrompt,
  getAllRecords,
  getRecord,
  INDEXES,
  newId,
  now,
  request,
  STORES,
  withStores,
} from './db.ts'

export type CustomPromptDraft = Omit<CustomPrompt, keyof Entity | 'origin'>

export interface PromptQuery {
  readonly level?: PromptLevel
  readonly origin?: Prompt['origin']
  /** Hidden Built-in Prompts stay out of the picker unless asked for. */
  readonly includeHidden?: boolean
  readonly search?: string
}

function levelRank(level: PromptLevel): number {
  return PROMPT_LEVELS.indexOf(level)
}

function sortForPicker(prompts: Prompt[]): Prompt[] {
  return prompts.sort(
    (a, b) =>
      levelRank(a.level) - levelRank(b.level) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  )
}

/**
 * Write the shipped set into storage, adding what is new and refreshing the text
 * and level of what already exists. Your `hidden` choices and every Custom
 * Prompt are left alone, so this is safe to run on every start.
 */
export async function seedBuiltInPrompts(
  seeds: readonly BuiltInPromptSeed[] = builtInPrompts,
): Promise<void> {
  await withStores([STORES.prompts], 'readwrite', async (transaction) => {
    const store = transaction.objectStore(STORES.prompts)
    for (const seed of seeds) {
      const existing = await getRecord<Prompt>(store, seed.id)
      if (existing !== undefined && !isBuiltInPrompt(existing)) continue

      const timestamp = now()
      const prompt: BuiltInPrompt = {
        id: seed.id,
        text: seed.text,
        level: seed.level,
        origin: 'built-in',
        // A revised shipped set must not un-hide what you hid.
        hidden: existing?.hidden ?? false,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt:
          existing !== undefined && existing.text === seed.text && existing.level === seed.level
            ? existing.updatedAt
            : timestamp,
      }
      await request(store.put(encodePrompt(prompt)))
    }
  })
}

export function getPrompt(id: string): Promise<Prompt | undefined> {
  return withStores([STORES.prompts], 'readonly', (transaction) =>
    getRecord<Prompt>(transaction.objectStore(STORES.prompts), id),
  )
}

export function listPrompts(query: PromptQuery = {}): Promise<Prompt[]> {
  return withStores([STORES.prompts], 'readonly', async (transaction) => {
    const store = transaction.objectStore(STORES.prompts)

    const narrowed =
      query.level !== undefined
        ? await getAllRecords<Prompt>(store.index(INDEXES.byLevel), query.level)
        : query.origin !== undefined
          ? await getAllRecords<Prompt>(store.index(INDEXES.byOrigin), query.origin)
          : await getAllRecords<Prompt>(store)

    const search = query.search?.trim().toLowerCase()

    return sortForPicker(
      narrowed.filter((prompt) => {
        if (query.level !== undefined && prompt.level !== query.level) return false
        if (query.origin !== undefined && prompt.origin !== query.origin) return false
        if (query.includeHidden !== true && isBuiltInPrompt(prompt) && prompt.hidden) {
          return false
        }
        if (search !== undefined && search !== '' && !prompt.text.toLowerCase().includes(search)) {
          return false
        }
        return true
      }),
    )
  })
}

export async function createCustomPrompt(draft: CustomPromptDraft): Promise<CustomPrompt> {
  const timestamp = now()
  const prompt: CustomPrompt = {
    ...draft,
    origin: 'custom',
    id: newId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await withStores([STORES.prompts], 'readwrite', async (transaction) => {
    await request(transaction.objectStore(STORES.prompts).add(encodePrompt(prompt)))
  })
  return prompt
}

/**
 * Editing a Built-in Prompt produces a Custom Prompt: the shipped one is left
 * untouched and the copy records what it came from.
 */
export async function createCustomPromptFromBuiltIn(
  builtInPromptId: string,
  changes: Partial<Pick<CustomPrompt, 'text' | 'level'>> = {},
): Promise<CustomPrompt> {
  const original = await getPrompt(builtInPromptId)
  if (original === undefined || !isBuiltInPrompt(original)) {
    throw new Error(`No Built-in Prompt with id ${builtInPromptId}`)
  }
  return createCustomPrompt({
    text: changes.text ?? original.text,
    level: changes.level ?? original.level,
    derivedFrom: original.id,
  })
}

export async function saveCustomPrompt(prompt: CustomPrompt): Promise<CustomPrompt> {
  if (isBuiltInPrompt(prompt as Prompt)) {
    throw new Error('A Built-in Prompt is read-only; edit it into a Custom Prompt instead')
  }
  const saved: CustomPrompt = { ...prompt, updatedAt: now() }
  await withStores([STORES.prompts], 'readwrite', async (transaction) => {
    await request(transaction.objectStore(STORES.prompts).put(encodePrompt(saved)))
  })
  return saved
}

/** Hide a Built-in Prompt from the picker, or bring it back. It is never deleted. */
export async function setBuiltInPromptHidden(
  id: string,
  hidden: boolean,
): Promise<BuiltInPrompt> {
  return withStores([STORES.prompts], 'readwrite', async (transaction) => {
    const store = transaction.objectStore(STORES.prompts)
    const prompt = await getRecord<Prompt>(store, id)
    if (prompt === undefined || !isBuiltInPrompt(prompt)) {
      throw new Error(`No Built-in Prompt with id ${id}`)
    }
    const saved: BuiltInPrompt = { ...prompt, hidden, updatedAt: now() }
    await request(store.put(encodePrompt(saved)))
    return saved
  })
}
