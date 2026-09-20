/**
 * Reading for the side panel (#40, #41): the Pins this Journal Entry holds, and
 * the live search behind them.
 *
 * Both follow the house pattern for asynchronous reads — the result is stored
 * together with the request it answers, so *loading* is derived from the two not
 * matching rather than being a second piece of state set from inside an effect.
 *
 * Searching is left to the storage layer, which already matches Lemma,
 * translation and example sentence on one side and title and body on the other.
 * Filtering in here would be a second, quietly different definition of what
 * counts as a match.
 */

import { useCallback, useEffect, useState } from 'react'
import { SEARCH_DEBOUNCE_MS } from '../../components/liveSearch.ts'
import { listGrammarNotes, listVocabularyEntries, pinnedItems } from '../../data/index.ts'
import type { PinnedItem } from '../../data/index.ts'
import type { GrammarNote, VocabularyEntry } from '../../domain/index.ts'

export interface EntryPins {
  readonly items: readonly PinnedItem[]
  readonly loading: boolean
  /** Re-read after a Pin is made or removed. */
  readonly reload: () => void
}

interface LoadedPins {
  readonly request: string
  readonly items: readonly PinnedItem[]
}

const NO_PINS: LoadedPins = { request: '', items: [] }

/**
 * The Pins of one Journal Entry. `undefined` is the entry that does not exist
 * yet — `/journal/new` before the first save — which has no Pins rather than an
 * error.
 */
export function useEntryPins(journalEntryId: string | undefined): EntryPins {
  const [loaded, setLoaded] = useState<LoadedPins>(NO_PINS)
  const [token, setToken] = useState(1)
  const request = `${journalEntryId ?? ''}:${String(token)}`

  useEffect(() => {
    let cancelled = false
    const read =
      journalEntryId === undefined
        ? Promise.resolve<PinnedItem[]>([])
        : pinnedItems(journalEntryId)
    void read.then((items) => {
      if (!cancelled) setLoaded({ request, items })
    })
    return () => {
      cancelled = true
    }
  }, [journalEntryId, request])

  const reload = useCallback(() => {
    setToken((value) => value + 1)
  }, [])

  return { items: loaded.items, loading: loaded.request !== request, reload }
}

export interface PanelSearch {
  readonly term: string
  readonly setTerm: (term: string) => void
  readonly vocabulary: readonly VocabularyEntry[]
  readonly grammarNotes: readonly GrammarNote[]
  readonly loading: boolean
  /** How much there is to search at all, for the empty state. */
  readonly totals: { readonly vocabulary: number; readonly grammarNotes: number }
}

interface Totals {
  readonly vocabulary: number
  readonly grammarNotes: number
}

interface LoadedMatches {
  readonly request: string
  readonly vocabulary: readonly VocabularyEntry[]
  readonly grammarNotes: readonly GrammarNote[]
  /** Carried across searches: how much there is in total, not how much matched. */
  readonly totals: Totals
}

const NO_MATCHES: LoadedMatches = {
  // Never equal to a real request, so the first read counts as loading.
  request: '\u0000',
  vocabulary: [],
  grammarNotes: [],
  totals: { vocabulary: 0, grammarNotes: 0 },
}

/**
 * Live search across Vocabulary **and** Grammar Notes together: one box, one
 * debounce, both stores, filtering as you type.
 */
export function usePanelSearch(): PanelSearch {
  const [term, setTerm] = useState('')
  const [loaded, setLoaded] = useState<LoadedMatches>(NO_MATCHES)
  const trimmed = term.trim()
  const request = trimmed

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      const query = trimmed === '' ? {} : { search: trimmed }
      void Promise.all([listVocabularyEntries(query), listGrammarNotes(query)]).then(
        ([vocabulary, grammarNotes]) => {
          if (cancelled) return
          setLoaded((previous) => ({
            request,
            vocabulary,
            grammarNotes,
            // An empty box already asked for everything there is, so the totals
            // come free; a narrowed search keeps the last ones it knew.
            totals:
              request === ''
                ? { vocabulary: vocabulary.length, grammarNotes: grammarNotes.length }
                : previous.totals,
          }))
        },
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, request])

  return {
    term,
    setTerm,
    vocabulary: loaded.vocabulary,
    grammarNotes: loaded.grammarNotes,
    loading: loaded.request !== request,
    totals: loaded.totals,
  }
}
