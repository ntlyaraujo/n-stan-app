import type { ReactNode } from 'react'

/**
 * The standard padded column a screen renders into.
 *
 * The shell deliberately supplies no padding of its own, so a screen that needs
 * the full width of the content area (the journal split view, #42) simply does
 * not use this.
 */
export function Screen({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
      {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </div>
  )
}
