/**
 * Making a backup: reading everything out of the database and handing it over
 * as a file (#24).
 *
 * The read runs in **one** read-only transaction across all four stores, so the
 * file is a consistent snapshot rather than four reads that could disagree if
 * something were written between them.
 */

import {
  getAllRecords,
  now,
  request,
  STORES,
  withStores,
} from '../data/index.ts'
import type {
  GrammarNote,
  JournalEntry,
  Prompt,
  VocabularyEntry,
} from '../domain/index.ts'
import type { BackupCounts, BackupData, BackupFile } from './backupFile.ts'
import { BACKUP_APP, backupEnvelope } from './backupFile.ts'
import { recordExport } from './exportReminder.ts'

const BACKED_UP_STORES = [
  STORES.vocabularyEntries,
  STORES.grammarNotes,
  STORES.journalEntries,
  STORES.prompts,
] as const

/** Everything currently stored, as it would be written to a file. */
export function readBackupData(): Promise<BackupData> {
  return withStores(BACKED_UP_STORES, 'readonly', async (transaction) => ({
    vocabularyEntries: await getAllRecords<VocabularyEntry>(
      transaction.objectStore(STORES.vocabularyEntries),
    ),
    grammarNotes: await getAllRecords<GrammarNote>(
      transaction.objectStore(STORES.grammarNotes),
    ),
    journalEntries: await getAllRecords<JournalEntry>(
      transaction.objectStore(STORES.journalEntries),
    ),
    prompts: await getAllRecords<Prompt>(transaction.objectStore(STORES.prompts)),
  }))
}

export async function createBackup(exportedAt: string = now()): Promise<BackupFile> {
  return backupEnvelope(await readBackupData(), exportedAt)
}

/** How much is stored, without reading any of it. For the import warning. */
export function countStoredRecords(): Promise<BackupCounts> {
  return withStores(BACKED_UP_STORES, 'readonly', async (transaction) => ({
    vocabularyEntries: await request(
      transaction.objectStore(STORES.vocabularyEntries).count(),
    ),
    grammarNotes: await request(transaction.objectStore(STORES.grammarNotes).count()),
    journalEntries: await request(transaction.objectStore(STORES.journalEntries).count()),
    prompts: await request(transaction.objectStore(STORES.prompts).count()),
  }))
}

/** Indented on purpose: a backup you can open and read is easier to trust. */
export function serialiseBackup(backup: BackupFile): string {
  return `${JSON.stringify(backup, null, 2)}\n`
}

/** `n-stan-app-backup-2026-09-20-1432.json` — sortable, and unique per minute. */
export function backupFileName(exportedAt: string): string {
  const stamp = exportedAt.replace(/[-:]/gu, '').replace(/\.\d+Z?$/u, '')
  const [date, time = ''] = stamp.split('T')
  const day = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  return `${BACKUP_APP}-backup-${day}-${time.slice(0, 4)}.json`
}

/**
 * Make a backup and hand it to the browser as a download.
 *
 * The export is only recorded — and so the reminder only reset — once the file
 * has actually been offered, never merely because the button was pressed.
 */
export async function downloadBackup(): Promise<BackupFile> {
  const backup = await createBackup()
  const blob = new Blob([serialiseBackup(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName(backup.exportedAt)
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    // Give the download a tick to start before the blob goes away.
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 10_000)
  }
  recordExport(backup.exportedAt)
  return backup
}
