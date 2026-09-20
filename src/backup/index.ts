/**
 * Durability: the things that stop months of writing disappearing (spec 6).
 *
 * Local-only storage has one real failure mode — the browser evicts the
 * database, or Safari clears site data for a site left unopened — and this
 * directory is the whole answer to it:
 *
 * - `persistentStorage.ts` (#23) — ask the browser not to evict us.
 * - `backupFile.ts` (#24, #25) — what a backup contains, and the validation an
 *   import runs before the database is touched.
 * - `exportBackup.ts` (#24) — read everything out; hand it over as a file.
 * - `importBackup.ts` (#25) — **replace** everything with a validated file, in
 *   one transaction, or change nothing at all.
 * - `exportReminder.ts` (#26) — how long since the last backup, and when to say
 *   so. `ExportReminderNotice.tsx` is the notice itself; it is imported
 *   directly, because a component does not belong in a barrel file.
 * - `markdownExport.ts` (#44) — the other export: one readable document, lossy
 *   and not re-importable, so that the writing is never trapped in an app only
 *   you run. It deliberately does not reset the reminder above.
 */

export * from './backupFile.ts'
export * from './exportBackup.ts'
export * from './markdownExport.ts'
export * from './exportReminder.ts'
export * from './importBackup.ts'
export * from './persistentStorage.ts'
