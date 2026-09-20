/**
 * Writing a Grammar Note (#29) and picking the words it References (#32).
 * Serves both /grammar/new and /grammar/:grammarNoteId/edit.
 *
 * **The body is a plain textarea and that is the decision, not a shortcut.** A
 * rich text editor is a large dependency and behaves badly on mobile keyboards —
 * selection handles, autocorrect and the on-screen keyboard all fight a
 * contenteditable surface. Markdown in a textarea does not. Conjugation and
 * declension tables are written by hand as Markdown tables, which is the whole
 * reason no table builder is needed either; #30 renders them on view. The
 * textarea is monospaced so a hand-written table's columns line up while you
 * type it.
 *
 * **References are reconciled on save, not written as you click.** On
 * /grammar/new there is no note yet to hang a Reference on, so the picker holds
 * a list and this screen diffs it against the stored note afterwards, through
 * `addReference` / `removeReference`. Those are the only ways a Reference is
 * ever made or unmade.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Screen } from '../../components/Screen.tsx'
import { TagField } from '../../components/TagField.tsx'
import {
  addReference,
  createGrammarNote,
  getGrammarNote,
  referencedVocabularyEntries,
  removeReference,
  saveGrammarNote,
} from '../../data/index.ts'
import type { GrammarNote, Tag, VocabularyEntry } from '../../domain/index.ts'
import { VocabularyPicker } from './VocabularyPicker.tsx'
import { BUTTON, BUTTON_PRIMARY, FOCUS_RING, INPUT, LABEL } from './grammarStyles.ts'

const BODY_PLACEHOLDER = `Ett-words take -et in the definite.

| Form | Example |
| --- | --- |
| Indefinite | ett hus |
| Definite | huset |`

interface Draft {
  readonly title: string
  readonly body: string
  readonly tags: readonly Tag[]
  readonly references: readonly VocabularyEntry[]
}

const EMPTY: Draft = { title: '', body: '', tags: [], references: [] }

/** The Reference list the note should end up with, applied one link at a time. */
async function reconcileReferences(
  note: GrammarNote,
  wanted: readonly VocabularyEntry[],
): Promise<void> {
  const before = note.references.map((reference) => reference.vocabularyEntryId)
  const after = wanted.map((entry) => entry.id)
  for (const id of after.filter((id) => !before.includes(id))) {
    await addReference(note.id, id)
  }
  for (const id of before.filter((id) => !after.includes(id))) {
    await removeReference(note.id, id)
  }
}

export function GrammarNoteEditor() {
  const { grammarNoteId } = useParams()
  const navigate = useNavigate()

  const [note, setNote] = useState<GrammarNote | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>(
    grammarNoteId === undefined ? 'ready' : 'loading',
  )
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (grammarNoteId === undefined) {
        if (!cancelled) {
          setNote(null)
          setDraft(EMPTY)
          setStatus('ready')
        }
        return
      }
      const found = await getGrammarNote(grammarNoteId)
      if (cancelled) return
      if (found === undefined) {
        setStatus('missing')
        return
      }
      const references = await referencedVocabularyEntries(found.id)
      if (cancelled) return
      setNote(found)
      setDraft({
        title: found.title,
        body: found.body,
        tags: found.tags,
        references,
      })
      setStatus('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [grammarNoteId])

  const save = async () => {
    const title = draft.title.trim()
    if (title === '') {
      setProblem('A Grammar Note needs a title — it is how you find it again.')
      return
    }

    setProblem(null)
    setSaving(true)
    try {
      const saved =
        note === null
          ? await createGrammarNote({ title, body: draft.body, tags: [...draft.tags] })
          : await saveGrammarNote({ ...note, title, body: draft.body, tags: [...draft.tags] })
      await reconcileReferences(saved, draft.references)
      void navigate(`/grammar/${saved.id}`, { replace: true })
    } catch (error) {
      console.error('Saving the Grammar Note failed:', error)
      setProblem('Saving failed. Nothing was lost — try again.')
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <Screen title="Grammar Note">
        <p className="text-sm text-text-muted">Loading…</p>
      </Screen>
    )
  }

  if (status === 'missing') {
    return (
      <Screen title="Not found" description="That Grammar Note no longer exists.">
        <Link to="/grammar" className={BUTTON_PRIMARY}>
          Back to Grammar
        </Link>
      </Screen>
    )
  }

  return (
    <Screen title={note === null ? 'New Grammar Note' : 'Edit Grammar Note'}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="grammar-note-title">
            Title
          </label>
          <input
            id="grammar-note-title"
            type="text"
            className={INPUT}
            value={draft.title}
            placeholder="Ett-words in the definite"
            onChange={(event) => {
              setDraft((current) => ({ ...current, title: event.target.value }))
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col gap-0.5">
            <label className={LABEL} htmlFor="grammar-note-body">
              Body
            </label>
            <p className="text-xs text-text-muted">
              Markdown, rendered when you view the note. Write conjugation and declension
              tables as Markdown tables — that is what the pipes are for.
            </p>
          </div>
          <textarea
            id="grammar-note-body"
            // Plain and monospaced on purpose: no rich text editor, no table
            // builder, and columns that line up while you type them.
            className={`${INPUT} resize-y font-mono leading-relaxed`}
            rows={16}
            spellCheck={false}
            value={draft.body}
            placeholder={BODY_PLACEHOLDER}
            onChange={(event) => {
              setDraft((current) => ({ ...current, body: event.target.value }))
            }}
          />
        </div>

        <TagField
          tags={draft.tags}
          placeholder="verb tenses, prepositions…"
          hint="A filter you share with Vocabulary and the Journal."
          onChange={(tags) => {
            setDraft((current) => ({ ...current, tags }))
          }}
        />

        <VocabularyPicker
          picked={draft.references}
          onChange={(references) => {
            setDraft((current) => ({ ...current, references }))
          }}
        />

        {problem === null ? null : (
          <p className="rounded-lg border border-danger bg-danger-soft px-3.5 py-3 text-sm text-text">
            {problem}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={BUTTON_PRIMARY} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link
            to={note === null ? '/grammar' : `/grammar/${note.id}`}
            className={`${BUTTON} ${FOCUS_RING}`}
          >
            Cancel
          </Link>
        </div>
      </form>
    </Screen>
  )
}
