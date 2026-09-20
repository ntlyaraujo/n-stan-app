import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { formatDate, formatWrittenAt, relativeDayLabel } from './journalDates.ts'
import { JournalTagField } from './JournalTagField.tsx'
import { PromptPicker } from './PromptPicker.tsx'
import { useJournalEntryEditor, type SaveState } from './useJournalEntryEditor.ts'
import { BUTTON, BUTTON_DANGER, BUTTON_QUIET, INPUT, LABEL } from './journalStyles.ts'

/**
 * Writing one Journal Entry (#37), with its optional Attached Prompt (#38).
 * Serves both `/journal/new` and `/journal/:journalEntryId`.
 *
 * **One undivided Swedish field, and no title.** There is deliberately no
 * English field beside it: the point of the method is to write in Swedish
 * without translating as you go, and a second box invites exactly that. The
 * accepted cost is that there is no dedicated place to note what you could not
 * express; pinned vocabulary (#40–#42) covers part of it.
 *
 * The Date is the day the entry belongs to and is yours to change. The creation
 * timestamp is separate, shown below it, and never edited.
 *
 * Typing autosaves — see `useJournalEntryEditor` for how hard it tries.
 */
export function JournalEntryScreen() {
  const { status, fields, saveState, entry, update, saveNow, remove } = useJournalEntryEditor()
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
    <EditorFrame>
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
          ? 'A new Journal Entry. It is saved as soon as you write something.'
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

        {/* The Pins panel — the Vocabulary Entries and Grammar Notes kept beside
            you while writing — belongs here, and is #40–#42. This screen is a
            plain column on purpose so that ticket can wrap it in the split
            layout without unpicking anything. */}

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

        <JournalTagField tags={fields.tags} onChange={(tags) => update({ tags })} />
      </div>

      {entry === undefined ? null : (
        <div className="mt-8 border-t border-border pt-4">
          {confirmingDelete ? (
            <div className="rounded-lg bg-danger-soft p-3">
              <p className="text-sm text-text">
                Delete this Journal Entry? The Vocabulary Entries and Grammar Notes it Pinned are
                not touched. The writing itself cannot be brought back.
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
  )
}

/**
 * The padded column the editor lives in. The shell supplies no padding of its
 * own, and #42 replaces this frame with the responsive split view.
 */
function EditorFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">{children}</div>
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
