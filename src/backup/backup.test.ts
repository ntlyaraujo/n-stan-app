/**
 * Backup: the round-trip, and the refusals.
 *
 * An export you cannot restore is not a backup, so the first test here is the
 * whole point of the phase — export, wipe, import, and get *identical* data
 * back, Tombstones and hidden Built-in Prompts included. The rest guard the
 * other half of the bargain: a file that is wrong in any way must change
 * nothing at all, because a half-applied import is worse than a refused one.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { deleteDatabase } from '../data/db.ts'
import { deleteVocabularyEntry, pinToJournalEntry } from '../data/links.ts'
import { createGrammarNote } from '../data/grammarNoteRepository.ts'
import { createJournalEntry } from '../data/journalEntryRepository.ts'
import {
  createCustomPrompt,
  listPrompts,
  seedBuiltInPrompts,
  setBuiltInPromptHidden,
} from '../data/promptRepository.ts'
import { createVocabularyEntry } from '../data/vocabularyRepository.ts'
import { isBuiltInPrompt } from '../domain/prompt.ts'
import type { BackupFile } from './backupFile.ts'
import { parseBackupFile } from './backupFile.ts'
import {
  backupFileName,
  countStoredRecords,
  createBackup,
  readBackupData,
  serialiseBackup,
} from './exportBackup.ts'
import { applyBackup, importBackupFromText } from './importBackup.ts'
import {
  daysBetween,
  EXPORT_REMINDER_DAYS,
  isExportOverdue,
} from './exportReminder.ts'

beforeEach(async () => {
  await deleteDatabase()
})

/**
 * A database with one of everything worth losing: a Complete noun, a verb, a
 * Grammar Note that References a word, two Journal Entries, a Custom Prompt, a
 * hidden Built-in Prompt, a resolved Pin and — via a delete — a Tombstone.
 */
async function seedEverything() {
  await seedBuiltInPrompts()

  const bok = await createVocabularyEntry({
    lemma: 'bok',
    translation: 'book',
    exampleSentence: 'Jag läser en bok.',
    partOfSpeech: 'noun',
    gender: 'en',
    tags: ['substantiv', 'Vardag'],
    forms: {
      indefiniteSingular: 'bok',
      definiteSingular: 'boken',
      indefinitePlural: 'böcker',
      definitePlural: 'böckerna',
    },
  })

  const tala = await createVocabularyEntry({
    lemma: 'tala',
    translation: 'to speak',
    exampleSentence: 'Vi talar svenska.',
    partOfSpeech: 'verb',
    conjugationGroup: '1',
    tags: ['verb'],
    forms: { infinitive: 'tala', present: 'talar' },
  })

  const note = await createGrammarNote({
    title: 'En and ett',
    body: '## Gender\n\nSwedish nouns take *en* or *ett*.',
    tags: ['grammatik'],
    references: [{ vocabularyEntryId: bok.entry.id }],
  })

  const custom = await createCustomPrompt({ text: 'Beskriv din morgon.', level: 'beginner' })

  const prompts = await listPrompts()
  const firstBuiltIn = prompts.find(isBuiltInPrompt)
  if (firstBuiltIn === undefined) throw new Error('Expected a Built-in Prompt to exist')
  await setBuiltInPromptHidden(firstBuiltIn.id, true)

  const monday = await createJournalEntry({
    date: '2026-09-14',
    body: 'Idag läste jag en bok.',
    attachedPromptId: custom.id,
    tags: ['dagbok'],
    pins: [],
  })
  await pinToJournalEntry(monday.id, 'vocabularyEntry', bok.entry.id)
  await pinToJournalEntry(monday.id, 'grammarNote', note.id)

  const tuesday = await createJournalEntry({
    date: '2026-09-15',
    body: 'Vi talade svenska hela dagen.',
    tags: [],
    pins: [],
  })
  await pinToJournalEntry(tuesday.id, 'vocabularyEntry', tala.entry.id)

  // Deleting the word leaves Tuesday's Pin as a Tombstone: the record of what
  // was practiced must survive the word (ADR-0001).
  await deleteVocabularyEntry(tala.entry.id)

  return { bokId: bok.entry.id, noteId: note.id, mondayId: monday.id, tuesdayId: tuesday.id }
}

describe('export', () => {
  it('writes out everything, including hidden Built-in Prompts and Tombstones', async () => {
    await seedEverything()
    const backup = await createBackup()

    expect(backup.app).toBe('n-stan-app')
    expect(backup.formatVersion).toBe(1)

    expect(backup.data.vocabularyEntries).toHaveLength(1)
    expect(backup.data.grammarNotes).toHaveLength(1)
    expect(backup.data.journalEntries).toHaveLength(2)

    const hidden = backup.data.prompts.filter((prompt) => isBuiltInPrompt(prompt) && prompt.hidden)
    expect(hidden).toHaveLength(1)

    const tombstones = backup.data.journalEntries.flatMap((entry) =>
      entry.pins.filter((pin) => pin.status === 'tombstone'),
    )
    expect(tombstones).toEqual([{ status: 'tombstone', pinnedKind: 'vocabularyEntry', pinnedAs: 'tala' }])
  })

  it('carries no index-only fields into the file', async () => {
    await seedEverything()
    const serialised = serialiseBackup(await createBackup())
    expect(serialised).not.toContain('tagKeys')
    expect(serialised).not.toContain('referenceIds')
    expect(serialised).not.toContain('pinTargetIds')
  })

  it('names the file by the day and minute it was taken', () => {
    expect(backupFileName('2026-09-20T14:32:07.881Z')).toBe(
      'n-stan-app-backup-2026-09-20-1432.json',
    )
  })
})

describe('round trip', () => {
  it('restores identical data, links and Tombstones included', async () => {
    await seedEverything()
    const exported = await createBackup()
    const text = serialiseBackup(exported)

    // Everything gone, as an eviction would leave it.
    await deleteDatabase()
    expect(await countStoredRecords()).toEqual({
      vocabularyEntries: 0,
      grammarNotes: 0,
      journalEntries: 0,
      prompts: 0,
    })

    const result = await importBackupFromText(text)
    expect(result.ok).toBe(true)

    const restored = await readBackupData()
    expect(restored).toEqual(exported.data)

    // Spelled out, because these are the two that a shape-only backup would
    // quietly drop: the Pin that outlived its word, and a hidden Built-in Prompt.
    expect(restored.journalEntries.flatMap((entry) => entry.pins)).toEqual(
      exported.data.journalEntries.flatMap((entry) => entry.pins),
    )
    expect(restored.prompts.filter((prompt) => isBuiltInPrompt(prompt) && prompt.hidden)).toHaveLength(1)
  })

  it('restores over a different database rather than merging into it', async () => {
    await seedEverything()
    const exported = await createBackup()

    // A second life with unrelated writing in it.
    await deleteDatabase()
    await seedBuiltInPrompts()
    await createVocabularyEntry({
      lemma: 'hund',
      translation: 'dog',
      exampleSentence: 'En hund skäller.',
      partOfSpeech: 'noun',
      tags: [],
      forms: {},
    })

    await applyBackup(exported)
    const after = await readBackupData()

    expect(after).toEqual(exported.data)
    expect(after.vocabularyEntries.map((entry) => entry.lemma)).toEqual(['bok'])
  })

  it('survives a second round trip unchanged', async () => {
    await seedEverything()
    const first = await createBackup()
    await importBackupFromText(serialiseBackup(first))
    const second = await createBackup()
    expect(second.data).toEqual(first.data)
  })
})

describe('validation', () => {
  async function storedNow() {
    return { counts: await countStoredRecords(), data: await readBackupData() }
  }

  /**
   * A backup as a plain, mutable object, so a test can break one field of an
   * otherwise valid file — which is the interesting case, far more than a file
   * that is obviously rubbish.
   */
  interface LooseBackup {
    formatVersion: number
    data: {
      vocabularyEntries: { partOfSpeech: unknown }[]
      grammarNotes: Record<string, unknown>[]
      journalEntries: { date: unknown; pins: Record<string, unknown>[] }[]
      prompts: Record<string, unknown>[]
    }
  }

  function loosen(backup: BackupFile): LooseBackup {
    return JSON.parse(JSON.stringify(backup)) as LooseBackup
  }

  it('refuses text that is not JSON, and changes nothing', async () => {
    await seedEverything()
    const before = await storedNow()

    const result = await importBackupFromText('{ this is not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('not valid JSON')
    expect(await storedNow()).toEqual(before)
  })

  it("refuses another app's JSON", async () => {
    const result = parseBackupFile(JSON.stringify({ notes: ['hello'] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('does not look like')
  })

  it('refuses a backup written by a newer format, saying so', async () => {
    await seedEverything()
    const backup = await createBackup()
    const before = await storedNow()

    const result = await importBackupFromText(
      JSON.stringify({ ...backup, formatVersion: backup.formatVersion + 1 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('newer version')
    expect(await storedNow()).toEqual(before)
  })

  it('refuses a malformed record without mutating the database', async () => {
    await seedEverything()
    const backup = await createBackup()
    const before = await storedNow()

    const broken = loosen(backup)
    broken.data.journalEntries[0].date = 'yesterday'

    const result = await importBackupFromText(JSON.stringify(broken))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('nothing was changed')
      expect(result.details).toContain('journalEntries')
    }
    expect(await storedNow()).toEqual(before)
  })

  it('refuses a Tombstone that has lost the text it recorded', async () => {
    await seedEverything()
    const backup = await createBackup()
    const before = await storedNow()

    const broken = loosen(backup)
    for (const entry of broken.data.journalEntries) {
      for (const pin of entry.pins) {
        if (pin.status === 'tombstone') delete pin.pinnedAs
      }
    }

    const result = await importBackupFromText(JSON.stringify(broken))
    expect(result.ok).toBe(false)
    expect(await storedNow()).toEqual(before)
  })

  it('refuses a file that lists one id twice', async () => {
    await seedEverything()
    const backup = await createBackup()
    const before = await storedNow()

    const doubled = loosen(backup)
    doubled.data.grammarNotes = [
      ...doubled.data.grammarNotes,
      ...doubled.data.grammarNotes,
    ]

    const result = await importBackupFromText(JSON.stringify(doubled))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('twice')
    expect(await storedNow()).toEqual(before)
  })

  it('refuses an unknown Part of Speech rather than storing it', async () => {
    await seedEverything()
    const backup = await createBackup()
    const before = await storedNow()

    const broken = loosen(backup)
    broken.data.vocabularyEntries[0].partOfSpeech = 'pronoun'

    expect((await importBackupFromText(JSON.stringify(broken))).ok).toBe(false)
    expect(await storedNow()).toEqual(before)
  })

  it('accepts an empty but well-formed backup', async () => {
    await seedEverything()
    const result = await importBackupFromText(
      JSON.stringify({
        app: 'n-stan-app',
        formatVersion: 1,
        schemaVersion: 1,
        exportedAt: '2026-09-20T10:00:00.000Z',
        data: { vocabularyEntries: [], grammarNotes: [], journalEntries: [], prompts: [] },
      }),
    )
    expect(result.ok).toBe(true)
    expect(await countStoredRecords()).toEqual({
      vocabularyEntries: 0,
      grammarNotes: 0,
      journalEntries: 0,
      prompts: 0,
    })
  })
})

describe('export reminder', () => {
  const firstSeenAt = '2026-09-01T09:00:00.000Z'

  function daysAfter(iso: string, days: number): string {
    return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString()
  }

  it('stays quiet until the interval has passed', () => {
    const state = { firstSeenAt }
    expect(isExportOverdue(state, daysAfter(firstSeenAt, EXPORT_REMINDER_DAYS - 1))).toBe(false)
    expect(isExportOverdue(state, daysAfter(firstSeenAt, EXPORT_REMINDER_DAYS))).toBe(true)
  })

  it('counts from the last export once there has been one', () => {
    const lastExportAt = daysAfter(firstSeenAt, 20)
    const state = { firstSeenAt, lastExportAt }
    expect(isExportOverdue(state, daysAfter(lastExportAt, 1))).toBe(false)
    expect(isExportOverdue(state, daysAfter(lastExportAt, EXPORT_REMINDER_DAYS))).toBe(true)
  })

  it('holds off while snoozed, and comes back afterwards', () => {
    const at = daysAfter(firstSeenAt, 30)
    const state = { firstSeenAt, snoozedUntil: daysAfter(at, 3) }
    expect(isExportOverdue(state, at)).toBe(false)
    expect(isExportOverdue(state, daysAfter(at, 4))).toBe(true)
  })

  it('measures whole days between two instants', () => {
    expect(daysBetween(firstSeenAt, daysAfter(firstSeenAt, 2.5))).toBeCloseTo(2.5)
    expect(daysBetween(daysAfter(firstSeenAt, 2), firstSeenAt)).toBe(0)
  })
})
