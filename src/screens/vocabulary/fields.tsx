/**
 * The input primitives the Vocabulary screens are built from (#20).
 *
 * Nothing here can be disabled by Auto-fill: a prefilled field is an ordinary
 * field holding an ordinary value, which is the whole of "prefills and never
 * locks". If you ever find yourself adding a `readOnly` prop, re-read spec
 * section 4, behaviour 3 first.
 */

import type { ReactNode } from 'react'
import { useId } from 'react'

/** The label style the vocabulary form's fields share. */
export const FIELD_LABEL = 'text-sm font-medium text-text'

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
      <label htmlFor={htmlFor} className={FIELD_LABEL}>
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
