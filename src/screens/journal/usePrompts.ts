/**
 * Reading Prompts for the picker and the Prompt manager (#36, #38).
 *
 * `listPrompts` already leaves hidden Built-in Prompts out of the picker and
 * orders by level, so this only holds the result and hands back a reload for
 * after a Prompt is added, hidden or deleted.
 *
 * The result is stored together with the request it answers, so *loading* is
 * derived — the result on hand is simply not the one asked for yet — rather
 * than a second piece of state set from inside the effect.
 */

import { useCallback, useEffect, useState } from 'react'
import { listPrompts } from '../../data/index.ts'
import type { Prompt } from '../../domain/index.ts'

export interface PromptList {
  readonly prompts: readonly Prompt[]
  readonly loading: boolean
  readonly reload: () => void
}

interface Loaded {
  readonly request: string
  readonly prompts: readonly Prompt[]
}

const NOTHING_LOADED: Loaded = { request: '', prompts: [] }

/**
 * @param includeHidden the Prompt manager asks for hidden Built-in Prompts so
 * they can be brought back. The picker never does.
 */
export function usePrompts(includeHidden = false): PromptList {
  const [loaded, setLoaded] = useState<Loaded>(NOTHING_LOADED)
  const [token, setToken] = useState(1)
  const request = `${includeHidden}:${token}`

  useEffect(() => {
    let cancelled = false
    void listPrompts({ includeHidden }).then((prompts) => {
      if (!cancelled) setLoaded({ request, prompts })
    })
    return () => {
      cancelled = true
    }
  }, [includeHidden, request])

  const reload = useCallback(() => setToken((value) => value + 1), [])

  return { prompts: loaded.prompts, loading: loaded.request !== request, reload }
}
