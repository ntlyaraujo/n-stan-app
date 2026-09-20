/**
 * One Grammar Note: its Markdown rendered (#30), the Vocabulary Entries it
 * References, and the delete warning that says what loses its link (#34).
 *
 * The body is rendered by `Markdown`, which lexes with `marked` and builds
 * React elements directly — no HTML string, so nothing needs scrubbing
 * afterwards. Tables are the reason the editor needs no table builder.
 *
 * It is loaded lazily because it is the only thing in the app that needs
 * `marked` (~14 kB gzipped), and the landing screen is the Journal. On a phone
 * on a bad connection, the first screen should not pay for a Markdown lexer it
 * will not use.
 *
 * Deleting is `deleteGrammarNote` from `links.ts`, never a repository delete:
 * Journal Entries that Pinned this note have to be left holding a Tombstone,
 * and the impact is shown first through `deletionImpactForGrammarNote`.
 */

import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Screen } from '../../components/Screen.tsx'
import type { DeletionImpact } from '../../data/index.ts'
import {
  deleteGrammarNote,
  deletionImpactForGrammarNote,
  getGrammarNote,
  referencedVocabularyEntries,
} from '../../data/index.ts'
import type { GrammarNote, VocabularyEntry } from '../../domain/index.ts'
import { DeletionWarning } from '../../components/DeletionWarning.tsx'
import {
  BADGE_NEUTRAL,
  BUTTON,
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  FOCUS_RING,
} from './grammarStyles.ts'

const Markdown = lazy(async () => ({ default: (await import('./Markdown.tsx')).Markdown }))

export function GrammarNoteDetail() {
  const { grammarNoteId } = useParams()
  const navigate = useNavigate()

  const [note, setNote] = useState<GrammarNote | null>(null)
  const [references, setReferences] = useState<readonly VocabularyEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  const [confirming, setConfirming] = useState(false)
  const [impact, setImpact] = useState<DeletionImpact | null>(null)
  const [deletingNow, setDeletingNow] = useState(false)

  useEffect(() => {
    if (grammarNoteId === undefined) return
    let cancelled = false
    void (async () => {
      const found = await getGrammarNote(grammarNoteId)
      if (cancelled) return
      if (found === undefined) {
        setStatus('missing')
        return
      }
      const referenced = await referencedVocabularyEntries(found.id)
      if (cancelled) return
      setNote(found)
      setReferences(referenced)
      setStatus('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [grammarNoteId])

  // The impact is read when the warning opens, not on every render, and the
  // warning stays disabled until it arrives — a delete is never offered before
  // the screen can say what it costs.
  useEffect(() => {
    if (!confirming || note === null) return
    let cancelled = false
    void (async () => {
      const found = await deletionImpactForGrammarNote(note.id)
      if (!cancelled) setImpact(found)
    })()
    return () => {
      cancelled = true
    }
  }, [confirming, note])

  const remove = async () => {
    if (note === null) return
    setDeletingNow(true)
    await deleteGrammarNote(note.id)
    void navigate('/grammar', { replace: true })
  }

  if (status === 'loading') {
    return (
      <Screen title="Grammar Note">
        <p className="text-sm text-text-muted">Loading…</p>
      </Screen>
    )
  }

  if (status === 'missing' || note === null) {
    return (
      <Screen title="Not found" description="That Grammar Note no longer exists.">
        <Link to="/grammar" className={BUTTON_PRIMARY}>
          Back to Grammar
        </Link>
      </Screen>
    )
  }

  return (
    <Screen title={note.title === '' ? 'Untitled Grammar Note' : note.title}>
      <div className="flex flex-col gap-4">
        {note.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <li key={tag} className={BADGE_NEUTRAL}>
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        {note.body.trim() === '' ? (
          <p className="text-sm italic text-text-muted">
            Nothing written yet. Markdown goes here — headings, lists and tables.
          </p>
        ) : (
          <Suspense fallback={<p className="text-sm text-text-muted">Rendering…</p>}>
            <Markdown body={note.body} />
          </Suspense>
        )}

        {references.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4">
            <div>
              <p className="text-sm font-medium text-text">References</p>
              <p className="mt-0.5 text-xs text-text-muted">
                The words this note explains. Each one shows this note back, as a Backlink.
              </p>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {references.map((entry) => (
                <li key={entry.id}>
                  <Link
                    to={`/vocabulary/${entry.id}`}
                    className={`inline-flex items-baseline gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent-soft ${FOCUS_RING}`}
                  >
                    <span lang="sv">{entry.lemma}</span>
                    {entry.translation === '' ? null : (
                      <span className="font-normal text-text-muted">{entry.translation}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/grammar/${note.id}/edit`} className={BUTTON_PRIMARY}>
            Edit
          </Link>
          <Link to="/grammar" className={BUTTON}>
            All Grammar Notes
          </Link>
          {confirming ? null : (
            <button
              type="button"
              className={BUTTON_DANGER}
              onClick={() => {
                setConfirming(true)
              }}
            >
              Delete
            </button>
          )}
        </div>

        {confirming ? (
          <DeletionWarning
            deleting="grammarNote"
            name={note.title === '' ? 'Untitled Grammar Note' : note.title}
            impact={impact}
            deletingNow={deletingNow}
            onConfirm={() => {
              void remove()
            }}
            onCancel={() => {
              setConfirming(false)
              setImpact(null)
            }}
          />
        ) : null}
      </div>
    </Screen>
  )
}
