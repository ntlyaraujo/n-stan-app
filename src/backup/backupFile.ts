/**
 * The backup file: what a JSON export contains, and the validation an import
 * runs *before* the database is touched (spec 6, #24, #25).
 *
 * Storage is local-only, so a backup is the only thing standing between months
 * of writing and an evicted database. Two rules follow, and everything here
 * exists to keep them:
 *
 * 1. **Complete rather than convenient.** Every Vocabulary Entry, Grammar Note,
 *    Journal Entry and Prompt is written out whole — including the `hidden`
 *    flag on a Built-in Prompt, every Reference, and every Pin, Tombstones
 *    included. Tags are not a store of their own: they travel on the entities
 *    that carry them, in the spelling those entities hold, so a round-trip
 *    returns the same Tag set without a separate list to keep in step.
 *
 *    The one thing deliberately left out is the Dictionary cache. It is not
 *    your writing — losing it costs a network request, and carrying it would
 *    bloat every backup with data the app can fetch again.
 *
 * 2. **An import either applies whole or not at all.** Validation happens here,
 *    on parsed JSON, and hands back either a fully typed {@link BackupFile} or a
 *    message saying what is wrong with the file. Nothing in this module opens
 *    the database.
 *
 * A field the schema does not know about is dropped rather than carried across,
 * which is what `formatVersion` is for: a file written by a newer app is refused
 * outright instead of being imported with the new parts quietly missing.
 *
 * The file carries two version numbers. {@link BACKUP_FORMAT_VERSION} is this
 * envelope's own version, which is what a future import reads first to know
 * what it is looking at; `schemaVersion` records the IndexedDB schema the data
 * came out of, for a migration that may one day need it.
 */

import { z } from 'zod'

import { SCHEMA_VERSION } from '../data/index.ts'
import type { GrammarNote } from '../domain/index.ts'
import {
  CONJUGATION_GROUPS,
  GENDERS,
  LOOKUP_OUTCOMES,
  PROMPT_LEVELS,
} from '../domain/index.ts'
import type {
  JournalEntry,
  PartOfSpeech,
  Prompt,
  VocabularyEntry,
} from '../domain/index.ts'

/** Identifies the file as this app's, so another app's JSON fails early. */
export const BACKUP_APP = 'n-stan-app'

/**
 * The envelope version. Bump it only when the *shape of the file* changes in a
 * way an older import could not read, and keep reading the older version here.
 */
export const BACKUP_FORMAT_VERSION = 1

/** Everything a backup holds, keyed by the store it belongs to. */
export interface BackupData {
  readonly vocabularyEntries: readonly VocabularyEntry[]
  readonly grammarNotes: readonly GrammarNote[]
  readonly journalEntries: readonly JournalEntry[]
  readonly prompts: readonly Prompt[]
}

export interface BackupFile {
  readonly app: typeof BACKUP_APP
  readonly formatVersion: number
  /** The IndexedDB schema version the data was read out of. */
  readonly schemaVersion: number
  readonly exportedAt: string
  readonly data: BackupData
}

/** How much of each kind a file — or the database — holds. */
export interface BackupCounts {
  readonly vocabularyEntries: number
  readonly grammarNotes: number
  readonly journalEntries: number
  readonly prompts: number
}

export function backupCounts(data: BackupData): BackupCounts {
  return {
    vocabularyEntries: data.vocabularyEntries.length,
    grammarNotes: data.grammarNotes.length,
    journalEntries: data.journalEntries.length,
    prompts: data.prompts.length,
  }
}

export function totalRecords(counts: BackupCounts): number {
  return (
    counts.vocabularyEntries +
    counts.grammarNotes +
    counts.journalEntries +
    counts.prompts
  )
}

// --- the schema -----------------------------------------------------------

const timestamp = z.iso.datetime()
const calendarDate = z.iso.date()
const id = z.string().min(1)
const tags = z.array(z.string())

const entityFields = {
  id,
  createdAt: timestamp,
  updatedAt: timestamp,
}

const form = z.string().optional()

/**
 * The Parts of Speech with an empty Paradigm. `satisfies` ties the list to the
 * domain, so a Part of Speech that is renamed there stops the build here rather
 * than turning into a backup that refuses to import.
 */
const UNINFLECTED = ['adverb', 'phrase', 'other'] as const satisfies readonly PartOfSpeech[]

const vocabularyEntryFields = {
  ...entityFields,
  lemma: z.string(),
  translation: z.string(),
  exampleSentence: z.string(),
  tags,
  lookupOutcome: z.enum(LOOKUP_OUTCOMES),
}

const vocabularyEntrySchema = z.discriminatedUnion('partOfSpeech', [
  z.object({
    ...vocabularyEntryFields,
    partOfSpeech: z.literal('noun'),
    gender: z.enum(GENDERS).optional(),
    forms: z.object({
      indefiniteSingular: form,
      definiteSingular: form,
      indefinitePlural: form,
      definitePlural: form,
    }),
  }),
  z.object({
    ...vocabularyEntryFields,
    partOfSpeech: z.literal('verb'),
    conjugationGroup: z.enum(CONJUGATION_GROUPS).optional(),
    forms: z.object({
      infinitive: form,
      present: form,
      preterite: form,
      supine: form,
    }),
  }),
  z.object({
    ...vocabularyEntryFields,
    partOfSpeech: z.literal('adjective'),
    forms: z.object({
      positiveEnForm: form,
      positiveEttForm: form,
      positivePlural: form,
    }),
  }),
  z.object({
    ...vocabularyEntryFields,
    // An adverb, phrase or other has an empty Paradigm and carries no Forms.
    partOfSpeech: z.enum(UNINFLECTED),
  }),
])

const grammarNoteSchema = z.object({
  ...entityFields,
  title: z.string(),
  body: z.string(),
  tags,
  references: z.array(z.object({ vocabularyEntryId: id })),
})

/**
 * A Pin, in both of its shapes. `pinnedAs` is required on each, because it is
 * what a Tombstone keeps once its target is gone (ADR-0001) — a file whose
 * Tombstones had lost their text would silently rewrite what a past entry
 * recorded, which is exactly the outcome the Tombstone exists to prevent.
 */
const pinSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('resolved'),
    pinnedKind: z.enum(['vocabularyEntry', 'grammarNote']),
    pinnedAs: z.string(),
    targetId: id,
  }),
  z.object({
    status: z.literal('tombstone'),
    pinnedKind: z.enum(['vocabularyEntry', 'grammarNote']),
    pinnedAs: z.string(),
  }),
])

const journalEntrySchema = z.object({
  ...entityFields,
  date: calendarDate,
  body: z.string(),
  attachedPromptId: id.optional(),
  pins: z.array(pinSchema),
  tags,
})

const promptSchema = z.discriminatedUnion('origin', [
  z.object({
    ...entityFields,
    origin: z.literal('built-in'),
    text: z.string(),
    level: z.enum(PROMPT_LEVELS),
    // Which Built-in Prompts you hid is a choice worth restoring.
    hidden: z.boolean(),
  }),
  z.object({
    ...entityFields,
    origin: z.literal('custom'),
    text: z.string(),
    level: z.enum(PROMPT_LEVELS),
    derivedFrom: id.optional(),
  }),
])

const backupDataSchema = z.object({
  vocabularyEntries: z.array(vocabularyEntrySchema),
  grammarNotes: z.array(grammarNoteSchema),
  journalEntries: z.array(journalEntrySchema),
  prompts: z.array(promptSchema),
})

const backupFileSchema = z.object({
  app: z.literal(BACKUP_APP),
  formatVersion: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  exportedAt: timestamp,
  data: backupDataSchema,
})

/**
 * The envelope alone, parsed first so that "this is someone else's JSON" and
 * "this is a newer backup than I can read" get their own message rather than a
 * wall of field errors.
 */
const envelopeSchema = z.object({
  app: z.string().optional(),
  formatVersion: z.number().optional(),
})

/**
 * Where the domain types and the schema are held together: the conversion is
 * only well-typed if what the schema parses is a valid domain object, so a
 * field that drifts apart from `src/domain/` fails the build rather than
 * producing a backup that imports into a subtly wrong record.
 */
function asBackupData(parsed: z.infer<typeof backupDataSchema>): BackupData {
  return parsed
}

// --- validation -----------------------------------------------------------

export type BackupParseResult =
  | { readonly ok: true; readonly backup: BackupFile }
  | { readonly ok: false; readonly message: string; readonly details?: string }

function failure(message: string, details?: string): BackupParseResult {
  return { ok: false, message, details }
}

/**
 * Validate a file's text, without touching the database.
 *
 * Every rejection says what is wrong and leaves the caller with nothing to
 * apply: a half-applied import is a worse outcome than a refused one.
 */
export function parseBackupFile(text: string): BackupParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    return failure(
      'That file is not valid JSON, so nothing was changed.',
      error instanceof Error ? error.message : undefined,
    )
  }

  const envelope = envelopeSchema.safeParse(json)
  if (!envelope.success || envelope.data.app !== BACKUP_APP) {
    return failure(
      `That file does not look like an ${BACKUP_APP} backup. Nothing was changed.`,
    )
  }
  if (
    envelope.data.formatVersion !== undefined &&
    envelope.data.formatVersion > BACKUP_FORMAT_VERSION
  ) {
    return failure(
      `That backup was written by a newer version of the app (format ${String(envelope.data.formatVersion)}). This version reads format ${String(BACKUP_FORMAT_VERSION)}. Nothing was changed.`,
    )
  }

  const parsed = backupFileSchema.safeParse(json)
  if (!parsed.success) {
    return failure(
      'That backup is missing or misreporting some fields, so nothing was changed.',
      z.prettifyError(parsed.error),
    )
  }

  const data = asBackupData(parsed.data.data)
  const duplicate = firstDuplicateId(data)
  if (duplicate !== undefined) {
    return failure(
      `That backup lists ${duplicate.kind} id ${duplicate.id} twice, so it cannot be restored exactly. Nothing was changed.`,
    )
  }

  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      formatVersion: parsed.data.formatVersion,
      schemaVersion: parsed.data.schemaVersion,
      exportedAt: parsed.data.exportedAt,
      data,
    },
  }
}

/**
 * Two records sharing an id would mean one silently overwriting the other on
 * import, which is a quiet loss rather than a visible failure.
 */
function firstDuplicateId(
  data: BackupData,
): { readonly kind: string; readonly id: string } | undefined {
  const kinds = [
    ['Vocabulary Entry', data.vocabularyEntries],
    ['Grammar Note', data.grammarNotes],
    ['Journal Entry', data.journalEntries],
    ['Prompt', data.prompts],
  ] as const

  for (const [kind, records] of kinds) {
    const seen = new Set<string>()
    for (const record of records) {
      if (seen.has(record.id)) return { kind, id: record.id }
      seen.add(record.id)
    }
  }
  return undefined
}

/** The envelope for a freshly made backup. */
export function backupEnvelope(data: BackupData, exportedAt: string): BackupFile {
  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    data,
  }
}
