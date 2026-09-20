/**
 * Journal Entry: one piece of your own Swedish writing, carrying a Date and no
 * title, plus the Pins that record what you practiced.
 */

import type { CalendarDate, Entity, Id } from './entity.ts'
import type { Tag } from './tag.ts'

/** What a Pin was made against. */
export type PinnedKind = 'vocabularyEntry' | 'grammarNote'

interface PinCommon {
  readonly pinnedKind: PinnedKind
  /**
   * The Lemma or title the Pin was made with.
   *
   * On a resolved Pin this duplicates what the target already holds. That is
   * deliberate (ADR-0001): it is what the Pin keeps when the target is deleted,
   * and it is not denormalisation waiting to be cleaned up.
   */
  readonly pinnedAs: string
}

/** A Pin that still resolves to a live Vocabulary Entry or Grammar Note. */
export interface ResolvedPin extends PinCommon {
  readonly status: 'resolved'
  readonly targetId: Id
}

/**
 * Tombstone: what a Pin becomes once the thing it pointed at is deleted. Plain
 * text, no longer linked, because a record of what you practiced must not
 * change months after the fact.
 */
export interface TombstonePin extends PinCommon {
  readonly status: 'tombstone'
}

export type Pin = ResolvedPin | TombstonePin

export interface JournalEntry extends Entity {
  /**
   * The day this entry belongs to, chosen by you and defaulting to today.
   * Distinct from {@link Entity.createdAt}, which is never edited.
   */
  readonly date: CalendarDate
  /** A single field, Swedish only. Its first line is the entry's preview. */
  readonly body: string
  /** The one optional Prompt this entry is Attached to. */
  readonly attachedPromptId?: Id
  /** Belongs to this entry alone and never carries over to the next one. */
  readonly pins: readonly Pin[]
  readonly tags: readonly Tag[]
}

export function isResolvedPin(pin: Pin): pin is ResolvedPin {
  return pin.status === 'resolved'
}

export function isTombstonePin(pin: Pin): pin is TombstonePin {
  return pin.status === 'tombstone'
}
