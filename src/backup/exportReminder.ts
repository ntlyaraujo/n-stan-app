/**
 * The export reminder (#26, spec 6).
 *
 * Storage is local-only and can be evicted, so the gap since the last backup is
 * the gap you would lose. This tracks that gap and, after
 * {@link EXPORT_REMINDER_DAYS}, asks for a backup — as a notice you can ignore
 * or dismiss, never a dialog that stops you writing. A reminder that blocks the
 * journal would be a worse bug than the one it is guarding against.
 *
 * The clock starts at the first run rather than at the first export, so a
 * database that has never been backed up is still nudged; and it is only ever
 * shown when there is writing to lose, which deliberately does not count the
 * Built-in Prompts every install already has.
 */

import { countStoredRecords } from './exportBackup.ts'
import { clearPreference, readPreference, writePreference } from './localPreferences.ts'

/** How long without a backup before the notice appears. */
export const EXPORT_REMINDER_DAYS = 14

/** How long "Not now" holds it off. Short enough to still be a reminder. */
export const EXPORT_REMINDER_SNOOZE_DAYS = 3

const LAST_EXPORT_KEY = 'lastExportAt'
const SNOOZED_UNTIL_KEY = 'exportReminderSnoozedUntil'
const FIRST_SEEN_KEY = 'firstSeenAt'

export interface ExportReminderState {
  /** When a backup was last taken, or restored from. Absent means never. */
  readonly lastExportAt?: string
  readonly snoozedUntil?: string
  /** When this browser first ran the app: the clock's start when nothing else is. */
  readonly firstSeenAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, (end - start) / DAY_MS)
}

/**
 * Read the state, starting the clock on first run.
 *
 * `firstSeenAt` is written the first time it is missing, which is why this is
 * called on boot as well as when the notice renders.
 */
export function readExportReminderState(atIso: string = new Date().toISOString()): ExportReminderState {
  const firstSeenAt = readPreference(FIRST_SEEN_KEY)
  if (firstSeenAt === undefined) writePreference(FIRST_SEEN_KEY, atIso)
  return {
    lastExportAt: readPreference(LAST_EXPORT_KEY),
    snoozedUntil: readPreference(SNOOZED_UNTIL_KEY),
    firstSeenAt: firstSeenAt ?? atIso,
  }
}

/** A backup has just been taken. Clears any snooze along with it. */
export function recordExport(atIso: string = new Date().toISOString()): void {
  writePreference(LAST_EXPORT_KEY, atIso)
  clearPreference(SNOOZED_UNTIL_KEY)
}

/**
 * A backup has just been *restored*. The data is now exactly as recent as the
 * file, so the file's own date — not today's — is what the reminder counts
 * from, and only if it is more recent than what is already recorded.
 */
export function noteBackupImported(exportedAtIso: string): void {
  const current = readPreference(LAST_EXPORT_KEY)
  if (current !== undefined && Date.parse(current) >= Date.parse(exportedAtIso)) return
  writePreference(LAST_EXPORT_KEY, exportedAtIso)
}

export function snoozeExportReminder(atIso: string = new Date().toISOString()): void {
  const until = new Date(Date.parse(atIso) + EXPORT_REMINDER_SNOOZE_DAYS * DAY_MS)
  writePreference(SNOOZED_UNTIL_KEY, until.toISOString())
}

/** Whether the gap since the last backup has grown long enough to mention. */
export function isExportOverdue(
  state: ExportReminderState,
  atIso: string = new Date().toISOString(),
): boolean {
  if (state.snoozedUntil !== undefined && Date.parse(state.snoozedUntil) > Date.parse(atIso)) {
    return false
  }
  return daysBetween(state.lastExportAt ?? state.firstSeenAt, atIso) >= EXPORT_REMINDER_DAYS
}

/**
 * Whether there is writing that a backup would save. The Built-in Prompts every
 * install ships with are not writing, so they do not count — otherwise a brand
 * new install would eventually be nudged to back up nothing at all.
 */
export async function hasWritingToLose(): Promise<boolean> {
  const counts = await countStoredRecords()
  return counts.vocabularyEntries + counts.grammarNotes + counts.journalEntries > 0
}

export interface ExportReminder extends ExportReminderState {
  /** Show the notice. Overdue, and there is something to lose. */
  readonly due: boolean
  readonly daysSinceExport?: number
}

export async function checkExportReminder(
  atIso: string = new Date().toISOString(),
): Promise<ExportReminder> {
  const state = readExportReminderState(atIso)
  const overdue = isExportOverdue(state, atIso)
  return {
    ...state,
    due: overdue && (await hasWritingToLose()),
    daysSinceExport:
      state.lastExportAt === undefined
        ? undefined
        : Math.floor(daysBetween(state.lastExportAt, atIso)),
  }
}
