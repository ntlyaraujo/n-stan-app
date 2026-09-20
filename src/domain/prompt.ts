/**
 * Prompt: a Swedish-language writing suggestion. Prompts are suggestions, never
 * assignments — a Journal Entry may have none.
 */

import type { Entity, Id } from './entity.ts'

export const PROMPT_LEVELS = ['beginner', 'intermediate', 'advanced'] as const

export type PromptLevel = (typeof PROMPT_LEVELS)[number]

interface PromptCommon extends Entity {
  /** In Swedish. Beginner text is deliberately simple. */
  readonly text: string
  readonly level: PromptLevel
}

/**
 * A Prompt that ships with the app. Read-only: it can be hidden from the
 * picker, but editing one produces a {@link CustomPrompt} instead, so a revised
 * Prompt set can ship later without discarding your wording.
 */
export interface BuiltInPrompt extends PromptCommon {
  readonly origin: 'built-in'
  /** Hidden from the picker. The Prompt itself is never edited or deleted. */
  readonly hidden: boolean
}

/** A Prompt you authored, including one that began as an edit of a Built-in Prompt. */
export interface CustomPrompt extends PromptCommon {
  readonly origin: 'custom'
  /** Set when this Prompt began as an edit of a Built-in Prompt. */
  readonly derivedFrom?: Id
}

export type Prompt = BuiltInPrompt | CustomPrompt

export function isBuiltInPrompt(prompt: Prompt): prompt is BuiltInPrompt {
  return prompt.origin === 'built-in'
}
