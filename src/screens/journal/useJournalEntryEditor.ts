/**
 * Loading, autosaving and deleting the one Journal Entry the editor is on (#37).
 *
 * **Losing typing is the one unacceptable outcome**, so this errs heavily
 * towards saving: a short debounce while you type, plus a flush when the editor
 * unmounts, when the tab is hidden and when the page is being unloaded. Every
 * write goes through one promise queue, so two saves can never race and land out
 * of order.
 *
 * A new entry is not created until there is something worth keeping — a body, a
 * Tag or an Attached Prompt. Opening `/journal/new` and walking away leaves no
 * empty entry behind. On that first save the URL is replaced with the entry's
 * own, so a reload lands back on the writing rather than on a blank page.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  saveJournalEntry,
  today,
} from '../../data/index.ts'
import type { CalendarDate, Id, JournalEntry, Tag } from '../../domain/index.ts'

/**
 * The parts of a Journal Entry the editor owns. Pins are not among them: they
 * are written by `links.ts`, which captures the Lemma a Pin was made with, and
 * reach the editor only through {@link JournalEntryEditor.writeToEntry}.
 */
export interface JournalEntryFields {
  readonly date: CalendarDate
  readonly body: string
  readonly tags: readonly Tag[]
  readonly attachedPromptId?: Id
}

export type SaveState = 'clean' | 'pending' | 'saving' | 'saved' | 'failed'

export interface JournalEntryEditor {
  readonly status: 'loading' | 'ready' | 'missing'
  readonly fields: JournalEntryFields
  readonly saveState: SaveState
  /** The stored entry, once there is one. Undefined until the first save. */
  readonly entry: JournalEntry | undefined
  readonly update: (changes: Partial<JournalEntryFields>) => void
  readonly saveNow: () => Promise<void>
  readonly remove: () => Promise<void>
  /**
   * Make a write against this entry that the editor does not own — Pinning and
   * unpinning (#41) — and take back the entry it returns.
   *
   * It goes through the editor rather than around it for two reasons. It runs on
   * the same queue as the autosave, so a Pin and a keystroke landing together
   * cannot overwrite each other; and the entry it returns replaces the one the
   * editor is holding, so the next autosave writes the Pins it now has instead
   * of the ones it loaded with.
   *
   * There is no entry to Pin to on `/journal/new`, so this creates one first. A
   * Pin is a record of what you practiced and is worth an entry on its own —
   * which is why it, unlike an untouched Date, is enough to bring one into being.
   * Resolves to undefined only if the entry could not be created.
   */
  readonly writeToEntry: (
    write: (journalEntryId: Id) => Promise<JournalEntry>,
  ) => Promise<JournalEntry | undefined>
}

const AUTOSAVE_DELAY_MS = 600

type MutableJournalEntry = { -readonly [K in keyof JournalEntry]: JournalEntry[K] }

function blankFields(): JournalEntryFields {
  return { date: today(), body: '', tags: [] }
}

function fieldsOf(entry: JournalEntry): JournalEntryFields {
  return {
    date: entry.date,
    body: entry.body,
    tags: entry.tags,
    attachedPromptId: entry.attachedPromptId,
  }
}

function sameFields(a: JournalEntryFields, b: JournalEntryFields): boolean {
  return (
    a.date === b.date &&
    a.body === b.body &&
    a.attachedPromptId === b.attachedPromptId &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  )
}

/** Nothing worth storing yet. A Date on its own never creates an entry. */
function isBlank(fields: JournalEntryFields): boolean {
  return (
    fields.body.trim() === '' && fields.tags.length === 0 && fields.attachedPromptId === undefined
  )
}

/** The entry a URL names: the stored one, a blank draft, or gone. */
async function findJournalEntry(
  journalEntryId: string | undefined,
): Promise<JournalEntry | undefined | 'missing'> {
  if (journalEntryId === undefined) return undefined
  return (await getJournalEntry(journalEntryId)) ?? 'missing'
}

export function useJournalEntryEditor(): JournalEntryEditor {
  const { journalEntryId } = useParams()
  const navigate = useNavigate()

  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>(
    journalEntryId === undefined ? 'ready' : 'loading',
  )
  const [fields, setFields] = useState<JournalEntryFields>(blankFields)
  const [saveState, setSaveState] = useState<SaveState>('clean')
  const [entry, setEntry] = useState<JournalEntry | undefined>(undefined)

  const entryRef = useRef<JournalEntry | undefined>(undefined)
  const fieldsRef = useRef<JournalEntryFields>(fields)
  const savedFieldsRef = useRef<JournalEntryFields>(fields)
  const removedRef = useRef(false)
  const queueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    fieldsRef.current = fields
  }, [fields])

  /** Take a stored entry — or a blank one, for /journal/new — as the draft. */
  const adopt = useCallback((loaded: JournalEntry | undefined) => {
    const next = loaded === undefined ? blankFields() : fieldsOf(loaded)
    entryRef.current = loaded
    fieldsRef.current = next
    savedFieldsRef.current = next
    removedRef.current = false
    setEntry(loaded)
    setFields(next)
    setSaveState('clean')
    setStatus('ready')
  }, [])

  // Load the entry the URL names. Skipped when the URL already names the entry
  // we are holding — which is the case right after the first save replaces
  // /journal/new with the entry's own path, and must not clobber live typing.
  useEffect(() => {
    if (journalEntryId === entryRef.current?.id) return
    let cancelled = false
    void findJournalEntry(journalEntryId).then((found) => {
      if (cancelled) return
      if (found === 'missing') setStatus('missing')
      else adopt(found)
    })
    return () => {
      cancelled = true
    }
  }, [journalEntryId, adopt])

  const persist = useCallback(async (options?: { createEvenIfBlank?: boolean }) => {
    if (removedRef.current) return
    const snapshot = fieldsRef.current
    const current = entryRef.current
    // A Pin needs an entry to belong to, so it may ask for one before there is
    // anything written. Nothing else creates an entry out of a blank draft.
    const mustCreate = options?.createEvenIfBlank === true && current === undefined

    if (!mustCreate && sameFields(snapshot, savedFieldsRef.current)) return

    if (!mustCreate && current === undefined && isBlank(snapshot)) {
      // Nothing to keep yet; remember it so an empty Date change stays quiet.
      savedFieldsRef.current = snapshot
      setSaveState('clean')
      return
    }

    setSaveState('saving')
    try {
      if (current === undefined) {
        const created = await createJournalEntry({
          date: snapshot.date,
          body: snapshot.body,
          tags: [...snapshot.tags],
          ...(snapshot.attachedPromptId === undefined
            ? {}
            : { attachedPromptId: snapshot.attachedPromptId }),
        })
        entryRef.current = created
        savedFieldsRef.current = snapshot
        setEntry(created)
        setSaveState('saved')
        navigate(`/journal/${created.id}`, { replace: true })
        return
      }

      const next: MutableJournalEntry = {
        ...current,
        date: snapshot.date,
        body: snapshot.body,
        tags: [...snapshot.tags],
      }
      if (snapshot.attachedPromptId === undefined) delete next.attachedPromptId
      else next.attachedPromptId = snapshot.attachedPromptId

      const saved = await saveJournalEntry(next)
      entryRef.current = saved
      savedFieldsRef.current = snapshot
      setEntry(saved)
      setSaveState('saved')
    } catch (error) {
      console.error('Saving the Journal Entry failed:', error)
      setSaveState('failed')
    }
  }, [navigate])

  const persistRef = useRef(persist)
  useEffect(() => {
    persistRef.current = persist
  }, [persist])

  // One queue, so a flush that overlaps a debounced save cannot reorder writes.
  const flush = useCallback(() => {
    const run = () => persistRef.current()
    queueRef.current = queueRef.current.then(run, run)
    return queueRef.current
  }, [])

  // Pins are written by `links.ts`, not from here, but they land on the same
  // record — so they go through the same queue, and what comes back replaces the
  // entry this hook holds. Skip either half and the next autosave would write
  // back the Pins the editor loaded with, quietly undoing the one just made.
  const writeToEntry = useCallback(
    (write: (journalEntryId: Id) => Promise<JournalEntry>): Promise<JournalEntry | undefined> => {
      const run = async (): Promise<JournalEntry | undefined> => {
        if (removedRef.current) return undefined
        await persistRef.current({ createEvenIfBlank: true })
        const target = entryRef.current
        if (target === undefined) return undefined
        try {
          const saved = await write(target.id)
          entryRef.current = saved
          setEntry(saved)
          return saved
        } catch (error) {
          console.error('Writing to the Journal Entry failed:', error)
          return undefined
        }
      }
      const result = queueRef.current.then(run, run)
      queueRef.current = result.then(() => undefined)
      return result
    },
    [],
  )

  // Autosave while you type: the timer restarts on each keystroke and fires once
  // the typing pauses.
  useEffect(() => {
    if (status !== 'ready') return
    if (sameFields(fields, savedFieldsRef.current)) return
    setSaveState('pending')
    const timer = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [fields, status, flush])

  // Leaving the editor, hiding the tab or closing the page all save first.
  useEffect(() => {
    const onHide = () => void flush()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void flush()
    }
  }, [flush])

  const update = useCallback((changes: Partial<JournalEntryFields>) => {
    setFields((current) => ({ ...current, ...changes }))
  }, [])

  const remove = useCallback(async () => {
    const current = entryRef.current
    removedRef.current = true
    if (current !== undefined) await deleteJournalEntry(current.id)
    navigate('/journal', { replace: true })
  }, [navigate])

  return { status, fields, saveState, entry, update, saveNow: flush, remove, writeToEntry }
}
