/**
 * Picking the Vocabulary Entries a Grammar Note References (#32).
 *
 * **Why a picker and not wiki-style `[[links]]`.** A Reference is deliberate.
 * Inline link syntax would mean building an editor with autocomplete and link
 * parsing, and would tie the link to a spelling inside the prose; a Tag would be
 * weaker still, since a Tag is a filter and a Reference is a chosen connection.
 * So the link is made here, explicitly, many-to-many, and shows up on the word
 * as a Backlink without anyone creating it twice.
 *
 * The picker holds a list of entries rather than writing as you click: on a new
 * note there is no note to attach a Reference to yet. The editor reconciles the
 * list against the stored note on save, through `addReference` / `removeReference`.
 */

import { useEffect, useState } from 'react'
import { listVocabularyEntries } from '../../data/index.ts'
import type { VocabularyEntry } from '../../domain/index.ts'
import { FOCUS_RING, INPUT, LABEL } from './grammarStyles.ts'

const MAX_SUGGESTIONS = 8

export function VocabularyPicker({
  picked,
  onChange,
}: {
  picked: readonly VocabularyEntry[]
  onChange: (picked: readonly VocabularyEntry[]) => void
}) {
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<readonly VocabularyEntry[]>([])
  const [anyVocabulary, setAnyVocabulary] = useState(true)

  useEffect(() => {
    let cancelled = false
    const term = search.trim()
    void (async () => {
      const found = await listVocabularyEntries(term === '' ? {} : { search: term })
      if (cancelled) return
      setMatches(found)
      if (term === '') setAnyVocabulary(found.length > 0)
    })()
    return () => {
      cancelled = true
    }
  }, [search])

  const pickedIds = new Set(picked.map((entry) => entry.id))
  const suggestions = matches.filter((entry) => !pickedIds.has(entry.id))
  const typing = search.trim() !== ''

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className={LABEL}>References</span>
        <p className="text-xs text-text-muted">
          The words this note explains. Each one shows the note back, as a Backlink.
        </p>
      </div>

      {picked.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((entry) => (
            <li key={entry.id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-2.5 pr-1 text-xs font-medium text-accent">
                <span lang="sv">{entry.lemma}</span>
                <button
                  type="button"
                  aria-label={`Unlink ${entry.lemma}`}
                  className={`rounded-full px-1 hover:text-danger ${FOCUS_RING}`}
                  onClick={() => {
                    onChange(picked.filter((other) => other.id !== entry.id))
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
        type="search"
        value={search}
        className={INPUT}
        placeholder="Search the Vocabulary to add a Reference"
        aria-label="Search the Vocabulary to add a Reference"
        disabled={!anyVocabulary && !typing}
        onChange={(event) => {
          setSearch(event.target.value)
        }}
      />

      {!anyVocabulary && !typing ? (
        <p className="text-xs text-text-muted">
          No Vocabulary Entries to Reference yet. Capture a word first — the note keeps
          working without one.
        </p>
      ) : suggestions.length === 0 ? (
        typing ? (
          <p className="text-xs text-text-muted">Nothing matches “{search.trim()}”.</p>
        ) : null
      ) : (
        <ul className="flex flex-col gap-1">
          {suggestions.slice(0, MAX_SUGGESTIONS).map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`flex w-full items-baseline gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-left text-sm text-text hover:border-accent ${FOCUS_RING}`}
                onClick={() => {
                  onChange([...picked, entry])
                  setSearch('')
                }}
              >
                <span className="font-medium" lang="sv">
                  {entry.lemma}
                </span>
                {entry.translation === '' ? null : (
                  <span className="text-text-muted">{entry.translation}</span>
                )}
                <span className="ml-auto shrink-0 text-xs text-text-muted">Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
