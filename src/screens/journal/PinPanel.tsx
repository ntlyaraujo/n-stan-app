/**
 * The panel beside the writing (#40, #41): live search across Vocabulary and
 * Grammar Notes, and the Pins this Journal Entry is holding.
 *
 * **Pinning does two things with one gesture.** It keeps the word beside you
 * while you write, and it records that you practiced it — which is why a Pin is
 * saved with the entry and read back on reopen, and why it belongs to this
 * entry alone. A second entry the same evening starts with none.
 *
 * Unpinning is for what you did not end up using. It is not how a Pin
 * disappears when the word is deleted: that leaves a Tombstone, which still
 * shows here as plain unlinked text and has no Unpin, because the record of what
 * you practiced must not change months later (ADR-0001).
 *
 * The search is over the box, never over the writing. Matching *skriver* back to
 * *skriva* is a linguistic problem rather than a string match, and pinning
 * answers the same need with no guessing.
 */

import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { pinToJournalEntry, unpinFromJournalEntry } from '../../data/index.ts'
import type { JournalEntry, PinnedKind } from '../../domain/index.ts'
import { BUTTON, BUTTON_QUIET, FOCUS_RING, INPUT } from './journalStyles.ts'
import { matchRows, pinnedTargetIds, pinRows, type PinRow } from './pinPanel.ts'
import { useEntryPins, usePanelSearch } from './usePinPanel.ts'

/**
 * A write against the Journal Entry, made through the editor so that it happens
 * in turn with the autosave and the editor keeps the Pins it did not make.
 * Resolves to undefined only if there is no entry to write to.
 */
export type EntryWrite = (
  write: (journalEntryId: string) => Promise<JournalEntry>,
) => Promise<JournalEntry | undefined>

export function PinPanel({
  journalEntryId,
  onWrite,
  onClose,
}: {
  /** Undefined on `/journal/new` until the first Pin or the first line creates it. */
  journalEntryId: string | undefined
  onWrite: EntryWrite
  /** Present only in the bottom sheet, where the panel can be dismissed. */
  onClose?: () => void
}) {
  const entryPins = useEntryPins(journalEntryId)
  const search = usePanelSearch()
  const [writing, setWriting] = useState<string | null>(null)
  const headingId = useId()
  const searchId = useId()

  const rows = pinRows(entryPins.items)
  const matches = matchRows(
    search.vocabulary,
    search.grammarNotes,
    pinnedTargetIds(entryPins.items),
  )
  const searching = search.term.trim() !== ''
  const nothingToSearch =
    search.totals.vocabulary === 0 && search.totals.grammarNotes === 0

  async function pin(kind: PinnedKind, targetId: string) {
    setWriting(targetId)
    await onWrite((id) => pinToJournalEntry(id, kind, targetId))
    setWriting(null)
    entryPins.reload()
  }

  async function unpin(targetId: string) {
    setWriting(targetId)
    await onWrite((id) => unpinFromJournalEntry(id, targetId))
    setWriting(null)
    entryPins.reload()
  }

  return (
    <div className="flex h-full min-h-0 flex-col" aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <h2 id={headingId} className="text-sm font-semibold tracking-tight text-text">
          Vocabulary and Grammar Notes
        </h2>
        {onClose === undefined ? null : (
          <button type="button" className={BUTTON_QUIET} onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="border-b border-border px-3 py-2.5">
        <label className="sr-only" htmlFor={searchId}>
          Search Vocabulary and Grammar Notes
        </label>
        <input
          id={searchId}
          type="search"
          value={search.term}
          onChange={(event) => {
            search.setTerm(event.target.value)
          }}
          placeholder="Search words and notes"
          className={INPUT}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {searching ? (
          <section>
            <SectionHeading>
              {search.loading
                ? 'Searching…'
                : matches.rows.length === 0
                  ? 'No matches'
                  : 'Matches'}
            </SectionHeading>
            {matches.rows.length === 0 ? (
              <p className="mt-1 text-xs text-text-muted">
                Nothing in your Vocabulary or Grammar Notes matches “{search.term.trim()}”.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {matches.rows.map((row) => (
                  <li key={`${row.kind}:${row.key}`}>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
                      <RowText
                        label={row.label}
                        kindLabel={row.kindLabel}
                        detail={row.detail}
                        swedish={row.kind === 'vocabularyEntry'}
                      />
                      <button
                        type="button"
                        className={`${BUTTON} shrink-0 px-2.5 py-1 text-xs`}
                        disabled={row.pinned || writing !== null}
                        aria-label={row.pinned ? `${row.label} is Pinned` : `Pin ${row.label}`}
                        onClick={() => {
                          void pin(row.kind, row.targetId)
                        }}
                      >
                        {row.pinned ? 'Pinned' : 'Pin'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {matches.hidden > 0 ? (
              <p className="mt-2 text-xs text-text-muted">
                {matches.hidden === 1
                  ? '1 more match. Keep typing to narrow it down.'
                  : `${String(matches.hidden)} more matches. Keep typing to narrow them down.`}
              </p>
            ) : null}
          </section>
        ) : null}

        <section>
          <SectionHeading>
            {rows.length === 0 ? 'Pins' : `Pinned · ${String(rows.length)}`}
          </SectionHeading>
          {rows.length === 0 ? (
            <p className="mt-1 text-xs text-text-muted">
              Pin a word or a note to keep it beside you while you write. The Pins are saved
              with this Journal Entry as the record of what you practiced, and they do not
              carry over to the next one.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {rows.map((row) => (
                <PinnedRow
                  key={row.key}
                  row={row}
                  busy={writing !== null}
                  onUnpin={() => {
                    if (row.targetId !== null) void unpin(row.targetId)
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        {searching || search.loading ? null : nothingToSearch ? (
          <p className="text-xs text-text-muted">
            Nothing to search yet. Capture a word in{' '}
            <Link to="/vocabulary/new" className={`underline ${FOCUS_RING}`}>
              Vocabulary
            </Link>{' '}
            or write a{' '}
            <Link to="/grammar/new" className={`underline ${FOCUS_RING}`}>
              Grammar Note
            </Link>
            .
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            {describeTotals(search.totals.vocabulary, search.totals.grammarNotes)} to search.
          </p>
        )}
      </div>
    </div>
  )
}

function describeTotals(vocabulary: number, grammarNotes: number): string {
  const words = vocabulary === 1 ? '1 Vocabulary Entry' : `${String(vocabulary)} Vocabulary Entries`
  const notes = grammarNotes === 1 ? '1 Grammar Note' : `${String(grammarNotes)} Grammar Notes`
  return `${words} and ${notes}`
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">{children}</h3>
  )
}

function RowText({
  label,
  kindLabel,
  detail,
  swedish,
  muted = false,
}: {
  label: string
  kindLabel: string
  detail: string
  swedish: boolean
  muted?: boolean
}) {
  return (
    <span className="min-w-0 flex-1">
      <span
        className={`block truncate text-sm font-medium ${muted ? 'text-text-muted' : 'text-text'}`}
        lang={swedish ? 'sv' : undefined}
      >
        {label}
      </span>
      <span className="block truncate text-xs text-text-muted">
        {detail === '' ? kindLabel : `${kindLabel} · ${detail}`}
      </span>
    </span>
  )
}

/**
 * One Pin. A Tombstone renders here too, as plain text with no link and no
 * Unpin: there is nothing left to open, and the entry's record of what you
 * practiced is not ours to edit after the fact.
 */
function PinnedRow({
  row,
  busy,
  onUnpin,
}: {
  row: PinRow
  busy: boolean
  onUnpin: () => void
}) {
  const swedish = row.kind === 'vocabularyEntry'

  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
      {row.to === null ? (
        <RowText
          label={row.label}
          kindLabel={row.kindLabel}
          detail="no longer in your notebook"
          swedish={swedish}
          muted
        />
      ) : (
        <Link
          to={row.to}
          className={`flex min-w-0 flex-1 rounded-md ${FOCUS_RING} hover:underline`}
        >
          <RowText
            label={row.label}
            kindLabel={row.kindLabel}
            detail={row.detail}
            swedish={swedish}
          />
        </Link>
      )}
      {row.targetId === null ? null : (
        <button
          type="button"
          className={`${BUTTON_QUIET} shrink-0 px-2 py-1 text-xs`}
          disabled={busy}
          aria-label={`Unpin ${row.label}`}
          onClick={onUnpin}
        >
          Unpin
        </button>
      )}
    </li>
  )
}
