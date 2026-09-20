import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { formatDate, formatWrittenAt, relativeDayLabel } from './journalDates.ts'
import { TagField } from '../../components/TagField.tsx'
import { PinPanel } from './PinPanel.tsx'
import { PromptPicker } from './PromptPicker.tsx'
import { SplitView } from './SplitView.tsx'
import { useJournalEntryEditor, type SaveState } from './useJournalEntryEditor.ts'
import { BUTTON, BUTTON_DANGER, BUTTON_QUIET, INPUT, LABEL } from './journalStyles.ts'

/**
 * Writing one Journal Entry (#37), with its optional Attached Prompt (#38) and
 * the panel of Vocabulary and Grammar Notes beside it (#40–#42). Serves both
 * `/journal/new` and `/journal/:journalEntryId`.
 *
 * **One undivided Swedish field, and no title.** There is deliberately no
 * English field beside it: the point of the method is to write in Swedish
 * without translating as you go, and a second box invites exactly that. What you
 * could not express has somewhere to go instead — pin the word you looked up,
 * and the entry records that you practiced it.
 *
 * The Date is the day the entry belongs to and is yours to change. The creation
 * timestamp is separate, shown below it, and never edited.
 *
 * Typing autosaves — see `useJournalEntryEditor` for how hard it tries. A Pin is
 * written by `links.ts` rather than from here, and goes through the editor's own
 * queue via `writeToEntry` so the two can never overwrite each other.
 */
export function JournalEntryScreen() {
  const { status, fields, saveState, entry, update, saveNow, remove, writeToEntry } =
    useJournalEntryEditor()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const dateId = useId()
  const bodyId = useId()

  if (status === 'loading') {
    return (
      <EditorFrame>
        <p className="text-sm text-text-muted">Loading…</p>
      </EditorFrame>
    )
  }

  if (status === 'missing') {
    return (
      <EditorFrame>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          This Journal Entry is gone
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          It may have been deleted on this device, or never existed.
        </p>
        <Link to="/journal" className={`${BUTTON} mt-4`}>
          Back to the Journal
        </Link>
      </EditorFrame>
    )
  }

  return (
    <SplitView
      pins={entry?.pins ?? []}
      panel={({ onClose }) => (
        <PinPanel journalEntryId={entry?.id} onWrite={writeToEntry} onClose={onClose} />
      )}
    >
      {/* The extra bottom padding is for the Pins bar, which sits along the
          bottom edge of the writing on a narrow screen. */}
      <EditorFrame className="pb-24 lg:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/journal" className={BUTTON_QUIET}>
            ← Journal
          </Link>
          <SaveStatus state={saveState} hasEntry={entry !== undefined} onRetry={saveNow} />
        </div>

        <h1 className="mt-2 text-xl font-semibold tracking-tight text-text sm:text-2xl">
          {relativeDayLabel(fields.date) ?? formatDate(fields.date)}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {entry === undefined
            ? 'A new Journal Entry. It is saved as soon as you write something, or Pin one.'
            : `Written on ${formatWrittenAt(entry.createdAt)}.`}
        </p>

        <div className="mt-5 space-y-4">
          <div className="sm:max-w-56">
            <label className={LABEL} htmlFor={dateId}>
              Date
            </label>
            <input
              id={dateId}
              type="date"
              value={fields.date}
              onChange={(event) => {
                if (event.target.value !== '') update({ date: event.target.value })
              }}
              className={`${INPUT} mt-1.5`}
            />
          </div>

          <PromptPicker
            attachedPromptId={fields.attachedPromptId}
            onChange={(attachedPromptId) => update({ attachedPromptId })}
          />

          <div>
            <label className={LABEL} htmlFor={bodyId}>
              Your writing, in Swedish
            </label>
            <textarea
              id={bodyId}
              lang="sv"
              autoFocus={entry === undefined}
              value={fields.body}
              onChange={(event) => update({ body: event.target.value })}
              onBlur={() => void saveNow()}
              placeholder="Skriv här…"
              className={`${INPUT} mt-1.5 min-h-[45vh] resize-y text-base leading-relaxed`}
            />
          </div>

          <TagField
            tags={fields.tags}
            placeholder="resa, vardagen…"
            hint="A filter you share with Vocabulary and the Grammar Notes."
            onChange={(tags) => update({ tags })}
          />
        </div>

        {entry === undefined ? null : (
          <div className="mt-8 border-t border-border pt-4">
            {confirmingDelete ? (
              <div className="rounded-lg bg-danger-soft p-3">
                <p className="text-sm text-text">
                  Delete this Journal Entry? The Vocabulary Entries and Grammar Notes it Pinned
                  are not touched. The writing itself cannot be brought back.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={BUTTON_DANGER} onClick={() => void remove()}>
                    Delete Journal Entry
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={BUTTON_QUIET}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete this Journal Entry
              </button>
            )}
          </div>
        )}
      </EditorFrame>
    </SplitView>
  )
}

/**
 * The padded column the writing lives in. The shell supplies no padding of its
 * own, and the split view (#42) gives this column the scroll rather than the
 * page, so the panel beside it keeps its own.
 */
function EditorFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8 ${className}`}>
      {children}
    </div>
  )
}

/**
 * What the autosave is doing. Visible rather than silent, because the one thing
 * this screen must never do is lose what you typed without saying so.
 */
function SaveStatus({
  state,
  hasEntry,
  onRetry,
}: {
  state: SaveState
  hasEntry: boolean
  onRetry: () => void
}) {
  if (state === 'failed') {
    return (
      <span className="flex items-center gap-2 text-sm text-danger">
        Could not save
        <button type="button" className={BUTTON} onClick={onRetry}>
          Try again
        </button>
      </span>
    )
  }

  const label =
    state === 'saving'
      ? 'Saving…'
      : state === 'pending'
        ? 'Unsaved changes'
        : hasEntry
          ? 'Saved'
          : 'Nothing written yet'

  return (
    <span className="text-sm text-text-muted" aria-live="polite">
      {label}
    </span>
  )
}
