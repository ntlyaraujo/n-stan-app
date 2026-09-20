import { useId, useState } from 'react'
import {
  createCustomPrompt,
  createCustomPromptFromBuiltIn,
  deletePrompt,
  saveCustomPrompt,
  setBuiltInPromptHidden,
} from '../../data/index.ts'
import {
  isBuiltInPrompt,
  PROMPT_LEVELS,
  type Prompt,
  type PromptLevel,
} from '../../domain/index.ts'
import { PromptDialog } from './PromptDialog.tsx'
import { PromptLevelFilter } from './PromptLevelFilter.tsx'
import { usePrompts } from './usePrompts.ts'
import {
  BADGE,
  BUTTON,
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_QUIET,
  INPUT,
  LABEL,
  LEVEL_BADGE,
} from './journalStyles.ts'

/**
 * Managing the Prompt set (#36).
 *
 * The shipped Built-in Prompts are seeded at app start and are read-only here:
 * you may hide one from the picker, and **editing one produces a Custom Prompt**
 * rather than changing it, which is what lets a revised shipped set arrive later
 * without discarding your own wording. A hidden Built-in Prompt is never
 * deleted, only set aside, so it can always come back.
 *
 * Deleting a Custom Prompt leaves every Journal Entry Attached to it standing;
 * the entry simply loses the attachment. The writing is never touched.
 */
export function PromptManagerDialog({ onClose }: { onClose: () => void }) {
  const { prompts, loading, reload } = usePrompts(true)
  const [level, setLevel] = useState<PromptLevel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  const query = search.trim().toLowerCase()
  const shown = prompts.filter(
    (prompt) =>
      (level === 'all' || prompt.level === level) &&
      (query === '' || prompt.text.toLowerCase().includes(query)),
  )

  return (
    <PromptDialog
      title="Prompts"
      description="Add your own, or set a Built-in Prompt aside."
      onClose={onClose}
    >
      <div className="space-y-3">
        <input
          type="search"
          data-autofocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Prompts"
          className={INPUT}
          aria-label="Search Prompts"
        />
        <PromptLevelFilter level={level} onChange={setLevel} />

        {adding ? (
          <PromptForm
            heading="New Custom Prompt"
            submitLabel="Add Prompt"
            onSubmit={async (text, promptLevel) => {
              await createCustomPrompt({ text, level: promptLevel })
              setAdding(false)
              reload()
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className={BUTTON_PRIMARY} onClick={() => setAdding(true)}>
            Add a Custom Prompt
          </button>
        )}

        {loading ? (
          <p className="py-6 text-center text-sm text-text-muted">Loading Prompts…</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No Prompts match. Clear the search, or choose All levels.
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((prompt) => (
              <li key={prompt.id}>
                <PromptManagerRow prompt={prompt} onChanged={reload} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PromptDialog>
  )
}

function PromptManagerRow({ prompt, onChanged }: { prompt: Prompt; onChanged: () => void }) {
  const [mode, setMode] = useState<'idle' | 'editing' | 'confirming-delete'>('idle')
  const [busy, setBusy] = useState(false)
  const builtIn = isBuiltInPrompt(prompt)
  const hidden = builtIn && prompt.hidden

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      setMode('idle')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'editing') {
    return (
      <PromptForm
        heading={builtIn ? 'Edit as a Custom Prompt' : 'Edit Custom Prompt'}
        note={
          builtIn
            ? 'The Built-in Prompt stays as it is. Your edit is saved as a Custom Prompt.'
            : undefined
        }
        submitLabel={builtIn ? 'Save as Custom Prompt' : 'Save Prompt'}
        initialText={prompt.text}
        initialLevel={prompt.level}
        onSubmit={async (text, level) =>
          run(() =>
            builtIn
              ? createCustomPromptFromBuiltIn(prompt.id, { text, level })
              : saveCustomPrompt({ ...prompt, text, level }),
          )
        }
        onCancel={() => setMode('idle')}
      />
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <p className={`text-sm ${hidden ? 'text-text-muted line-through' : 'text-text'}`} lang="sv">
        {prompt.text}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`${BADGE} ${LEVEL_BADGE[prompt.level]}`}>{prompt.level}</span>
        <span className={`${BADGE} bg-surface-sunken text-text-muted`}>
          {builtIn ? 'Built-in' : 'Custom'}
        </span>
        {hidden ? (
          <span className={`${BADGE} bg-warning-soft text-warning`}>Hidden from the picker</span>
        ) : null}
      </div>

      {mode === 'confirming-delete' ? (
        <div className="mt-3 rounded-lg bg-danger-soft p-3">
          <p className="text-sm text-text">
            Delete this Custom Prompt? Journal Entries Attached to it are kept and simply lose
            the attachment.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={BUTTON_DANGER}
              disabled={busy}
              onClick={() => void run(() => deletePrompt(prompt.id))}
            >
              Delete Prompt
            </button>
            <button type="button" className={BUTTON} onClick={() => setMode('idle')}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          <button type="button" className={BUTTON_QUIET} onClick={() => setMode('editing')}>
            {builtIn ? 'Edit as Custom Prompt' : 'Edit'}
          </button>
          {builtIn ? (
            <button
              type="button"
              className={BUTTON_QUIET}
              disabled={busy}
              onClick={() => void run(() => setBuiltInPromptHidden(prompt.id, !prompt.hidden))}
            >
              {prompt.hidden ? 'Show in the picker' : 'Hide from the picker'}
            </button>
          ) : (
            <button
              type="button"
              className={BUTTON_QUIET}
              onClick={() => setMode('confirming-delete')}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PromptForm({
  heading,
  note,
  submitLabel,
  initialText = '',
  initialLevel = 'beginner',
  onSubmit,
  onCancel,
}: {
  heading: string
  note?: string
  submitLabel: string
  initialText?: string
  initialLevel?: PromptLevel
  onSubmit: (text: string, level: PromptLevel) => Promise<void>
  onCancel: () => void
}) {
  const [text, setText] = useState(initialText)
  const [level, setLevel] = useState<PromptLevel>(initialLevel)
  const [busy, setBusy] = useState(false)
  const fieldId = useId()

  const trimmed = text.trim()

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-surface-sunken p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed === '' || busy) return
        setBusy(true)
        void onSubmit(trimmed, level).finally(() => setBusy(false))
      }}
    >
      <p className="text-sm font-medium text-text">{heading}</p>
      {note ? <p className="text-xs text-text-muted">{note}</p> : null}
      <div>
        <label className={LABEL} htmlFor={`${fieldId}-text`}>
          Prompt, in Swedish
        </label>
        <textarea
          id={`${fieldId}-text`}
          autoFocus
          lang="sv"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Berätta om…"
          className={`${INPUT} mt-1 resize-y`}
        />
      </div>
      <div>
        <label className={LABEL} htmlFor={`${fieldId}-level`}>
          Level
        </label>
        <select
          id={`${fieldId}-level`}
          value={level}
          onChange={(event) => setLevel(event.target.value as PromptLevel)}
          className={`${INPUT} mt-1 capitalize`}
        >
          {PROMPT_LEVELS.map((option) => (
            <option key={option} value={option} className="capitalize">
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BUTTON_PRIMARY} disabled={trimmed === '' || busy}>
          {submitLabel}
        </button>
        <button type="button" className={BUTTON} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
