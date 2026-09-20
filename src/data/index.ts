/**
 * The data layer. Everything stored, queried and linked goes through here —
 * import from `src/data/index.ts` rather than from a repository file, and never
 * open IndexedDB yourself.
 *
 * Where things live:
 *
 * - `db.ts` — the schema, its version and the migration path. Also
 *   `deleteDatabase`, for a reset.
 * - `vocabularyRepository.ts` — Vocabulary Entries, including the duplicate
 *   Lemma warning, which never blocks a write.
 * - `grammarNoteRepository.ts`, `journalEntryRepository.ts`,
 *   `promptRepository.ts` — the other three.
 * - `links.ts` — References, Backlinks, Pins, and every delete that has to
 *   Unlink. Deleting a Vocabulary Entry or a Grammar Note lives there rather
 *   than in its repository, because a delete that skipped the Unlinking would
 *   silently lose writing.
 * - `dictionaryCache.ts` — cached Lookups.
 */

export * from './db.ts'
export * from './builtInPrompts.ts'
export * from './vocabularyRepository.ts'
export * from './grammarNoteRepository.ts'
export * from './journalEntryRepository.ts'
export * from './promptRepository.ts'
export * from './links.ts'
export * from './dictionaryCache.ts'
