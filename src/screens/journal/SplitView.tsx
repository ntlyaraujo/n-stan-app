/**
 * The split view the journal is written in (#42): the writing, and the panel of
 * Vocabulary and Grammar Notes beside it.
 *
 * **The writing area is the point, and the narrow layout is the one this app
 * was designed mobile-first for** — not a fallback the wide layout degrades
 * into. So the two are genuinely different shapes rather than one shape that
 * shrinks:
 *
 * - From `lg` up the panel is a column beside the writing, always open, with its
 *   own scroll. Nothing has to be opened to use it.
 * - Below that the writing keeps the whole width and the panel is a sheet that
 *   rises from the bottom edge, stopping short of the top so the last lines you
 *   wrote stay in view.
 *
 * The working set does not disappear when the sheet does. The Pins sit on a bar
 * along the bottom edge, as text taken straight from the Pin, so what you are
 * practicing is beside you while you write — which is half of what pinning is
 * for. The sheet is for searching and pinning, and it closes again.
 *
 * Which shape is on screen is a media query read in JavaScript rather than two
 * copies hidden with `hidden lg:flex`, so the panel is mounted exactly once and
 * there is never a second live search running out of sight.
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Pin } from '../../domain/index.ts'
import { FOCUS_RING } from './journalStyles.ts'
import { pinChips } from './pinPanel.ts'

/** Tailwind's `lg`. The one place the two layouts are told apart. */
const WIDE_SCREEN = '(min-width: 64rem)'

function subscribeToWidth(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_SCREEN)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

function wideScreenNow(): boolean {
  return window.matchMedia(WIDE_SCREEN).matches
}

function useWideScreen(): boolean {
  return useSyncExternalStore(subscribeToWidth, wideScreenNow, () => false)
}

export function SplitView({
  pins,
  panel,
  children,
}: {
  /** The stored Pins, which is all the bottom bar needs: `pinnedAs` is on both shapes. */
  pins: readonly Pin[]
  panel: (options: { onClose?: () => void }) => ReactNode
  children: ReactNode
}) {
  const wide = useWideScreen()
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!sheetOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [sheetOpen])

  const chips = pinChips(pins)

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>

      {wide ? (
        <aside className="flex h-full w-80 min-w-0 shrink-0 flex-col border-l border-border bg-surface-sunken xl:w-96">
          {panel({})}
        </aside>
      ) : (
        <>
          {/* The bar the writing sits above: the working set, still visible, and
              the way into the sheet. */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-border bg-surface-raised px-3 py-2">
            <div className="min-w-0 flex-1 overflow-x-auto">
              {chips.length === 0 ? (
                <p className="truncate text-xs text-text-muted">
                  Nothing Pinned in this entry yet
                </p>
              ) : (
                <ul className="flex w-max items-center gap-1.5">
                  {chips.map((chip) => (
                    <li key={chip.key}>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          chip.tombstone
                            ? 'bg-surface-sunken text-text-muted'
                            : 'bg-accent-soft text-accent'
                        }`}
                        lang={chip.kind === 'vocabularyEntry' ? 'sv' : undefined}
                      >
                        {chip.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className={`shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text ${FOCUS_RING}`}
              onClick={() => {
                setSheetOpen(true)
              }}
            >
              Words and notes
            </button>
          </div>

          {sheetOpen ? (
            <div className="absolute inset-0 z-20 flex items-end">
              {/* The scrim. Closing is announced by the panel's own Close
                  button, so this is a click target only. */}
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                className="absolute inset-0 cursor-default bg-overlay"
                onClick={() => {
                  setSheetOpen(false)
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Vocabulary and Grammar Notes"
                className="relative flex h-[70%] max-h-[32rem] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-lg"
              >
                {panel({
                  onClose: () => {
                    setSheetOpen(false)
                  },
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
