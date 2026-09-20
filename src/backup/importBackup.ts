/**
 * Restoring a backup (#25).
 *
 * **An import replaces, it does not merge.** After it runs, the database holds
 * exactly what the file holds — nothing of what was there before survives.
 *
 * That is the honest choice for a *restore*: merging would have to guess what
 * to do when a file and the database disagree about the same id, and a wrong
 * guess would quietly rewrite a Journal Entry rather than visibly refuse. It is
 * also the dangerous choice, so two things guard it and neither is optional:
 *
 * - The file is validated **in full, before the database is opened for
 *   writing** ({@link parseBackupFile}). A malformed file is refused with a
 *   message and changes nothing.
 * - The replacement happens inside **one** read-write transaction. If any
 *   record fails to write, the transaction aborts and the existing data is
 *   exactly as it was. There is no state in which half a backup has landed.
 *
 * The screen that calls this says plainly what will be replaced, and offers a
 * backup of the current data first. See `SettingsScreen.tsx`.
 *
 * Links are restored as written. A Reference, a resolved Pin and a Tombstone
 * are all carried across untouched — including a Pin whose target is not in the
 * file, which stays exactly as it is rather than being quietly rewritten into
 * something else.
 */

import {
  encodeGrammarNote,
  encodeJournalEntry,
  encodePrompt,
  encodeVocabularyEntry,
  request,
  STORES,
  withStores,
} from '../data/index.ts'
import type { BackupCounts, BackupFile } from './backupFile.ts'
import { backupCounts, parseBackupFile } from './backupFile.ts'
import { noteBackupImported } from './exportReminder.ts'

/**
 * Replace everything stored with what the backup holds.
 *
 * Takes an already-validated {@link BackupFile}: there is no path from raw text
 * to the database that skips {@link parseBackupFile}.
 */
export async function applyBackup(backup: BackupFile): Promise<BackupCounts> {
  const { data } = backup

  await withStores(
    [STORES.vocabularyEntries, STORES.grammarNotes, STORES.journalEntries, STORES.prompts],
    'readwrite',
    async (transaction) => {
      const vocabulary = transaction.objectStore(STORES.vocabularyEntries)
      const grammarNotes = transaction.objectStore(STORES.grammarNotes)
      const journalEntries = transaction.objectStore(STORES.journalEntries)
      const prompts = transaction.objectStore(STORES.prompts)

      await request(vocabulary.clear())
      await request(grammarNotes.clear())
      await request(journalEntries.clear())
      await request(prompts.clear())

      for (const entry of data.vocabularyEntries) {
        await request(vocabulary.add(encodeVocabularyEntry(entry)))
      }
      for (const note of data.grammarNotes) {
        await request(grammarNotes.add(encodeGrammarNote(note)))
      }
      for (const entry of data.journalEntries) {
        await request(journalEntries.add(encodeJournalEntry(entry)))
      }
      for (const prompt of data.prompts) {
        await request(prompts.add(encodePrompt(prompt)))
      }
    },
  )

  // The data is now as recent as the file, so the reminder should say so.
  noteBackupImported(backup.exportedAt)

  return backupCounts(data)
}

export type ImportResult =
  | { readonly ok: true; readonly counts: BackupCounts }
  | { readonly ok: false; readonly message: string; readonly details?: string }

/**
 * Validate a file's text and, only if it is sound, replace everything with it.
 * A rejection here has left the database untouched.
 */
export async function importBackupFromText(text: string): Promise<ImportResult> {
  const parsed = parseBackupFile(text)
  if (!parsed.ok) return parsed
  return { ok: true, counts: await applyBackup(parsed.backup) }
}
