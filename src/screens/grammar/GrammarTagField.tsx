/**
 * The Tags on a Grammar Note (#29, #31).
 *
 * Tags live in one namespace shared with Vocabulary Entries and Journal
 * Entries, and match without regard to case — `addTag` keeps the spelling first
 * used, so typing *Verb tenses* where *verb tenses* already exists adds nothing.
 * That shared namespace is the point: a Tag put on this note reaches the words
 * carrying it too.
 */

import { useId, useState } from 'react'
import { addTag, normaliseTag, removeTag, type Tag } from '../../domain/index.ts'
import { FOCUS_RING, INPUT, LABEL } from './grammarStyles.ts'

export function GrammarTagField({
  tags,
  suggestions = [],
  onChange,
}: {
  tags: readonly Tag[]
  /** Tags already in use anywhere, offered so the namespace stays one namespace. */
  suggestions?: readonly Tag[]
  onChange: (tags: readonly Tag[]) => void
}) {
  const [draft, setDraft] = useState('')
  const fieldId = useId()

  function commit(raw: string) {
    const next = addTag(tags, raw)
    setDraft('')
    if (next !== tags) onChange(next)
  }

  const unused = suggestions.filter(
    (suggestion) => !tags.some((tag) => normaliseTag(tag) === normaliseTag(suggestion)),
  )

  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL} htmlFor={fieldId}>
        Tags
      </label>
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
      <input
        id={fieldId}
        type="text"
        value={draft}
        placeholder="verb tenses, prepositions…"
        className={INPUT}
        onChange={(event) => {
          // A comma finishes a Tag, so a list can be typed straight through.
          if (event.target.value.endsWith(',')) commit(event.target.value.slice(0, -1))
          else setDraft(event.target.value)
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
      {unused.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {unused.slice(0, 12).map((suggestion) => (
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
