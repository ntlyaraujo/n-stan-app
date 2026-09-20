import { Outlet } from 'react-router'
import { Navigation } from './Navigation.tsx'
import { AttributionFooter } from './Attribution.tsx'

/**
 * The shell every screen renders inside.
 *
 * Mobile first, and mobile properly rather than as a fallback (spec section 5):
 * the viewport is the frame, the tab bar and the attribution line sit outside
 * the scroll area, and `main` is the only thing that scrolls. From `md` up the
 * tab bar becomes a side rail and nothing else moves.
 *
 * `main` carries no padding of its own on purpose. A screen that wants the
 * ordinary padded column uses `Screen`; a screen that wants the whole content
 * box — the journal split view in #42 — takes `h-full` and fills it.
 */
export function AppLayout() {
  return (
    <div className="relative flex h-dvh overflow-hidden bg-surface text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-text-on-accent"
      >
        Skip to content
      </a>
      <Navigation variant="rail" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
        <AttributionFooter />
        <Navigation variant="tabs" />
      </div>
    </div>
  )
}
