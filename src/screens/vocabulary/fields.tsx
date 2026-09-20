/**
 * The input primitives the Vocabulary screens are built from (#20).
 *
 * Nothing here can be disabled by Auto-fill: a prefilled field is an ordinary
 * field holding an ordinary value, which is the whole of "prefills and never
 * locks". If you ever find yourself adding a `readOnly` prop, re-read spec
 * section 4, behaviour 3 first.
 */

import type { ReactNode } from 'react'
import { useId, useState } from 'react'
import type { Tag } from '../../domain/index.ts'
import { addTag, normaliseTag, removeTag } from '../../domain/index.ts'

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

const CONTROL =
  'w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus'

export function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {children}
      </label>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  autoFocus,
  onBlur,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: ReactNode
  autoFocus?: boolean
  onBlur?: () => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type="text"
        className={CONTROL}
        value={value}
        placeholder={placeholder}
        // The Lemma is the one thing every capture starts with, so the form
        // opens with the cursor already in it.
        autoFocus={autoFocus}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onBlur={onBlur}
      />
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: ReactNode
  rows?: number
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        rows={rows}
        className={`${CONTROL} resize-y`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}

export function SelectField<Value extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: Value
  onChange: (value: Value) => void
  options: readonly { readonly value: Value; readonly label: string }[]
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <select
        id={id}
        className={CONTROL}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as Value)
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * A segmented choice, used for Gender. Gender gets a control of its own rather
 * than a dropdown because *en* and *ett* are the whole point of a Swedish noun
 * and one of them is nearly always what you came to find out (spec section 4).
 */
export function ChoiceField<Value extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: Value
  onChange: (value: Value) => void
  options: readonly { readonly value: Value; readonly label: string }[]
  hint?: ReactNode
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-text">{label}</legend>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <label
              key={option.value}
              className={[
                'cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                'focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus',
                selected
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-surface-raised text-text-muted hover:text-text',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={selected}
                value={option.value}
                onChange={() => {
                  onChange(option.value)
                }}
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Tags: free text in one namespace, matched without regard to case and kept in
 * the spelling first used — `addTag` handles both, so this control never
 * normalises on its own.
 */
export function TagEditor({
  tags,
  onChange,
  suggestions = [],
}: {
  tags: readonly Tag[]
  onChange: (tags: readonly Tag[]) => void
  suggestions?: readonly Tag[]
}) {
  const id = useId()
  const [typed, setTyped] = useState('')

  const commit = (raw: string) => {
    const next = addTag(tags, raw)
    setTyped('')
    if (next !== tags) onChange(next)
  }

  const unused = suggestions.filter(
    (suggestion) => !tags.some((tag) => normaliseTag(tag) === normaliseTag(suggestion)),
  )

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} hint="A filter you share with Grammar Notes and the Journal.">
        Tags
      </FieldLabel>
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken py-1 pl-2.5 pr-1 text-xs font-medium text-text">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove the Tag ${tag}`}
                  className={`rounded-full px-1 text-text-muted hover:text-danger ${FOCUS}`}
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
          id={id}
          type="text"
          className={CONTROL}
          value={typed}
          placeholder="en-words, from the podcast…"
          onChange={(event) => {
            setTyped(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ',') return
            event.preventDefault()
            commit(typed)
          }}
          onBlur={() => {
            commit(typed)
          }}
        />
        <button
          type="button"
          className={`shrink-0 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-text hover:bg-surface-sunken ${FOCUS}`}
          onClick={() => {
            commit(typed)
          }}
        >
          Add
        </button>
      </div>
      {unused.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {unused.slice(0, 8).map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                className={`rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:border-accent hover:text-accent ${FOCUS}`}
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
