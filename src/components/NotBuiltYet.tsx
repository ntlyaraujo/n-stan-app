import type { ReactNode } from 'react'

/**
 * Placeholder body for a route that exists so the router is settled, but whose
 * screen belongs to a later ticket. Replace the whole screen file when that
 * ticket lands; nothing in the router needs to change.
 */
export function NotBuiltYet({ ticket, children }: { ticket: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface-sunken p-5">
      <p className="text-sm font-medium text-text">Not built yet</p>
      {children ? <p className="mt-1 text-sm text-text-muted">{children}</p> : null}
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-muted">
        Ticket {ticket}
      </p>
    </div>
  )
}
