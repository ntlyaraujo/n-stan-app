// One Vocabulary Entry: its Paradigm, its Gender, its Tags — and the automatic
// fill retry of #22.
//
// **Opening this screen is the retry.** There is no background sync queue: an
// entry whose Lookup was deferred or never attempted is looked up here, once,
// when it is opened with a connection, and the result is written through.
// `shouldAttemptLookup` decides that; completeness never does.
//
// Two later tickets extend this screen, and both have landed, in the marked
// section near the bottom: #33, the Backlinks from the Grammar Notes that
// Reference this word, and #43, the Journal Entries that Pinned it — the
// matching read against `links.ts` (`journalEntriesPinning`). Nothing above that
// section knows about either.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Screen } from '../../components/Screen.tsx'
import { FOCUS_RING as FOCUS } from '../../components/styles.ts'
import type { DeletionImpact } from '../../data/index.ts'
import {
  deleteVocabularyEntry,
  deletionImpactForVocabularyEntry,
  getVocabularyEntry,
} from '../../data/index.ts'
import type { VocabularyEntry } from '../../domain/index.ts'
import { shouldAttemptLookup } from '../../domain/index.ts'
import type { DictionaryLookup } from '../../dictionary/index.ts'
import { supportsLookup } from '../../dictionary/index.ts'
import { DeletionWarning } from '../../components/DeletionWarning.tsx'
import { PinnedInJournalEntries } from '../../components/PinnedInJournalEntries.tsx'
import { VocabularyBacklinks } from '../../components/VocabularyBacklinks.tsx'
import { autoFillOnOpen, isOnline, LOOKUP_OUTCOME_LABELS } from './autoFill.ts'
import { Badge, GenderBadge, Notice, ParadigmBadge, PartOfSpeechBadge, TagList } from './badges.tsx'
import {
  FORM_LABELS,
  formsOf,
  PARADIGM_FIELDS,
  PART_OF_SPEECH_LABELS,
} from './vocabularyDraft.ts'

const PRIMARY_BUTTON = `inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:bg-accent-hover ${FOCUS}`
const SECONDARY_BUTTON = `inline-flex items-center justify-center rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text hover:bg-surface-sunken disabled:opacity-50 ${FOCUS}`
const DANGER_BUTTON = `inline-flex items-center justify-center rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft ${FOCUS}`
const CARD = 'flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4'

function Paradigm({ entry }: { entry: VocabularyEntry }) {
  const names = PARADIGM_FIELDS[entry.partOfSpeech]
  const forms = formsOf(entry)

  if (forms === null || names.length === 0) {
    // A phrase is not a degraded noun. It has no Paradigm, and that is the
    // finished shape of the entry rather than something still missing.
    return (
      <div className={CARD}>
        <p className="text-sm font-medium text-text">Forms</p>
        <p className="text-sm text-text-muted">
          {PART_OF_SPEECH_LABELS[entry.partOfSpeech]}s have no Paradigm. The translation and
          your own sentence are the whole entry.
        </p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="text-sm font-medium text-text">Forms</p>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {names.map((name) => {
          const value = forms[name]
          const filled = value !== undefined && value.trim() !== ''
          return (
            <div key={name} className="flex flex-col">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {FORM_LABELS[name]}
              </dt>
              <dd
                className={filled ? 'text-sm text-text' : 'text-sm italic text-text-muted'}
                lang={filled ? 'sv' : undefined}
              >
                {filled ? value : 'Not filled in'}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

export function VocabularyEntryDetail() {
  const { vocabularyEntryId } = useParams()
  const navigate = useNavigate()

  const [entry, setEntry] = useState<VocabularyEntry | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [lookup, setLookup] = useState<DictionaryLookup | null>(null)
  const [filling, setFilling] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [impact, setImpact] = useState<DeletionImpact | null>(null)
  const [deletingNow, setDeletingNow] = useState(false)

  useEffect(() => {
    if (vocabularyEntryId === undefined) return
    let cancelled = false

    void (async () => {
      const found = await getVocabularyEntry(vocabularyEntryId)
      if (cancelled) return
      setLookup(null)
      if (found === undefined) {
        setState('missing')
        return
      }
      setEntry(found)
      setState('ready')

      // #22: the retry. It resolves to null when nothing was due — an answered
      // Lookup, a Part of Speech SALDO has no Paradigm for, or no connection.
      setFilling(shouldAttemptLookup(found) && supportsLookup(found.partOfSpeech) && isOnline())
      const result = await autoFillOnOpen(found)
      if (cancelled) return
      setFilling(false)
      if (result === null) return
      setEntry(result.entry)
      setLookup(result.lookup)
    })()

    return () => {
      cancelled = true
    }
  }, [vocabularyEntryId])

  const retry = async () => {
    if (entry === null || filling) return
    setFilling(true)
    const result = await autoFillOnOpen(entry)
    setFilling(false)
    if (result === null) return
    setEntry(result.entry)
    setLookup(result.lookup)
  }

  // #34: what the delete costs is read when the warning opens, so the warning
  // and the delete that follows can never disagree — both come from `links.ts`.
  useEffect(() => {
    if (!confirmingDelete || entry === null) return
    let cancelled = false
    void (async () => {
      const found = await deletionImpactForVocabularyEntry(entry.id)
      if (!cancelled) setImpact(found)
    })()
    return () => {
      cancelled = true
    }
  }, [confirmingDelete, entry])

  const remove = async () => {
    if (entry === null) return
    setDeletingNow(true)
    await deleteVocabularyEntry(entry.id)
    void navigate('/vocabulary', { replace: true })
  }

  if (state === 'loading' && entry === null) {
    return (
      <Screen title="Vocabulary Entry">
        <p className="text-sm text-text-muted">Loading…</p>
      </Screen>
    )
  }

  if (state === 'missing' || entry === null) {
    return (
      <Screen title="Not found" description="That Vocabulary Entry no longer exists.">
        <Link to="/vocabulary" className={PRIMARY_BUTTON}>
          Back to Vocabulary
        </Link>
      </Screen>
    )
  }

  const owed = shouldAttemptLookup(entry) && supportsLookup(entry.partOfSpeech)

  return (
    <Screen title={entry.lemma}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <PartOfSpeechBadge partOfSpeech={entry.partOfSpeech} />
          {entry.partOfSpeech === 'noun' ? <GenderBadge gender={entry.gender} /> : null}
          {entry.partOfSpeech === 'verb' && entry.conjugationGroup !== undefined ? (
            <Badge>Group {entry.conjugationGroup}</Badge>
          ) : null}
          <ParadigmBadge entry={entry} />
          <Badge>{LOOKUP_OUTCOME_LABELS[entry.lookupOutcome]}</Badge>
        </div>

        {entry.translation === '' ? null : (
          <p className="text-lg text-text">{entry.translation}</p>
        )}

        {/* Gender is not a Form and does not affect Complete — but it is the one
            thing about a Swedish noun that cannot be guessed, so a missing one
            is said out loud rather than left as a blank. */}
        {entry.partOfSpeech === 'noun' && entry.gender === undefined ? (
          <Notice
            tone="warning"
            title="No Gender yet."
            actions={
              <>
                {owed ? null : (
                  <Link to={`/vocabulary/${entry.id}/edit`} className={SECONDARY_BUTTON}>
                    Set en or ett
                  </Link>
                )}
                {owed ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON}
                    disabled={filling}
                    onClick={() => {
                      void retry()
                    }}
                  >
                    {filling ? 'Looking up…' : 'Ask the Dictionary'}
                  </button>
                ) : null}
              </>
            }
          >
            <em>en</em> or <em>ett</em> is most of what a Swedish noun is, and it cannot be
            guessed from the word. This does not make the entry incomplete — Gender is not a
            Form — but it is worth filling in.
          </Notice>
        ) : null}

        {filling ? (
          <Notice tone="accent" title="Asking the Dictionary…">
            This entry was saved without its Forms. Filling them in now.
          </Notice>
        ) : null}

        {!filling && owed && !isOnline() ? (
          <Notice tone="warning" title="Still waiting for a connection.">
            The Forms are filled in automatically the next time this entry is opened online.
            Nothing is queued and nothing is lost.
          </Notice>
        ) : null}

        {!filling && owed && isOnline() ? (
          <Notice
            tone="neutral"
            title="The Dictionary has not answered for this word yet."
            actions={
              <button
                type="button"
                className={SECONDARY_BUTTON}
                onClick={() => {
                  void retry()
                }}
              >
                Try the Dictionary again
              </button>
            }
          >
            {lookup?.outcome === 'deferred' ? `${lookup.reason}.` : null}
          </Notice>
        ) : null}

        {lookup?.outcome === 'filled' ? (
          <Notice tone="success" title="Filled in from SALDO.">
            Everything it wrote is editable — nothing here is locked.
          </Notice>
        ) : null}

        <Paradigm entry={entry} />

        {entry.exampleSentence === '' ? null : (
          <div className={CARD}>
            <p className="text-sm font-medium text-text">Example sentence</p>
            <p className="text-sm leading-relaxed text-text" lang="sv">
              {entry.exampleSentence}
            </p>
          </div>
        )}

        {entry.tags.length > 0 ? (
          <div className={CARD}>
            <p className="text-sm font-medium text-text">Tags</p>
            <TagList tags={entry.tags} />
          </div>
        ) : null}

        {/* #33 — the Grammar Notes that Reference this word, derived on read and
            never stored — and, below it, #43: the Journal Entries that Pinned
            it. Together they close the loop the app is built around: capture,
            use in writing, review through what the word connects to. Each
            renders nothing when it has nothing to say. */}
        <VocabularyBacklinks vocabularyEntryId={entry.id} />
        <PinnedInJournalEntries vocabularyEntryId={entry.id} />

        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/vocabulary/${entry.id}/edit`} className={PRIMARY_BUTTON}>
            Edit
          </Link>
          <Link to="/vocabulary" className={SECONDARY_BUTTON}>
            All words
          </Link>
          {confirmingDelete ? null : (
            <button
              type="button"
              className={DANGER_BUTTON}
              onClick={() => {
                setConfirmingDelete(true)
              }}
            >
              Delete
            </button>
          )}
        </div>

        {confirmingDelete ? (
          <DeletionWarning
            deleting="vocabularyEntry"
            name={entry.lemma}
            impact={impact}
            deletingNow={deletingNow}
            onConfirm={() => {
              void remove()
            }}
            onCancel={() => {
              setConfirmingDelete(false)
              setImpact(null)
            }}
          />
        ) : null}
      </div>
    </Screen>
  )
}
