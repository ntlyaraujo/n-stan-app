/**
 * The Tag input, for all three screens that have one.
 *
 * There used to be one of these per feature folder, near enough line for line
 * the same, and they had already drifted: two committed a Tag on a comma
 * arriving in the value, one on the comma key, so pasting `a,b` made a Tag on
 * two screens and not the third. One control now, and the screen-specific copy
 * comes in as props.
 *
 * Two things it guarantees, both of which are what makes the namespace one
 * namespace:
 *
 * - **It suggests from the whole namespace**, never from one entity type. A
 *   Journal Entry offering no suggestions at all is how divergent spellings
 *   start.
 * - **A comma finishes a Tag however it arrives** — typed or pasted. Pasting
 *   `substantiv, en-ord` makes two Tags and leaves nothing behind.
 *
 * The spelling itself is not this control's business: `addTag` keeps the one
 * already on the record, and the data layer canonicalises across the namespace
 * on write.
 */

import { useEffect, useId, useState } from 'react'
import { listTags } from '../data/index.ts'
import type { Tag } from '../domain/index.ts'
import { addTag, removeTag, tagsMatch } from '../domain/index.ts'
import { BUTTON, FOCUS_RING, INPUT, LABEL } from './styles.ts'

/** How many suggestions are offered before the row would take over the screen. */
const SUGGESTION_LIMIT = 12

export function TagField({
  tags,
  onChange,
  placeholder = 'verb tenses, en-words…',
  hint,
  labelClassName = LABEL,
}: {
  tags: readonly Tag[]
  onChange: (tags: readonly Tag[]) => void
  /** Screen-specific copy: an example in the language of that screen. */
  placeholder?: string
  hint?: string
  /** So the label matches the form it sits in. */
  labelClassName?: string
}) {
  const fieldId = useId()
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<readonly Tag[]>([])

  // Every Tag in use anywhere, because Tags are one namespace shared by
  // Vocabulary Entries, Grammar Notes and Journal Entries.
  useEffect(() => {
    let cancelled = false
    void listTags().then((all) => {
      if (!cancelled) setSuggestions(all)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /** Commit whatever is typed, splitting on commas so a pasted list works. */
  function commit(raw: string) {
    setDraft('')
    const next = raw
      .split(',')
      .reduce<readonly Tag[]>((carried, part) => addTag(carried, part), tags)
    if (next !== tags) onChange(next)
  }

  /**
   * A comma finishes a Tag as it arrives, whether it was typed or pasted. What
   * follows the last comma is still being written and stays in the input.
   */
  function typed(value: string) {
    if (!value.includes(',')) {
      setDraft(value)
      return
    }
    const parts = value.split(',')
    const trailing = parts.pop() ?? ''
    commit(parts.join(','))
    setDraft(trailing)
  }

  const unused = suggestions.filter(
    (suggestion) => !tags.some((tag) => tagsMatch(tag, suggestion)),
  )

  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClassName} htmlFor={fieldId}>
        Tags
      </label>
      {hint === undefined ? null : <p className="text-xs text-text-muted">{hint}</p>}

      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken py-1 pl-2.5 pr-1 text-xs font-medium text-text">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove the Tag ${tag}`}
                  className={`rounded-full px-1 text-text-muted hover:text-danger ${FOCUS_RING}`}
                  onClick={() => {
                    onChange(removeTag(tags, tag))
                  }}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <input
          id={fieldId}
          type="text"
          value={draft}
          placeholder={placeholder}
          className={INPUT}
          onChange={(event) => {
            typed(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commit(draft)
          }}
          onBlur={() => {
            commit(draft)
          }}
        />
        <button
          type="button"
          className={`${BUTTON} shrink-0`}
          onClick={() => {
            commit(draft)
          }}
        >
          Add
        </button>
      </div>

      {unused.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {unused.slice(0, SUGGESTION_LIMIT).map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                className={`rounded-full border border-dashed border-border-strong px-2.5 py-1 text-xs font-medium text-text-muted hover:border-accent hover:text-accent ${FOCUS_RING}`}
                onClick={() => {
                  commit(suggestion)
                }}
              >
                + {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
