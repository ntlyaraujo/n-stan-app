// Capturing a Vocabulary Entry (#20), with Auto-fill from the Dictionary
// (#17/#19) and the offline behaviour of #22. Serves both /vocabulary/new and
// /vocabulary/:vocabularyEntryId/edit.
//
// Three things here are load-bearing and easy to break:
//
//   * **Every Form is optional.** The only thing that stops a save is an empty
//     Lemma. A half-filled Paradigm is a legitimate entry and the completeness
//     filter offers it back later for review.
//   * **Auto-fill prefills and never locks.** Nothing on this screen is ever
//     disabled or read-only because the Dictionary answered. The automatic fill
//     additionally keeps whatever you typed; the Auto-fill button, which you
//     pressed on purpose, overwrites.
//   * **Nothing waits on the network.** A Lookup is fired off when the Lemma
//     settles, never on the save path. If no answer has arrived by the time you
//     save, the entry is written with its Lookup marked deferred and tried again
//     when it is next opened — being on the underground never blocks capture.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Screen } from '../../components/Screen.tsx'
import type { DuplicateLemmaWarning } from '../../data/index.ts'
import {
  createVocabularyEntry,
  duplicateLemmaWarning,
  getVocabularyEntry,
  lemmaKey,
  listVocabularyEntries,
  saveVocabularyEntry,
} from '../../data/index.ts'
import type {
  ConjugationGroup,
  Gender,
  PartOfSpeech,
  Tag,
  VocabularyEntry,
} from '../../domain/index.ts'
import {
  CONJUGATION_GROUPS,
  GENDERS,
  PARTS_OF_SPEECH,
  shouldAttemptLookup,
} from '../../domain/index.ts'
import type { DictionaryLookup, LookupPartOfSpeech } from '../../dictionary/index.ts'
import { supportsLookup } from '../../dictionary/index.ts'
import { attemptLookup, isOnline } from './autoFill.ts'
import { Badge, Notice } from './badges.tsx'
import { ChoiceField, SelectField, TagEditor, TextAreaField, TextField } from './fields.tsx'
import type { VocabularyDraft } from './vocabularyDraft.ts'
import {
  draftFromEntry,
  draftWithSense,
  emptyDraft,
  entryFromDraft,
  FORM_EXAMPLES,
  FORM_LABELS,
  PARADIGM_FIELDS,
  PART_OF_SPEECH_LABELS,
  senseLabel,
  vocabularyEntryDraftOf,
} from './vocabularyDraft.ts'

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
const PRIMARY_BUTTON = `inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-50 ${FOCUS}`
const SECONDARY_BUTTON = `inline-flex items-center justify-center rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text hover:bg-surface-sunken disabled:opacity-50 ${FOCUS}`
const CARD = 'flex flex-col gap-4 rounded-xl border border-border bg-surface-raised p-4'

const LEMMA_PLACEHOLDERS: Record<PartOfSpeech, string> = {
  noun: 'bok',
  verb: 'tala',
  adjective: 'stor',
  adverb: 'gärna',
  phrase: 'det spelar ingen roll',
  other: '',
}

const PART_OF_SPEECH_OPTIONS = PARTS_OF_SPEECH.map((partOfSpeech) => ({
  value: partOfSpeech,
  label: PART_OF_SPEECH_LABELS[partOfSpeech],
}))

const GENDER_OPTIONS: readonly { value: Gender | ''; label: string }[] = [
  ...GENDERS.map((gender) => ({ value: gender as Gender | '', label: gender })),
  { value: '', label: 'Not set' },
]

const CONJUGATION_GROUP_OPTIONS: readonly { value: ConjugationGroup | ''; label: string }[] =
  [
    { value: '', label: 'Not set' },
    ...CONJUGATION_GROUPS.map((group) => ({
      value: group as ConjugationGroup | '',
      label: `Group ${group}`,
    })),
  ]

/** The browser's own answer, kept current: `navigator.onLine` does not re-render. */
function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline)
  useEffect(() => {
    const update = () => {
      setOnline(isOnline())
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

export function VocabularyCaptureForm() {
  const { vocabularyEntryId } = useParams()
  const navigate = useNavigate()
  const online = useOnline()

  const [entry, setEntry] = useState<VocabularyEntry | null>(null)
  const [draft, setDraft] = useState<VocabularyDraft>(emptyDraft)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>(
    vocabularyEntryId === undefined ? 'ready' : 'loading',
  )
  const [lookup, setLookup] = useState<DictionaryLookup | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [duplicate, setDuplicate] = useState<DuplicateLemmaWarning | null>(null)
  const [knownTags, setKnownTags] = useState<readonly Tag[]>([])
  const [saving, setSaving] = useState(false)

  /** Lemma-and-Part-of-Speech pairs already tried, so a blur does not re-ask. */
  const attempted = useRef(new Set<string>())

  /**
   * One Lookup, applied to the draft. Stable, so the load effect can call it.
   *
   * `keepTyped` is the automatic fill; the Auto-fill button passes false because
   * being asked for the Dictionary's answer is the point of pressing it.
   */
  const runLookup = useCallback(
    async (lemma: string, partOfSpeech: LookupPartOfSpeech, keepTyped: boolean) => {
      const trimmed = lemma.trim()
      if (trimmed === '') return
      attempted.current.add(`${lemmaKey(trimmed)}|${partOfSpeech}`)

      setLookingUp(true)
      const result = await attemptLookup(trimmed, partOfSpeech)
      setLookingUp(false)
      setLookup(result)
      setDraft((current) => {
        // The word moved on while we were waiting: this answer is stale.
        if (current.lemma.trim() !== trimmed || current.partOfSpeech !== partOfSpeech) {
          return current
        }
        const filled =
          result.outcome === 'filled'
            ? draftWithSense(current, result.senses[0], { keepTyped })
            : current
        return { ...filled, lookupOutcome: result.outcome }
      })
    },
    [],
  )

  // Load, and — for an entry whose Lookup is still owed (#22) — try again now
  // that there may be a connection. This prefills the draft rather than writing:
  // on this screen your Save is what saves. The detail screen writes it through.
  useEffect(() => {
    let cancelled = false
    attempted.current = new Set()

    void (async () => {
      const found =
        vocabularyEntryId === undefined
          ? undefined
          : await getVocabularyEntry(vocabularyEntryId)
      if (cancelled) return

      setLookup(null)
      if (vocabularyEntryId === undefined) {
        setEntry(null)
        setDraft(emptyDraft())
        setState('ready')
        return
      }
      if (found === undefined) {
        setState('missing')
        return
      }

      setEntry(found)
      setDraft(draftFromEntry(found))
      setState('ready')
      if (shouldAttemptLookup(found) && supportsLookup(found.partOfSpeech)) {
        await runLookup(found.lemma, found.partOfSpeech, true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [vocabularyEntryId, runLookup])

  // The duplicate notice, kept current as the Lemma is typed. It never blocks:
  // *bok* the book and *bok* the beech are two Vocabulary Entries.
  useEffect(() => {
    const lemma = draft.lemma.trim()
    let cancelled = false
    void (async () => {
      const warning = await Promise.resolve(
        lemma === '' ? null : duplicateLemmaWarning(lemma, { ignoreId: vocabularyEntryId }),
      )
      if (!cancelled) setDuplicate(warning)
    })()
    return () => {
      cancelled = true
    }
  }, [draft.lemma, vocabularyEntryId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const entries = await listVocabularyEntries()
      if (cancelled) return
      setKnownTags([...new Set(entries.flatMap((each) => each.tags))].sort())
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = (patch: Partial<VocabularyDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  /** Fired when the Lemma settles or the Part of Speech changes. Never awaited. */
  const autoFill = (next: VocabularyDraft) => {
    const lemma = next.lemma.trim()
    if (lemma === '' || !supportsLookup(next.partOfSpeech)) return
    if (attempted.current.has(`${lemmaKey(lemma)}|${next.partOfSpeech}`)) return
    void runLookup(lemma, next.partOfSpeech, true)
  }

  const changePartOfSpeech = (partOfSpeech: PartOfSpeech) => {
    // Forms already typed are kept across the change: the draft holds every
    // Paradigm, so switching back finds them where they were left.
    const next: VocabularyDraft = { ...draft, partOfSpeech }
    setDraft(next)
    autoFill(next)
  }

  const save = async (andAnother: boolean) => {
    if (draft.lemma.trim() === '' || saving) return
    setSaving(true)

    // No Lookup on the save path — see the note at the top of this file. If we
    // still have no answer, the entry is marked deferred and retried on open.
    const lookupOutcome =
      draft.lookupOutcome === 'never-attempted' && supportsLookup(draft.partOfSpeech)
        ? 'deferred'
        : draft.lookupOutcome
    const finished: VocabularyDraft = { ...draft, lookupOutcome }

    try {
      if (entry !== null) {
        const saved = await saveVocabularyEntry(entryFromDraft(entry, finished))
        void navigate(`/vocabulary/${saved.id}`)
        return
      }

      const created = await createVocabularyEntry(vocabularyEntryDraftOf(finished))
      if (!andAnother) {
        void navigate(`/vocabulary/${created.entry.id}`)
        return
      }
      attempted.current = new Set()
      setDraft({ ...emptyDraft(), partOfSpeech: draft.partOfSpeech, tags: draft.tags })
      setLookup(null)
      setDuplicate(null)
      setKnownTags((tags) => [...new Set([...tags, ...created.entry.tags])].sort())
    } finally {
      setSaving(false)
    }
  }

  if (state === 'loading') {
    return (
      <Screen title="Capture a word">
        <p className="text-sm text-text-muted">Loading…</p>
      </Screen>
    )
  }

  if (state === 'missing') {
    return (
      <Screen title="Not found" description="That Vocabulary Entry no longer exists.">
        <Link to="/vocabulary" className={PRIMARY_BUTTON}>
          Back to Vocabulary
        </Link>
      </Screen>
    )
  }

  const paradigm = PARADIGM_FIELDS[draft.partOfSpeech]
  const partOfSpeech = draft.partOfSpeech
  // Narrowed once, here: SALDO has a Paradigm for three of the six Parts of
  // Speech, and `null` is the other three.
  const lookupPartOfSpeech = supportsLookup(partOfSpeech) ? partOfSpeech : null
  const canSave = draft.lemma.trim() !== '' && !saving

  return (
    <Screen
      title={entry === null ? 'Capture a word' : 'Edit a word'}
      description="Every Form is optional. Save now, complete the Paradigm whenever you like."
    >
      <form
        className="flex flex-col gap-4 pb-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save(false)
        }}
      >
        <div className={CARD}>
          <TextField
            label="Lemma"
            value={draft.lemma}
            placeholder={LEMMA_PLACEHOLDERS[draft.partOfSpeech]}
            hint="The word or expression as you would look it up."
            autoFocus={entry === null}
            onChange={(lemma) => {
              update({ lemma })
            }}
            onBlur={() => {
              autoFill(draft)
            }}
          />

          {duplicate !== null ? (
            <Notice
              tone="warning"
              title={`You already have ${duplicate.lemma}.`}
            >
              <p>
                Homonyms are real — <em>bok</em> the book and <em>bok</em> the beech tree are
                two Vocabulary Entries. This is a note, not a block: saving works exactly as
                it would otherwise.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {duplicate.existing.map((existing) => (
                  <li key={existing.id}>
                    <Link
                      to={`/vocabulary/${existing.id}`}
                      className={`underline decoration-border-strong underline-offset-2 hover:text-text ${FOCUS}`}
                    >
                      {existing.lemma}
                      {existing.translation === '' ? '' : ` — ${existing.translation}`}
                    </Link>
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}

          <SelectField
            label="Part of Speech"
            value={draft.partOfSpeech}
            options={PART_OF_SPEECH_OPTIONS}
            hint={
              paradigm.length === 0
                ? `A ${PART_OF_SPEECH_LABELS[draft.partOfSpeech].toLowerCase()} has no Paradigm, so there are no Forms to fill in.`
                : 'It decides which Forms this entry has.'
            }
            onChange={changePartOfSpeech}
          />
        </div>

        {lookupPartOfSpeech !== null ? (
          <div className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-text">Dictionary</p>
                <p className="text-xs text-text-muted">
                  SALDO fills the Paradigm in. Everything it writes stays editable.
                </p>
              </div>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                disabled={draft.lemma.trim() === '' || lookingUp}
                onClick={() => {
                  void runLookup(draft.lemma, lookupPartOfSpeech, false)
                }}
              >
                {lookingUp ? 'Looking up…' : 'Auto-fill'}
              </button>
            </div>

            {!online ? (
              <Notice tone="warning" title="No connection.">
                The word saves now, with whatever you type. The Dictionary is tried again the
                next time you open this entry with a connection — nothing is queued and
                nothing is lost.
              </Notice>
            ) : null}

            {lookup?.outcome === 'not-found' ? (
              <Notice tone="neutral" title="SALDO does not have this word.">
                Nothing is wrong with the entry — type the Forms you know, or leave them for
                later.
              </Notice>
            ) : null}

            {online && lookup?.outcome === 'deferred' ? (
              <Notice tone="warning" title="The Dictionary could not be reached.">
                {lookup.reason}. Saving is unaffected; it is tried again when you next open
                this entry.
              </Notice>
            ) : null}

            {lookup?.outcome === 'filled' && lookup.senses.length > 1 ? (
              <Notice
                tone="neutral"
                title={`SALDO has ${String(lookup.senses.length)} senses of ${lookup.lemma}.`}
                actions={lookup.senses.map((sense) => (
                  <button
                    key={sense.lemgram}
                    type="button"
                    className={SECONDARY_BUTTON}
                    onClick={() => {
                      setDraft((current) =>
                        draftWithSense(current, sense, { keepTyped: false }),
                      )
                    }}
                  >
                    {senseLabel(sense)}
                  </button>
                ))}
              >
                It offers no definition to tell them apart, so the Forms are the difference.
                The first is already filled in; pick another to use it instead.
              </Notice>
            ) : null}
          </div>
        ) : null}

        {draft.partOfSpeech === 'noun' ? (
          <div className={CARD}>
            <ChoiceField
              label="Gender"
              value={draft.gender}
              options={GENDER_OPTIONS}
              hint="en or ett. Not a Form, so it does not affect Complete — but it is the one thing about a Swedish noun you cannot guess."
              onChange={(gender) => {
                update({ gender })
              }}
            />
            {draft.gender === '' ? (
              <p className="text-xs font-medium text-warning">
                No Gender yet. Auto-fill knows it, if SALDO has the word.
              </p>
            ) : null}
          </div>
        ) : null}

        {draft.partOfSpeech === 'verb' ? (
          <div className={CARD}>
            <SelectField
              label="Conjugation Group"
              value={draft.conjugationGroup}
              options={CONJUGATION_GROUP_OPTIONS}
              hint="Derived best-effort from the Dictionary and always correctable. Not a Form, so it does not affect Complete."
              onChange={(conjugationGroup) => {
                update({ conjugationGroup })
              }}
            />
          </div>
        ) : null}

        {paradigm.length > 0 ? (
          <div className={CARD}>
            <p className="text-sm font-medium text-text">Forms</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {paradigm.map((name) => (
                <TextField
                  key={name}
                  label={FORM_LABELS[name]}
                  value={draft.forms[name]}
                  placeholder={FORM_EXAMPLES[name]}
                  onChange={(value) => {
                    setDraft((current) => ({
                      ...current,
                      forms: { ...current.forms, [name]: value },
                    }))
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className={CARD}>
          <TextField
            label="Translation"
            value={draft.translation}
            placeholder="book"
            onChange={(translation) => {
              update({ translation })
            }}
          />
          <TextAreaField
            label="Example sentence"
            value={draft.exampleSentence}
            placeholder="Jag läser en bok varje kväll."
            hint="One sentence, in your own words. This is the part you will remember."
            onChange={(exampleSentence) => {
              update({ exampleSentence })
            }}
          />
          <TagEditor
            tags={draft.tags}
            suggestions={knownTags}
            onChange={(tags) => {
              update({ tags })
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={!canSave}>
            {saving ? 'Saving…' : entry === null ? 'Save' : 'Save changes'}
          </button>
          {entry === null ? (
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={!canSave}
              onClick={() => {
                void save(true)
              }}
            >
              Save and capture another
            </button>
          ) : null}
          <Link
            to={entry === null ? '/vocabulary' : `/vocabulary/${entry.id}`}
            className={SECONDARY_BUTTON}
          >
            Cancel
          </Link>
          {lookingUp ? (
            <Badge tone="accent">Looking the Lemma up…</Badge>
          ) : null}
        </div>
      </form>
    </Screen>
  )
}
