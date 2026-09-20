/**
 * The class strings the journal screens share (#37, #38, #39).
 *
 * Every colour goes through a token: `bg-surface-raised`, `text-text-muted`,
 * `border-border`. Tailwind's default palette is reset, so a raw palette colour
 * would silently produce no CSS at all.
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

export const BUTTON_QUIET = [
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5',
  'text-sm font-medium text-text-muted transition-colors',
  'hover:bg-surface-sunken hover:text-text',
  FOCUS_RING,
].join(' ')

export const BUTTON_DANGER = [
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border',
  'bg-surface-raised px-3 py-2 text-sm font-medium text-danger transition-colors',
  'hover:bg-danger-soft',
  FOCUS_RING,
].join(' ')

export const INPUT = [
  'w-full rounded-lg border border-border bg-surface-raised px-3 py-2',
  'text-sm text-text placeholder:text-text-muted',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus',
].join(' ')

export const LABEL = 'block text-xs font-medium uppercase tracking-wide text-text-muted'

export const CARD = 'rounded-xl border border-border bg-surface-raised'

/**
 * The tinted pairing for each Prompt level. Levels filter; they never gate.
 *
 * `capitalize` lives here rather than on {@link BADGE} because it is the level
 * alone that is stored lower-case. A badge that capitalised every word would
 * print the glossary's *Built-in* as *Built-In*.
 */
export const LEVEL_BADGE: Record<string, string> = {
  beginner: 'bg-success-soft text-success capitalize',
  intermediate: 'bg-accent-soft text-accent capitalize',
  advanced: 'bg-warning-soft text-warning capitalize',
}

export const BADGE = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
