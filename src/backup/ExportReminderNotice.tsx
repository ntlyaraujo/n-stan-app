import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { checkExportReminder, snoozeExportReminder } from './exportReminder.ts'

/**
 * The export nudge (#26).
 *
 * Deliberately a line above the content and never a dialog: it does not steal
 * focus, does not cover the editor and cannot stop you writing. Until it is
 * due it renders nothing at all, so the shell's layout is unchanged on every
 * ordinary start.
 *
 * It hides itself on Settings, where the export button it is pointing at is
 * already on screen.
 */
export function ExportReminderNotice() {
  const [state, setState] = useState<{ due: boolean; lastExportAt?: string }>({ due: false })
  const [dismissed, setDismissed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    let current = true
    void checkExportReminder().then((reminder) => {
      if (current) setState({ due: reminder.due, lastExportAt: reminder.lastExportAt })
    })
    return () => {
      current = false
    }
    // Re-checked on navigation, which is the cheapest moment that also catches
    // an export taken in this session.
  }, [location.pathname])

  if (!state.due || dismissed || location.pathname.startsWith('/settings')) return null

  return (
    <div className="border-b border-border bg-warning-soft px-4 py-2 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-sm text-text">
          <span className="font-medium">Time for a backup.</span>{' '}
          {state.lastExportAt === undefined
            ? 'Nothing here has ever been exported, and a browser can clear its own storage.'
            : `The last export was ${formatDay(state.lastExportAt)}. Anything written since then exists only in this browser.`}
        </p>
        <Link
          to="/settings"
          className="rounded-md bg-accent px-2.5 py-1 text-sm font-medium text-text-on-accent hover:bg-accent-hover"
        >
          Export now
        </Link>
        <button
          type="button"
          onClick={() => {
            snoozeExportReminder()
            setDismissed(true)
          }}
          className="rounded-md px-2.5 py-1 text-sm font-medium text-text-muted hover:text-text"
        >
          Not now
        </button>
      </div>
    </div>
  )
}

function formatDay(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return 'a while ago'
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}
