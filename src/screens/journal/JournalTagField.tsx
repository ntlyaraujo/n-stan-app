import { useId, useState } from 'react'
import { addTag, removeTag, type Tag } from '../../domain/index.ts'
import { FOCUS_RING, INPUT, LABEL } from './journalStyles.ts'

/**
 * The Tags on a Journal Entry (#37).
 *
 * Tags live in one namespace shared with Vocabulary Entries and Grammar Notes,
 * and match without regard to case — `addTag` keeps the spelling first used, so
 * typing *Verb tenses* where *verb tenses* already exists adds nothing.
 */
export function JournalTagField({
  tags,
  onChange,
}: {
  tags: readonly Tag[]
  onChange: (tags: readonly Tag[]) => void
}) {
  const [draft, setDraft] = useState('')
  const fieldId = useId()

  function commit(raw: string) {
    const next = addTag(tags, raw)
    if (next !== tags) onChange(next)
    setDraft('')
  }

  return (
    <div>
      <label className={LABEL} htmlFor={fieldId}>
        Tags
      </label>
      {tags.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken py-1 pl-2.5 pr-1 text-xs font-medium text-text">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove the Tag ${tag}`}
                  onClick={() => onChange(removeTag(tags, tag))}
                  className={`rounded-full px-1 text-text-muted hover:text-danger ${FOCUS_RING}`}
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
        value={draft}
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
        onBlur={() => commit(draft)}
        placeholder="Add a Tag, then Enter"
        className={`${INPUT} mt-1.5`}
      />
    </div>
  )
}
