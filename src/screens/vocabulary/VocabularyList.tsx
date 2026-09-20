// The Vocabulary Entry list, with search and filters (#21).
//
// Filtering is the repository's job, not this screen's: `listVocabularyEntries`
// narrows through an index where one exists and derives completeness from the
// Paradigm at query time, so the list can never disagree with the entries.
//
// The completeness filter doubles as the review list of spec section 4,
// behaviour 5 — "Missing Forms" is where a word captured in a hurry comes back.
// Gender is deliberately *not* part of it: a noun with four Forms and no Gender
// is Complete by the glossary's definition.
//
// Gender gets a review list of its own instead, as a separate toggle rather
// than an option inside the completeness filter. Spec section 4 opens by calling
// Gender the one thing that cannot be guessed, so a genderless noun has to be
// findable — but folding it into Complete would redefine a Paradigm, which the
// glossary fixes at four/four/three.

import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { SEARCH_DEBOUNCE_MS } from '../../components/liveSearch.ts'
import { Screen } from '../../components/Screen.tsx'
import { FOCUS_RING as FOCUS } from '../../components/styles.ts'
import type { Completeness, VocabularyQuery } from '../../data/index.ts'
import { distinctTags, listVocabularyEntries } from '../../data/index.ts'
import type { PartOfSpeech, Tag, VocabularyEntry } from '../../domain/index.ts'
import { PARTS_OF_SPEECH } from '../../domain/index.ts'
import { GenderBadge, ParadigmBadge, PartOfSpeechBadge, TagList } from './badges.tsx'
import { formsOf, PARADIGM_FIELDS, PART_OF_SPEECH_LABELS } from './vocabularyDraft.ts'

const PRIMARY_BUTTON = `inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:bg-accent-hover ${FOCUS}`
const CONTROL =
  'w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus'

const ANY = ''

type PartOfSpeechFilter = PartOfSpeech | typeof ANY
type CompletenessFilter = Completeness | typeof ANY

/** The Forms an entry has, in Paradigm order, for the one-line preview. */
function formPreview(entry: VocabularyEntry): string {
  const forms = formsOf(entry)
  if (forms === null) return ''
  return PARADIGM_FIELDS[entry.partOfSpeech]
    .map((name) => forms[name])
    .filter((form): form is string => form !== undefined && form.trim() !== '')
    .join(' · ')
}

function EntryRow({ entry }: { entry: VocabularyEntry }) {
  const preview = formPreview(entry)
  return (
    <li>
      <Link
        to={`/vocabulary/${entry.id}`}
        className={`flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:border-border-strong ${FOCUS}`}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {entry.partOfSpeech === 'noun' ? <GenderBadge gender={entry.gender} /> : null}
          <span className="text-base font-semibold text-text">{entry.lemma}</span>
          {entry.translation === '' ? null : (
            <span className="text-sm text-text-muted">{entry.translation}</span>
          )}
        </div>

        {preview === '' ? null : (
          <p className="text-sm text-text-muted" lang="sv">
            {preview}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <PartOfSpeechBadge partOfSpeech={entry.partOfSpeech} />
          <ParadigmBadge entry={entry} />
          <TagList tags={entry.tags} />
        </div>
      </Link>
    </li>
  )
}

export function VocabularyList() {
  const [search, setSearch] = useState('')
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeechFilter>(ANY)
  const [tag, setTag] = useState<Tag | typeof ANY>(ANY)
  const [completeness, setCompleteness] = useState<CompletenessFilter>(ANY)
  const [missingGender, setMissingGender] = useState(false)

  const [entries, setEntries] = useState<VocabularyEntry[] | null>(null)
  const [allTags, setAllTags] = useState<readonly Tag[]>([])
  const [total, setTotal] = useState(0)

  // Every Tag in use, for the filter's options. Read once: the filtered query
  // below cannot supply them, since a Tag filter hides the other Tags.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const all = await listVocabularyEntries()
      if (cancelled) return
      setTotal(all.length)
      // Folded without regard to case, so one Tag is one option however it was
      // typed, in the spelling first used.
      setAllTags(distinctTags(all))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced like the journal and the Pin panel: typing a word is one query
  // rather than one per letter.
  useEffect(() => {
    let cancelled = false
    const query: VocabularyQuery = {
      search: search.trim() === '' ? undefined : search.trim(),
      partOfSpeech: partOfSpeech === ANY ? undefined : partOfSpeech,
      tag: tag === ANY ? undefined : tag,
      completeness: completeness === ANY ? undefined : completeness,
      ...(missingGender ? { missingGender: true } : {}),
    }
    const timer = setTimeout(() => {
      void (async () => {
        const found = await listVocabularyEntries(query)
        if (!cancelled) setEntries(found)
      })()
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, partOfSpeech, tag, completeness, missingGender])

  const filtering =
    search.trim() !== '' ||
    partOfSpeech !== ANY ||
    tag !== ANY ||
    completeness !== ANY ||
    missingGender

  return (
    <Screen title="Vocabulary" description="The words and expressions you have captured.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="search"
              className={CONTROL}
              value={search}
              placeholder="Search Lemma, translation or example sentence"
              aria-label="Search the Vocabulary"
              onChange={(event) => {
                setSearch(event.target.value)
              }}
            />
            <Link to="/vocabulary/new" className={`${PRIMARY_BUTTON} shrink-0`}>
              Capture
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <select
              className={CONTROL}
              value={partOfSpeech}
              aria-label="Filter by Part of Speech"
              onChange={(event) => {
                setPartOfSpeech(event.target.value as PartOfSpeechFilter)
              }}
            >
              <option value={ANY}>Any Part of Speech</option>
              {PARTS_OF_SPEECH.map((value) => (
                <option key={value} value={value}>
                  {PART_OF_SPEECH_LABELS[value]}
                </option>
              ))}
            </select>

            <select
              className={CONTROL}
              value={tag}
              aria-label="Filter by Tag"
              disabled={allTags.length === 0}
              onChange={(event) => {
                setTag(event.target.value)
              }}
            >
              <option value={ANY}>
                {allTags.length === 0 ? 'No Tags yet' : 'Any Tag'}
              </option>
              {allTags.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              className={CONTROL}
              value={completeness}
              aria-label="Filter by completeness"
              onChange={(event) => {
                setCompleteness(event.target.value as CompletenessFilter)
              }}
            >
              <option value={ANY}>Complete or not</option>
              <option value="incomplete">Missing Forms</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          {/* Its own control, never an option inside the completeness filter:
              Gender is not a Form and a noun without one is still Complete. */}
          <button
            type="button"
            aria-pressed={missingGender}
            onClick={() => {
              setMissingGender(!missingGender)
            }}
            className={[
              'self-start rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              FOCUS,
              missingGender
                ? 'border-warning bg-warning-soft text-warning'
                : 'border-border bg-surface-raised text-text-muted hover:text-text',
            ].join(' ')}
          >
            Nouns missing Gender
          </button>
        </div>

        {entries === null ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface-sunken p-6 text-center">
            <p className="text-sm font-medium text-text">
              {total === 0 ? 'No words yet.' : 'Nothing matches those filters.'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {total === 0
                ? 'Capture the first one — a Lemma is enough to start.'
                : 'Try a broader search, or clear a filter.'}
            </p>
            {total === 0 ? (
              <Link to="/vocabulary/new" className={`${PRIMARY_BUTTON} mt-4`}>
                Capture a word
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {filtering
                ? `${String(entries.length)} of ${String(total)} words`
                : `${String(entries.length)} ${entries.length === 1 ? 'word' : 'words'}`}
            </p>
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Screen>
  )
}
