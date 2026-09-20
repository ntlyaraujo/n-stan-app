/**
 * Rendering a Grammar Note's body (#30).
 *
 * **Tables are the whole point.** Conjugation and declension tables are written
 * by hand as Markdown tables, which is precisely why #29 needs no table builder
 * and no rich text editor. So the renderer has to support GFM tables, and it
 * has to make them readable on a phone — hence the horizontal scroll container
 * rather than a table squeezed into 360 px.
 *
 * **How this is sanitised.** `marked` is used as a *lexer only*: it hands back
 * tokens and this file turns each one into a React element. No HTML string is
 * ever produced and `dangerouslySetInnerHTML` is never called, so there is no
 * injection surface to scrub afterwards — the set of elements a note can
 * produce is the allowlist below and nothing else. That is a stricter guarantee
 * than parse-to-HTML-then-sanitise, and it keeps a ~20 kB gzipped sanitiser out
 * of a mobile-first PWA's bundle.
 *
 * Two things still need guarding by hand, because the lexer passes them through
 * verbatim:
 *
 * - **URLs.** `[x](javascript:…)` reaches us as a plain href, so
 *   {@link safeHref} allowlists the schemes and anything rejected renders as
 *   text instead of a link.
 * - **Raw HTML in the source.** A note containing `<script>` is shown as the
 *   characters the writer typed rather than being interpreted. Nothing is
 *   dropped: your writing is always visible, it is just never executed.
 */

import type { ReactNode } from 'react'
import { Lexer, type Token, type Tokens } from 'marked'

/** The only URL schemes a note may link to. Anything else renders as text. */
const SAFE_SCHEME = /^(?:https?:|mailto:)/i
/** A scheme-looking prefix, so relative and anchor links can be told apart. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

function safeHref(href: string): string | null {
  const trimmed = href.trim()
  if (trimmed === '') return null
  if (HAS_SCHEME.test(trimmed)) return SAFE_SCHEME.test(trimmed) ? trimmed : null
  // Relative, root-relative or a fragment: no scheme, nothing to execute.
  return trimmed
}

// --- inline ---------------------------------------------------------------

function Inline({ token }: { token: Token }): ReactNode {
  switch (token.type) {
    case 'text':
    case 'escape': {
      const nested = (token as Tokens.Text).tokens
      if (nested !== undefined && nested.length > 0) return <Inlines tokens={nested} />
      return token.text
    }
    case 'strong':
      return (
        <strong className="font-semibold text-text">
          <Inlines tokens={token.tokens} />
        </strong>
      )
    case 'em':
      return (
        <em className="italic">
          <Inlines tokens={token.tokens} />
        </em>
      )
    case 'del':
      return (
        <del className="text-text-muted line-through">
          <Inlines tokens={token.tokens} />
        </del>
      )
    case 'codespan':
      return (
        <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.9em] text-text">
          {token.text}
        </code>
      )
    case 'br':
      return <br />
    case 'link': {
      const href = safeHref(token.href)
      if (href === null) return <Inlines tokens={token.tokens} />
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          title={token.title ?? undefined}
          className="text-accent underline underline-offset-2 hover:text-accent-hover"
        >
          <Inlines tokens={token.tokens} />
        </a>
      )
    }
    case 'image': {
      const src = safeHref(token.href)
      if (src === null) return token.text
      return (
        <img
          src={src}
          alt={token.text}
          title={token.title ?? undefined}
          className="my-2 max-w-full rounded-lg border border-border"
        />
      )
    }
    // Raw HTML the writer typed. Shown, never interpreted.
    case 'html':
      return token.raw
    default:
      return 'text' in token ? token.text : token.raw
  }
}

/**
 * `Token` is a union that includes marked's open-ended `Generic`, so a nested
 * `tokens` reads as possibly undefined however it is narrowed. Tolerating that
 * here keeps the cast out of every call site.
 */
function Inlines({ tokens }: { tokens: readonly Token[] | undefined }) {
  return (
    <>
      {(tokens ?? []).map((token, index) => (
        <Inline key={index} token={token} />
      ))}
    </>
  )
}

// --- block ----------------------------------------------------------------

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-6 text-xl font-semibold tracking-tight text-text first:mt-0',
  2: 'mt-6 text-lg font-semibold tracking-tight text-text first:mt-0',
  3: 'mt-5 text-base font-semibold text-text first:mt-0',
  4: 'mt-5 text-sm font-semibold text-text first:mt-0',
  5: 'mt-4 text-sm font-semibold text-text-muted first:mt-0',
  6: 'mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted first:mt-0',
}

const ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const

function alignOf(align: 'center' | 'left' | 'right' | null): string {
  return align === null ? 'text-left' : ALIGN_CLASS[align]
}

function Table({ token }: { token: Tokens.Table }) {
  return (
    // A Paradigm table is wider than a phone. Scrolling it beats wrapping every
    // cell into an unreadable column.
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-sunken">
          <tr>
            {token.header.map((cell, index) => (
              <th
                key={index}
                scope="col"
                className={`border-b border-border px-3 py-2 font-semibold text-text ${alignOf(
                  token.align[index] ?? null,
                )}`}
              >
                <Inlines tokens={cell.tokens} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-b-0">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={`px-3 py-2 text-text ${alignOf(token.align[index] ?? null)}`}
                >
                  <Inlines tokens={cell.tokens} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ListItem({ item }: { item: Tokens.ListItem }) {
  return (
    <li className={item.task ? 'list-none' : undefined}>
      {item.task ? (
        <input
          type="checkbox"
          checked={item.checked === true}
          readOnly
          className="mr-2 align-middle accent-accent"
        />
      ) : null}
      <Blocks tokens={item.tokens} />
    </li>
  )
}

function List({ token }: { token: Tokens.List }) {
  const items = token.items.map((item, index) => <ListItem key={index} item={item} />)
  return token.ordered ? (
    <ol
      start={typeof token.start === 'number' ? token.start : undefined}
      className="my-3 list-decimal space-y-1 pl-6 text-text marker:text-text-muted"
    >
      {items}
    </ol>
  ) : (
    <ul className="my-3 list-disc space-y-1 pl-6 text-text marker:text-text-muted">{items}</ul>
  )
}

function Block({ token }: { token: Token }): ReactNode {
  switch (token.type) {
    case 'space':
    case 'def':
      return null
    case 'heading':
      return (
        <Heading depth={token.depth}>
          <Inlines tokens={token.tokens} />
        </Heading>
      )
    case 'paragraph':
      return (
        <p className="my-3 leading-relaxed text-text first:mt-0">
          <Inlines tokens={token.tokens} />
        </p>
      )
    case 'text': {
      const nested = (token as Tokens.Text).tokens
      return nested === undefined ? token.text : <Inlines tokens={nested} />
    }
    case 'table':
      return <Table token={token as Tokens.Table} />
    case 'list':
      return <List token={token as Tokens.List} />
    case 'blockquote':
      return (
        <blockquote className="my-3 border-l-2 border-border-strong pl-4 text-text-muted">
          <Blocks tokens={token.tokens} />
        </blockquote>
      )
    case 'code':
      return (
        <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-surface-sunken p-3">
          <code className="font-mono text-xs leading-relaxed text-text">{token.text}</code>
        </pre>
      )
    case 'hr':
      return <hr className="my-5 border-t border-border" />
    // A block of raw HTML: the characters as typed, never interpreted.
    case 'html':
      return (
        <p className="my-3 whitespace-pre-wrap font-mono text-xs text-text-muted">
          {token.raw.trimEnd()}
        </p>
      )
    default:
      return (
        <p className="my-3 whitespace-pre-wrap leading-relaxed text-text">
          {'text' in token ? token.text : token.raw}
        </p>
      )
  }
}

function Heading({ depth, children }: { depth: number; children: ReactNode }) {
  const className = HEADING_CLASS[depth] ?? HEADING_CLASS[6]
  switch (depth) {
    case 1:
      return <h2 className={className}>{children}</h2>
    case 2:
      return <h3 className={className}>{children}</h3>
    case 3:
      return <h4 className={className}>{children}</h4>
    case 4:
      return <h5 className={className}>{children}</h5>
    default:
      // The screen owns the only <h1>, so a note's headings start one level
      // down and flatten out at <h6> rather than inventing deeper tags.
      return <h6 className={className}>{children}</h6>
  }
}

function Blocks({ tokens }: { tokens: readonly Token[] | undefined }) {
  return (
    <>
      {(tokens ?? []).map((token, index) => (
        <Block key={index} token={token} />
      ))}
    </>
  )
}

/**
 * A Grammar Note's Markdown body, rendered. `lang="sv"` is deliberately *not*
 * set: a note explains Swedish in English and quotes Swedish inside itself.
 */
export function Markdown({ body }: { body: string }) {
  const tokens = Lexer.lex(body, { gfm: true })
  return (
    <div className="text-sm">
      <Blocks tokens={tokens} />
    </div>
  )
}
