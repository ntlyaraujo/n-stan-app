/**
 * The class strings the Grammar Note screens share (#29–#34).
 *
 * Every colour goes through a token — `bg-surface-raised`, `text-text-muted`,
 * `border-danger`. Tailwind's default palette is reset to `initial` here, so a
 * raw palette colour such as `bg-white` silently produces no CSS at all.
 */

export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export const BUTTON = [
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border',
  'bg-surface-raised px-3 py-2 text-sm font-medium text-text transition-colors',
  'hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS_RING,
].join(' ')

export const BUTTON_PRIMARY = [
  'inline-flex items-center justify-center gap-2 rounded-lg border border-transparent',
  'bg-accent px-3 py-2 text-sm font-medium text-text-on-accent transition-colors',
  'hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS_RING,
].join(' ')

export const BUTTON_DANGER = [
  'inline-flex items-center justify-center gap-2 rounded-lg border border-danger',
  'bg-surface-raised px-3 py-2 text-sm font-medium text-danger transition-colors',
  'hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS_RING,
].join(' ')

export const INPUT = [
  'w-full rounded-lg border border-border bg-surface-raised px-3 py-2',
  'text-sm text-text placeholder:text-text-muted',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus',
].join(' ')

export const LABEL = 'block text-xs font-medium uppercase tracking-wide text-text-muted'

export const CARD = 'rounded-xl border border-border bg-surface-raised'

export const BADGE = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'

export const BADGE_NEUTRAL = `${BADGE} bg-surface-sunken text-text-muted`
