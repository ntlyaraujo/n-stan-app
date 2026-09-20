/**
 * The warning shown before a delete (#34): what is about to lose its link.
 *
 * This is the screen for the non-cascading delete built and tested in the data
 * layer (spec 3.6, ADR-0001). `deletionImpactForVocabularyEntry` and
 * `deletionImpactForGrammarNote` report exactly what this renders, so the
 * warning cannot drift away from what the delete then does.
 *
 * **The two consequences are different on purpose and are named separately.**
 *
 * - A **Grammar Note** loses the **Reference** outright. A note about ett-words
 *   that stops pointing at one word is still the same explanation.
 * - A **Journal Entry** keeps the **Pin** as a **Tombstone**: the Lemma or title
 *   it was made with, held as plain text and no longer linked, because a record
 *   of what you practiced must not change months after the fact.
 *
 * Flattening those two into one "3 items will be affected" line would lose the
 * only thing worth saying here. And the tone matters as much as the list: the
 * reassurance — *nothing listed here is deleted* — is the headline, not the
 * small print, because this is not a generic destructive-action dialog. The one
 * thing that disappears is the link.
 *
 * It is shared: the Grammar Note and the Vocabulary Entry deletes both use it,
 * and it replaces the stopgap confirm that #20 left behind on
 * `VocabularyEntryDetail`.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { DeletionImpact } from '../data/index.ts'
import { formatDate } from '../screens/journal/journalDates.ts'
import { BUTTON, BUTTON_DANGER, FOCUS_RING } from './styles.ts'

type Deleting = 'vocabularyEntry' | 'grammarNote'

const KIND_LABEL: Record<Deleting, string> = {
  vocabularyEntry: 'Vocabulary Entry',
  grammarNote: 'Grammar Note',
}

/** What a Pin left behind by this delete would hold, in the writer's words. */
const KEPT_AS: Record<Deleting, string> = {
  vocabularyEntry: 'the Lemma',
  grammarNote: 'the title',
}

function count(n: number, singular: string, plural: string): string {
  return `${String(n)} ${n === 1 ? singular : plural}`
}

function Consequence({
  heading,
  explanation,
  children,
}: {
  heading: string
  explanation: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <p className="text-sm font-medium text-text">{heading}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{explanation}</p>
      <ul className="mt-2 flex flex-col gap-1">{children}</ul>
    </div>
  )
}

export function DeletionWarning({
  deleting,
  name,
  impact,
  deletingNow,
  onConfirm,
  onCancel,
}: {
  deleting: Deleting
  /** The Lemma or title being deleted — and, for a Pin, what survives as text. */
  name: string
  /** Null while the impact is still being read. */
  impact: DeletionImpact | null
  deletingNow: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const notes = impact?.grammarNotes ?? []
  const entries = impact?.journalEntries ?? []
  const nothingLinked = impact !== null && notes.length === 0 && entries.length === 0

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger bg-danger-soft p-4">
      <div>
        <p className="text-sm font-semibold text-text">
          Delete the {KIND_LABEL[deleting]} “{name}”?
        </p>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          {impact === null
            ? 'Checking what links to it…'
            : nothingLinked
              ? 'Nothing links to it. Only this ' +
                KIND_LABEL[deleting] +
                ' goes; there is nothing else to lose.'
              : 'Deleting never cascades. Nothing listed below is deleted, edited or ' +
                'moved — each one only loses the link. Your writing stays exactly as ' +
                'you left it.'}
        </p>
      </div>

      {notes.length > 0 ? (
        <Consequence
          heading={`${count(notes.length, 'Grammar Note loses', 'Grammar Notes lose')} the Reference`}
          explanation={
            'The Reference goes and the note stays whole. An explanation that stops ' +
            'pointing at one word is still the same explanation.'
          }
        >
          {notes.map((note) => (
            <li key={note.id}>
              <Link
                to={`/grammar/${note.id}`}
                className={`text-sm text-accent underline underline-offset-2 hover:text-accent-hover ${FOCUS_RING}`}
              >
                {note.title === '' ? 'Untitled Grammar Note' : note.title}
              </Link>
            </li>
          ))}
        </Consequence>
      ) : null}

      {entries.length > 0 ? (
        <Consequence
          heading={`${count(entries.length, 'Journal Entry keeps', 'Journal Entries keep')} the Pin as a Tombstone`}
          explanation={
            `Each one keeps ${KEPT_AS[deleting]} — “${name}” — as plain text, no longer ` +
            'linked. A record of what you practiced must not change months after the fact.'
          }
        >
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2">
              <Link
                to={`/journal/${entry.id}`}
                className={`text-sm text-accent underline underline-offset-2 hover:text-accent-hover ${FOCUS_RING}`}
              >
                {formatDate(entry.date)}
              </Link>
              {entry.preview === '' ? null : (
                <span className="truncate text-xs text-text-muted" lang="sv">
                  {entry.preview}
                </span>
              )}
            </li>
          ))}
        </Consequence>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON_DANGER}
          disabled={impact === null || deletingNow}
          onClick={onConfirm}
        >
          {deletingNow ? 'Deleting…' : `Delete the ${KIND_LABEL[deleting]}`}
        </button>
        <button type="button" className={BUTTON} disabled={deletingNow} onClick={onCancel}>
          Keep it
        </button>
      </div>
    </div>
  )
}
