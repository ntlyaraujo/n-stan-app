/**
 * The Backlinks on a Vocabulary Entry (#33): the Grammar Notes that Reference
 * this word.
 *
 * This is the payoff of the explicit picker in #32 — one deliberate link, made
 * once on the note, visible from both ends. A Backlink is derived on read and
 * never stored, so there is nothing here to create, edit or keep in step: the
 * only way to add one is to pick the word on a Grammar Note, and the only way
 * to remove one is to unpick it there.
 *
 * Nothing renders when no note References the word. An empty card would be
 * noise on a screen that already has plenty to say, and this section is shared
 * with #43 (the Journal Entries that used the word).
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { backlinksForVocabularyEntry } from '../data/index.ts'
import type { Backlink } from '../domain/index.ts'
import { FOCUS_RING } from './styles.ts'

export function VocabularyBacklinks({ vocabularyEntryId }: { vocabularyEntryId: string }) {
  const [backlinks, setBacklinks] = useState<readonly Backlink[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const found = await backlinksForVocabularyEntry(vocabularyEntryId)
      if (!cancelled) setBacklinks(found)
    })()
    return () => {
      cancelled = true
    }
  }, [vocabularyEntryId])

  if (backlinks.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4">
      <div>
        <p className="text-sm font-medium text-text">
          {backlinks.length === 1 ? 'Grammar Note' : 'Grammar Notes'}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {backlinks.length === 1
            ? 'This note References the word.'
            : `${String(backlinks.length)} notes Reference this word.`}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {backlinks.map((backlink) => (
          <li key={backlink.grammarNoteId}>
            <Link
              to={`/grammar/${backlink.grammarNoteId}`}
              className={`block rounded-lg border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-border-strong hover:bg-surface-sunken ${FOCUS_RING}`}
            >
              {backlink.title === '' ? 'Untitled Grammar Note' : backlink.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
