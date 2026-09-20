/**
 * The small read-only pieces the Vocabulary list and detail share (#20, #21).
 *
 * **Why Gender gets a badge of its own.** Gender is not a Form: it sits outside
 * the Paradigm and outside Complete, and a noun with no Gender is still
 * Complete once its four Forms are there — the glossary is explicit and a test
 * pins it. But spec section 4 opens by saying Gender is precisely the thing that
 * cannot be guessed and should not be typed by hand, so a noun missing it is
 * still something you want to see at a glance. Hence: shown everywhere, marked
 * when missing, and deliberately absent from the completeness filter.
 */

import type { ReactNode } from 'react'
import type { Gender, PartOfSpeech, VocabularyEntry } from '../../domain/index.ts'
import { filledFormCount, isComplete } from '../../domain/index.ts'
import { PARADIGM_FIELDS, PART_OF_SPEECH_LABELS } from './vocabularyDraft.ts'

type Tone = 'neutral' | 'accent' | 'warning' | 'success' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-text-muted',
  accent: 'bg-accent-soft text-accent',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/**
 * *en* or *ett*, in the words themselves — never "utrum" or "common". A noun
 * without one says so rather than showing nothing, because nothing is exactly
 * what you would fail to notice.
 */
export function GenderBadge({ gender }: { gender: Gender | undefined }) {
  if (gender === undefined) {
    return <Badge tone="warning">Gender missing</Badge>
  }
  return <Badge tone="accent">{gender}</Badge>
}

export function PartOfSpeechBadge({ partOfSpeech }: { partOfSpeech: PartOfSpeech }) {
  return <Badge>{PART_OF_SPEECH_LABELS[partOfSpeech]}</Badge>
}

/**
 * How much of the Paradigm is there. A Part of Speech with no Paradigm — a
 * phrase above all — is Complete with nothing filled in, and says nothing at
 * all rather than boasting about an empty set.
 */
export function ParadigmBadge({ entry }: { entry: VocabularyEntry }) {
  const total = PARADIGM_FIELDS[entry.partOfSpeech].length
  if (total === 0) return null
  if (isComplete(entry)) return <Badge tone="success">Complete</Badge>
  return (
    <Badge tone="warning">
      {filledFormCount(entry)} of {total} Forms
    </Badge>
  )
}

/** A tinted panel for something the screen wants to say without blocking you. */
export function Notice({
  tone = 'neutral',
  title,
  children,
  actions,
}: {
  tone?: Tone
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  const border: Record<Tone, string> = {
    neutral: 'border-border bg-surface-sunken',
    accent: 'border-accent bg-accent-soft',
    warning: 'border-warning bg-warning-soft',
    success: 'border-success bg-success-soft',
    danger: 'border-danger bg-danger-soft',
  }
  return (
    <div className={`rounded-lg border px-3.5 py-3 ${border[tone]}`}>
      <p className="text-sm font-medium text-text">{title}</p>
      {children ? (
        <div className="mt-1 text-sm leading-relaxed text-text-muted">{children}</div>
      ) : null}
      {actions ? <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function TagList({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag}>
          <Badge>{tag}</Badge>
        </li>
      ))}
    </ul>
  )
}
