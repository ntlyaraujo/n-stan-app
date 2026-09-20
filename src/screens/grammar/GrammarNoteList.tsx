/**
 * The Grammar Note list, with search and a Tag filter (#31).
 *
 * Filtering is the repository's job: `listGrammarNotes` narrows through an
 * index where one exists and searches title and body together, so the list can
 * never disagree with the notes.
 *
 * **Tags are one namespace.** A Tag such as *verb tenses* is the same Tag here
 * and on a Vocabulary Entry, so when one is selected the screen says how many
 * words carry it too — otherwise the shared namespace is a claim in the spec
 * that nothing on screen ever demonstrates.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Screen } from '../../components/Screen.tsx'
import { listGrammarNotes, listVocabularyEntries } from '../../data/index.ts'
import type { GrammarNote, Tag } from '../../domain/index.ts'
import { BADGE_NEUTRAL, BUTTON_PRIMARY, FOCUS_RING, INPUT } from './grammarStyles.ts'

const ANY = ''

/** The first line of prose in the body, for the row's one-line preview. */
function bodyPreview(body: string): string {
  const line = body
    .split('\n')
    .map((raw) => raw.trim())
    .find((raw) => raw !== '' && !raw.startsWith('#') && !raw.startsWith('|'))
  return line === undefined ? '' : line.replace(/[*_`>]/gu, '')
}

function NoteRow({ note }: { note: GrammarNote }) {
  const preview = bodyPreview(note.body)
  return (
    <li>
      <Link
        to={`/grammar/${note.id}`}
        className={`flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:border-border-strong ${FOCUS_RING}`}
      >
        <span className="text-base font-semibold text-text">
          {note.title === '' ? 'Untitled Grammar Note' : note.title}
        </span>
        {preview === '' ? null : (
          <span className="line-clamp-2 text-sm text-text-muted">{preview}</span>
        )}
        <span className="flex flex-wrap items-center gap-1.5">
          {note.tags.map((tag) => (
            <span key={tag} className={BADGE_NEUTRAL}>
              {tag}
            </span>
          ))}
          {note.references.length > 0 ? (
            <span className={`${BADGE_NEUTRAL} text-accent`}>
              {note.references.length === 1
                ? '1 Reference'
                : `${String(note.references.length)} References`}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  )
}

export function GrammarNoteList() {
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<Tag | typeof ANY>(ANY)

  const [notes, setNotes] = useState<GrammarNote[] | null>(null)
  const [allTags, setAllTags] = useState<readonly Tag[]>([])
  const [total, setTotal] = useState(0)
  // Stored together with the Tag it answers, so `wordsSharingTag` is derived
  // from the match rather than cleared by a setState inside an effect body.
  const [sharing, setSharing] = useState<{ tag: Tag | typeof ANY; words: number }>({
    tag: ANY,
    words: 0,
  })

  // Every Tag in use, for the filter's options. Read once: the filtered query
  // below cannot supply them, since a Tag filter hides the other Tags.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const all = await listGrammarNotes()
      if (cancelled) return
      setTotal(all.length)
      setAllTags([...new Set(all.flatMap((note) => note.tags))].sort())
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const term = search.trim()
    void (async () => {
      const found = await listGrammarNotes({
        search: term === '' ? undefined : term,
        tag: tag === ANY ? undefined : tag,
      })
      if (!cancelled) setNotes(found)
    })()
    return () => {
      cancelled = true
    }
  }, [search, tag])

  // One namespace, made visible: the selected Tag also reaches words.
  useEffect(() => {
    if (tag === ANY) return
    let cancelled = false
    void (async () => {
      const words = await listVocabularyEntries({ tag })
      if (!cancelled) setSharing({ tag, words: words.length })
    })()
    return () => {
      cancelled = true
    }
  }, [tag])

  const wordsSharingTag = sharing.tag === tag ? sharing.words : 0
  const filtering = search.trim() !== '' || tag !== ANY

  return (
    <Screen title="Grammar" description="The rules you have written down for yourself.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="search"
              className={INPUT}
              value={search}
              placeholder="Search titles and bodies"
              aria-label="Search the Grammar Notes"
              onChange={(event) => {
                setSearch(event.target.value)
              }}
            />
            <Link to="/grammar/new" className={`${BUTTON_PRIMARY} shrink-0`}>
              Write one
            </Link>
          </div>

          <select
            className={INPUT}
            value={tag}
            aria-label="Filter by Tag"
            disabled={allTags.length === 0}
            onChange={(event) => {
              setTag(event.target.value)
            }}
          >
            <option value={ANY}>{allTags.length === 0 ? 'No Tags yet' : 'Any Tag'}</option>
            {allTags.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          {tag !== ANY && wordsSharingTag > 0 ? (
            <p className="text-xs text-text-muted">
              {wordsSharingTag === 1
                ? '1 Vocabulary Entry carries'
                : `${String(wordsSharingTag)} Vocabulary Entries carry`}{' '}
              the Tag “{tag}” too —{' '}
              <Link to="/vocabulary" className={`text-accent underline ${FOCUS_RING}`}>
                see them in Vocabulary
              </Link>
              .
            </p>
          ) : null}
        </div>

        {notes === null ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : notes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface-sunken p-6 text-center">
            <p className="text-sm font-medium text-text">
              {total === 0 ? 'No Grammar Notes yet.' : 'Nothing matches that.'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {total === 0
                ? 'Write down the rule you keep looking up. Markdown, including tables.'
                : 'Try a broader search, or clear the Tag filter.'}
            </p>
            {total === 0 ? (
              <Link to="/grammar/new" className={`${BUTTON_PRIMARY} mt-4`}>
                Write a Grammar Note
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {filtering
                ? `${String(notes.length)} of ${String(total)} Grammar Notes`
                : `${String(notes.length)} ${notes.length === 1 ? 'Grammar Note' : 'Grammar Notes'}`}
            </p>
            <ul className="flex flex-col gap-2">
              {notes.map((note) => (
                <NoteRow key={note.id} note={note} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Screen>
  )
}
