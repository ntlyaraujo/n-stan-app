/**
 * The last direction of the loop (#43): the Journal Entries that Pinned this
 * Vocabulary Entry, shown on the word itself.
 *
 * Capture, use in writing, review through what it connects to. This sits beside
 * the Backlinks of #33 — the Grammar Notes that explain the word — so the two
 * halves of what a word is attached to read as one answer: what it belongs to,
 * and where you actually used it.
 *
 * A Pin is the record that you practiced the word, so this list is also how a
 * word earns its keep. Tombstones never appear here: a Tombstone is text rather
 * than a link, and it lives on the Journal Entry that made it.
 *
 * Nothing renders when the word has never been Pinned. An empty card would be
 * noise on a screen that already has plenty to say.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { journalEntriesPinning, journalEntryPreview } from '../data/index.ts'
import type { JournalEntry } from '../domain/index.ts'
import { dayHeading, formatTimeWritten } from '../screens/journal/journalDates.ts'
import { CARD, FOCUS_RING } from './styles.ts'

export function PinnedInJournalEntries({ vocabularyEntryId }: { vocabularyEntryId: string }) {
  const [entries, setEntries] = useState<readonly JournalEntry[]>([])

  useEffect(() => {
    let cancelled = false
    void journalEntriesPinning(vocabularyEntryId).then((found) => {
      if (!cancelled) setEntries(found)
    })
    return () => {
      cancelled = true
    }
  }, [vocabularyEntryId])

  if (entries.length === 0) return null

  return (
    <div className={`${CARD} flex flex-col gap-3 p-4`}>
      <div>
        <p className="text-sm font-medium text-text">
          {entries.length === 1 ? 'Journal Entry' : 'Journal Entries'}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {entries.length === 1
            ? 'You Pinned this word while writing this entry.'
            : `You Pinned this word while writing ${String(entries.length)} entries.`}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const preview = journalEntryPreview(entry)
          return (
            <li key={entry.id}>
              <Link
                to={`/journal/${entry.id}`}
                className={`block rounded-lg border border-border px-3 py-2 transition-colors hover:border-border-strong hover:bg-surface-sunken ${FOCUS_RING}`}
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-text">{dayHeading(entry.date)}</span>
                  <span className="text-xs text-text-muted">
                    {formatTimeWritten(entry.createdAt)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-text-muted" lang="sv">
                  {preview === '' ? 'Nothing written in this entry' : preview}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
