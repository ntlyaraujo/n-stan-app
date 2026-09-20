import { useEffect, useId, useState } from 'react'
import { getPrompt } from '../../data/index.ts'
import { isBuiltInPrompt, type Id, type Prompt, type PromptLevel } from '../../domain/index.ts'
import { PromptDialog } from './PromptDialog.tsx'
import { PromptLevelFilter } from './PromptLevelFilter.tsx'
import { PromptManagerDialog } from './PromptManager.tsx'
import { usePrompts } from './usePrompts.ts'
import {
  BADGE,
  BUTTON,
  BUTTON_QUIET,
  FOCUS_RING,
  INPUT,
  LABEL,
  LEVEL_BADGE,
} from './journalStyles.ts'

/**
 * Attaching a Prompt to a Journal Entry, or not (#38).
 *
 * Two things this screen must keep true:
 *
 * - **Writing with no Prompt is a first-class path**, not a fallback. *Write
 *   without a Prompt* is the first choice in the list, and writing without the
 *   Prompt already Attached is one tap away.
 * - **The level is a filter, never a gate.** Every Prompt in the set is reachable
 *   at any time; the filter only narrows what is on screen.
 */
export function PromptPicker({
  attachedPromptId,
  onChange,
}: {
  attachedPromptId?: Id
  onChange: (promptId: Id | undefined) => void
}) {
  // Held together with the id it was looked up for, so clearing the Attached
  // Prompt shows the empty state at once rather than one render later.
  const [resolved, setResolved] = useState<{ id?: Id; prompt?: Prompt }>({})
  const [picking, setPicking] = useState(false)
  const headingId = useId()
  const attached = resolved.id === attachedPromptId ? resolved.prompt : undefined

  useEffect(() => {
    if (attachedPromptId === undefined) return
    let cancelled = false
    void getPrompt(attachedPromptId).then((prompt) => {
      if (!cancelled) setResolved({ id: attachedPromptId, prompt })
    })
    return () => {
      cancelled = true
    }
  }, [attachedPromptId])

  return (
    <section aria-labelledby={headingId}>
      <h2 className={LABEL} id={headingId}>
        Prompt
      </h2>
      <div className="mt-1.5 rounded-lg border border-border bg-surface-raised p-3">
        {attachedPromptId === undefined ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-muted">
              No Prompt attached. Writing without one is entirely fine.
            </p>
            <button type="button" className={BUTTON} onClick={() => setPicking(true)}>
              Choose a Prompt
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-text" lang="sv">
              {attached?.text ?? 'This Prompt is no longer in your set.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {attached ? (
                <>
                  <span className={`${BADGE} ${LEVEL_BADGE[attached.level]}`}>
                    {attached.level}
                  </span>
                  {isBuiltInPrompt(attached) && attached.hidden ? (
                    <span className={`${BADGE} bg-warning-soft text-warning`}>
                      Hidden from the picker
                    </span>
                  ) : null}
                </>
              ) : null}
              <button type="button" className={BUTTON_QUIET} onClick={() => setPicking(true)}>
                Change
              </button>
              <button type="button" className={BUTTON_QUIET} onClick={() => onChange(undefined)}>
                Write without a Prompt
              </button>
            </div>
          </div>
        )}
      </div>

      {picking ? (
        <PromptPickerDialog
          attachedPromptId={attachedPromptId}
          onPick={(promptId) => {
            onChange(promptId)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </section>
  )
}

function PromptPickerDialog({
  attachedPromptId,
  onPick,
  onClose,
}: {
  attachedPromptId?: Id
  onPick: (promptId: Id | undefined) => void
  onClose: () => void
}) {
  const { prompts, loading, reload } = usePrompts()
  const [level, setLevel] = useState<PromptLevel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [managing, setManaging] = useState(false)

  const query = search.trim().toLowerCase()
  const shown = prompts.filter(
    (prompt) =>
      (level === 'all' || prompt.level === level) &&
      (query === '' || prompt.text.toLowerCase().includes(query)),
  )

  if (managing) {
    return (
      <PromptManagerDialog
        onClose={() => {
          setManaging(false)
          reload()
        }}
      />
    )
  }

  return (
    <PromptDialog
      title="Choose a Prompt"
      description="A suggestion, never an assignment."
      onClose={onClose}
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPick(undefined)}
          className={[
            'w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors',
            FOCUS_RING,
            attachedPromptId === undefined
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-surface-raised text-text hover:bg-surface-sunken',
          ].join(' ')}
        >
          Write without a Prompt
        </button>

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

        {loading ? (
          <p className="py-6 text-center text-sm text-text-muted">Loading Prompts…</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No Prompts match. Clear the search, or choose All levels.
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((prompt) => {
              const selected = prompt.id === attachedPromptId
              return (
                <li key={prompt.id}>
                  <button
                    type="button"
                    onClick={() => onPick(prompt.id)}
                    className={[
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                      FOCUS_RING,
                      selected
                        ? 'border-accent bg-accent-soft'
                        : 'border-border bg-surface-raised hover:bg-surface-sunken',
                    ].join(' ')}
                  >
                    <span className="block text-sm text-text" lang="sv">
                      {prompt.text}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`${BADGE} ${LEVEL_BADGE[prompt.level]}`}>
                        {prompt.level}
                      </span>
                      {isBuiltInPrompt(prompt) ? null : (
                        <span className={`${BADGE} bg-surface-sunken text-text-muted`}>Custom</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-t border-border pt-3">
          <button type="button" className={BUTTON} onClick={() => setManaging(true)}>
            Manage Prompts
          </button>
        </div>
      </div>
    </PromptDialog>
  )
}
