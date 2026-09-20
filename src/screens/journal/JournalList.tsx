import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { SEARCH_DEBOUNCE_MS } from '../../components/liveSearch.ts'
import { Screen } from '../../components/Screen.tsx'
import {
  distinctTags,
  journalEntryPreview,
  listJournalEntries,
  listJournalEntriesByDate,
  type JournalEntryDateGroup,
} from '../../data/index.ts'
import type { JournalEntry, Tag } from '../../domain/index.ts'
import { dayHeading, formatDate, formatTimeWritten, relativeDayLabel } from './journalDates.ts'
import { bodyAfterPreview } from './journalPreview.ts'
import { PromptManagerDialog } from './PromptManager.tsx'
import {
  BADGE,
  BUTTON,
  BUTTON_PRIMARY,
  CARD,
  FOCUS_RING,
  INPUT,
} from './journalStyles.ts'

/**
 * The journal, grouped by Date (#39).
 *
 * Journal Entries have no title, so the preview is the first non-blank line of
 * the writing — `journalEntryPreview` in the data layer is the one place that
 * rule lives.
 *
 * **Several entries on one Date are ordinary, not an edge case.** A day is a
 * group holding as many entries as it has, each its own card, side by side from
 * `sm` up. A second thought later the same evening is a new entry, never an
 * edit of the first.
 */
export function JournalList() {
  const [loaded, setLoaded] = useState<{ request: string; groups: readonly JournalEntryDateGroup[] }>(
    { request: '', groups: [] },
  )
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<Tag | undefined>(undefined)
  const [tags, setTags] = useState<readonly Tag[]>([])
  const [managingPrompts, setManagingPrompts] = useState(false)

  // Every Tag in the journal, so the filter does not shrink to the Tags of
  // whatever is currently on screen. Folded without regard to case by
  // `distinctTags`, which also gives back the spelling first used — one Tag is
  // one option however it was typed.
  useEffect(() => {
    let cancelled = false
    void listJournalEntries().then((entries) => {
      if (!cancelled) setTags(distinctTags(entries))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The result is stored with the search and Tag it answers, so *loading* is
  // derived rather than a second piece of state set from inside the effect.
  const request = `${search.trim()}\u0000${tag ?? ''}`
  const loading = loaded.request !== request
  const groups = loaded.groups

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void listJournalEntriesByDate({
        ...(search.trim() === '' ? {} : { search }),
        ...(tag === undefined ? {} : { tag }),
      }).then((found) => {
        if (!cancelled) setLoaded({ request, groups: found })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, tag, request])

  const filtering = search.trim() !== '' || tag !== undefined

  return (
    <Screen title="Journal" description="Your own Swedish writing, newest first.">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/journal/new" className={BUTTON_PRIMARY}>
          New Journal Entry
        </Link>
        <button type="button" className={BUTTON} onClick={() => setManagingPrompts(true)}>
          Manage Prompts
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your writing"
          aria-label="Search your writing"
          className={INPUT}
        />
        {tags.length > 0 ? (
          <div role="group" aria-label="Filter by Tag" className="flex flex-wrap gap-1.5">
            <TagFilterChip label="All Tags" selected={tag === undefined} onClick={() => setTag(undefined)} />
            {tags.map((each) => (
              <TagFilterChip
                key={each}
                label={each}
                selected={tag === each}
                onClick={() => setTag(tag === each ? undefined : each)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-text-muted">Loading…</p>
        ) : groups.length === 0 ? (
          <EmptyJournal filtering={filtering} />
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.date} aria-label={dayHeading(group.date)}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h2 className="text-sm font-semibold tracking-tight text-text">
                    {dayHeading(group.date)}
                  </h2>
                  {relativeDayLabel(group.date) === undefined ? null : (
                    <span className="text-xs text-text-muted">{formatDate(group.date)}</span>
                  )}
                  <span className="text-xs text-text-muted">
                    {group.entries.length === 1 ? '1 entry' : `${group.entries.length} entries`}
                  </span>
                </div>
                <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                  {group.entries.map((entry) => (
                    <li key={entry.id} className="flex">
                      <JournalEntryCard entry={entry} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {managingPrompts ? (
        <PromptManagerDialog onClose={() => setManagingPrompts(false)} />
      ) : null}
    </Screen>
  )
}

function TagFilterChip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        FOCUS_RING,
        selected
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border bg-surface-raised text-text-muted hover:text-text',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

/**
 * One entry in the list. The first line stands in for the title the entry does
 * not have; the time it was written is what tells two entries on one Date apart.
 */
function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const preview = journalEntryPreview(entry)
  const rest = bodyAfterPreview(entry.body)

  return (
    <Link
      to={`/journal/${entry.id}`}
      className={`${CARD} ${FOCUS_RING} flex w-full flex-col p-3 transition-colors hover:border-border-strong hover:bg-surface-sunken`}
    >
      <span className="text-sm font-medium text-text" lang="sv">
        {preview === '' ? <span className="text-text-muted italic">Empty so far</span> : preview}
      </span>
      {rest === '' ? null : (
        <span className="mt-1 line-clamp-2 text-sm text-text-muted" lang="sv">
          {rest}
        </span>
      )}
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-text-muted">{formatTimeWritten(entry.createdAt)}</span>
        {entry.attachedPromptId === undefined ? null : (
          <span className={`${BADGE} bg-accent-soft text-accent`}>Prompt</span>
        )}
        {entry.pins.length === 0 ? null : (
          <span className={`${BADGE} bg-surface-sunken text-text-muted`}>
            {entry.pins.length === 1 ? '1 Pin' : `${entry.pins.length} Pins`}
          </span>
        )}
        {entry.tags.map((tag) => (
          <span key={tag} className={`${BADGE} bg-surface-sunken text-text-muted`}>
            {tag}
          </span>
        ))}
      </span>
    </Link>
  )
}

function EmptyJournal({ filtering }: { filtering: boolean }) {
  if (filtering) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">
        Nothing matches. Try a different word, or clear the Tag filter.
      </p>
    )
  }
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface-sunken p-6 text-center">
      <p className="text-sm font-medium text-text">Nothing written yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
        Write in Swedish, with or without a Prompt. Entries have no title — the first line is
        how you will recognise this one later.
      </p>
      <Link to="/journal/new" className={`${BUTTON_PRIMARY} mt-4`}>
        Write your first Journal Entry
      </Link>
    </div>
  )
}
