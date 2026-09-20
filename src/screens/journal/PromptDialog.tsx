import { useEffect, useId, useRef, type ReactNode } from 'react'
import { BUTTON_QUIET } from './journalStyles.ts'

/**
 * The panel the Prompt picker (#38) and the Prompt manager (#36) open in.
 *
 * On a phone it is a sheet that rises from the bottom edge and stops short of
 * the top; from `sm` up it is a centred dialog. Escape and the backdrop both
 * close it, because choosing a Prompt is optional and backing out of it must be
 * as easy as opening it.
 */
export function PromptDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  const headingId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sm:items-center">
      {/* The scrim. Closing is announced by the Close button in the header, so
          this is a click target only. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-overlay"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface shadow-lg sm:max-h-[80dvh] sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="text-base font-semibold tracking-tight text-text">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-text-muted">{description}</p> : null}
          </div>
          <button type="button" className={BUTTON_QUIET} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}
