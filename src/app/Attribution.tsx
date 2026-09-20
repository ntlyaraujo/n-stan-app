import { Link } from 'react-router'

/**
 * SALDO / Språkbanken attribution (#28, spec section 10).
 *
 * CC BY 4.0 obliges us to credit the source visibly, so this is a licence
 * requirement rather than a courtesy: it lives in two permanent places, a line
 * in the shell's footer and the full statement on the Settings screen. Neither
 * is a tooltip, and neither may be removed without replacing it with something
 * equally findable.
 */

const LINK =
  'underline decoration-border-strong underline-offset-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export function SaldoLink({ className }: { className?: string }) {
  return (
    <a
      href="https://spraakbanken.gu.se/en/resources/saldo"
      target="_blank"
      rel="noreferrer noopener"
      className={className ?? LINK}
    >
      SALDO
    </a>
  )
}

export function CcByLink({ className }: { className?: string }) {
  return (
    <a
      href="https://creativecommons.org/licenses/by/4.0/"
      target="_blank"
      rel="noreferrer noopener"
      className={className ?? LINK}
    >
      CC BY 4.0
    </a>
  )
}

/**
 * The persistent line at the bottom of every screen. Short on a phone, full on
 * anything wider; either way it links through to the complete statement.
 */
export function AttributionFooter() {
  return (
    <footer className="shrink-0 border-t border-border bg-surface px-4 py-1.5 text-center text-[0.6875rem] leading-snug text-text-muted">
      <p>
        <span className="hidden sm:inline">Swedish lexical data from </span>
        <SaldoLink />
        {', Språkbanken'}
        <span className="hidden sm:inline">, University of Gothenburg</span>
        {' — '}
        <CcByLink />
        {'. '}
        <Link to="/settings" className={LINK}>
          About
        </Link>
      </p>
    </footer>
  )
}

/** The full statement, on the Settings screen. */
export function AttributionStatement() {
  return (
    <section
      aria-labelledby="attribution-heading"
      className="rounded-lg border border-border bg-surface-raised p-5"
    >
      <h2 id="attribution-heading" className="text-base font-semibold">
        Attribution
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        Swedish lexical data from <SaldoLink />, a resource of{' '}
        <a
          href="https://spraakbanken.gu.se/"
          target="_blank"
          rel="noreferrer noopener"
          className={LINK}
        >
          Språkbanken
        </a>{' '}
        (the Swedish Language Bank) at the University of Gothenburg, licensed under{' '}
        <CcByLink />.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        Method and structure inspired by <em>Fluentish: Language Learning Planner and Journal</em>{' '}
        by Jo Franco. No content from the book is reproduced; every Prompt in this app is
        original.
      </p>
    </section>
  )
}
