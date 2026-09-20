import { PROMPT_LEVELS, type PromptLevel } from '../../domain/index.ts'
import { FOCUS_RING } from './journalStyles.ts'

/**
 * The level filter the Prompt picker and the Prompt manager share (#38).
 *
 * **A filter, never a gated progression.** *All levels* is the default and is
 * always one tap away, so an advanced Prompt you want today is never locked
 * away behind a level you have not reached.
 */
export function PromptLevelFilter({
  level,
  onChange,
}: {
  level: PromptLevel | 'all'
  onChange: (level: PromptLevel | 'all') => void
}) {
  const options: (PromptLevel | 'all')[] = ['all', ...PROMPT_LEVELS]

  return (
    <div
      role="group"
      aria-label="Filter Prompts by level"
      className="flex flex-wrap gap-1 rounded-lg bg-surface-sunken p-1"
    >
      {options.map((option) => {
        const selected = option === level
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={[
              'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              // Only a level is stored lower-case; *All levels* is written copy.
              option === 'all' ? '' : 'capitalize',
              FOCUS_RING,
              selected
                ? 'bg-surface-raised text-text shadow-sm'
                : 'text-text-muted hover:text-text',
            ].join(' ')}
          >
            {option === 'all' ? 'All levels' : option}
          </button>
        )
      })}
    </div>
  )
}
