/**
 * The class strings the journal screens use (#37, #38, #39).
 *
 * The shared ones live in `src/components/styles.ts` and are re-exported here,
 * so importing from this file keeps working and there is still only one
 * definition of a button, an input or the focus ring. What stays below is what
 * only the journal has.
 */

import { FOCUS_RING } from '../../components/styles.ts'

export {
  BADGE,
  BUTTON,
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  CARD,
  FOCUS_RING,
  INPUT,
  LABEL,
} from '../../components/styles.ts'

export const BUTTON_QUIET = [
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5',
  'text-sm font-medium text-text-muted transition-colors',
  'hover:bg-surface-sunken hover:text-text',
  FOCUS_RING,
].join(' ')

/**
 * The tinted pairing for each Prompt level. Levels filter; they never gate.
 *
 * `capitalize` lives here rather than on the shared badge because it is the
 * level alone that is stored lower-case. A badge that capitalised every word
 * would print the glossary's *Built-in* as *Built-In*.
 */
export const LEVEL_BADGE: Record<string, string> = {
  beginner: 'bg-success-soft text-success capitalize',
  intermediate: 'bg-accent-soft text-accent capitalize',
  advanced: 'bg-warning-soft text-warning capitalize',
}
