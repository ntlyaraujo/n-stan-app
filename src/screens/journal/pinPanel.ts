/**
 * What the side panel puts on screen (#40, #41): the Pins of the Journal Entry
 * being written, and the live search across Vocabulary and Grammar Notes that
 * feeds them.
 *
 * Kept apart from the panel itself because these are rules rather than markup,
 * and one of them has to hold for years: **a Tombstone Pin still renders.** A
 * Pin whose word has been deleted is not a broken link to hide, it is the
 * record that you practiced that word, so it comes back here as plain text from
 * `pin.pinnedAs` with nowhere to go (ADR-0001). Nothing in the panel may skip
 * it, and nothing may crash on it.
 *
 * A resolved Pin shows the target's *current* Lemma or title, because the word
 * is still there to be renamed. Only once it is deleted does `pinnedAs` freeze
 * what the Pin recorded.
 */

import type { PinnedItem } from '../../data/index.ts'
import type { GrammarNote, Pin, PinnedKind, VocabularyEntry } from '../../domain/index.ts'

/** How many matches of each kind the panel offers before asking for a narrower search. */
export const MAX_MATCHES_PER_KIND = 8

const KIND_LABELS: Record<PinnedKind, string> = {
  vocabularyEntry: 'Vocabulary',
  grammarNote: 'Grammar Note',
}

const UNTITLED: Record<PinnedKind, string> = {
  vocabularyEntry: 'Untitled Vocabulary Entry',
  grammarNote: 'Untitled Grammar Note',
}

function labelOrUntitled(raw: string, kind: PinnedKind): string {
  return raw.trim() === '' ? UNTITLED[kind] : raw
}

function pathTo(kind: PinnedKind, targetId: string): string {
  return kind === 'vocabularyEntry' ? `/vocabulary/${targetId}` : `/grammar/${targetId}`
}

/** One Pin as the panel draws it. `to` is null exactly when nothing is left to open. */
export interface PinRow {
  readonly key: string
  readonly kind: PinnedKind
  readonly kindLabel: string
  /** The Lemma or title: live while the target exists, frozen once it does not. */
  readonly label: string
  /** The translation, where there is one. Never load-bearing. */
  readonly detail: string
  /** Where the label links, or null for a Tombstone — plain, unlinked text. */
  readonly to: string | null
  /** What `unpinFromJournalEntry` needs, or null when there is nothing to unpin. */
  readonly targetId: string | null
  /** True when the Pin outlived the thing it pointed at. */
  readonly tombstone: boolean
}

function targetLabel(target: VocabularyEntry | GrammarNote): string {
  return 'lemma' in target ? target.lemma : target.title
}

function targetDetail(target: VocabularyEntry | GrammarNote): string {
  return 'lemma' in target ? target.translation : ''
}

/**
 * The Pins of one Journal Entry, in the order they were made, Tombstones
 * included and in place.
 *
 * A resolved Pin whose target failed to load is treated exactly like a
 * Tombstone rather than dropped: the panel would otherwise quietly report fewer
 * practiced words than the entry recorded.
 */
export function pinRows(items: readonly PinnedItem[]): PinRow[] {
  return items.map(({ pin, target }, index) => {
    const kind = pin.pinnedKind
    const targetId = pin.status === 'resolved' && target !== null ? pin.targetId : null
    return {
      key: `${String(index)}:${targetId ?? pin.pinnedAs}`,
      kind,
      kindLabel: KIND_LABELS[kind],
      label: labelOrUntitled(target === null ? pin.pinnedAs : targetLabel(target), kind),
      detail: target === null ? '' : targetDetail(target),
      to: targetId === null ? null : pathTo(kind, targetId),
      targetId,
      tombstone: targetId === null,
    }
  })
}

/** The resolved targets a Journal Entry already holds, so a match can say so. */
export function pinnedTargetIds(items: readonly PinnedItem[]): Set<string> {
  const ids = new Set<string>()
  for (const { pin } of items) {
    if (pin.status === 'resolved') ids.add(pin.targetId)
  }
  return ids
}

/** One search match, pinnable in one gesture. */
export interface MatchRow {
  readonly key: string
  readonly targetId: string
  readonly kind: PinnedKind
  readonly kindLabel: string
  readonly label: string
  readonly detail: string
  readonly pinned: boolean
}

export interface Matches {
  /** Vocabulary first, then Grammar Notes — one list, searched together. */
  readonly rows: readonly MatchRow[]
  /** How many matches did not fit, so the panel can ask for a narrower search. */
  readonly hidden: number
}

/**
 * Vocabulary Entries and Grammar Notes as one list of matches (#40).
 *
 * Both sides are searched by the storage layer and only merged here. The search
 * is deliberately over what you typed in the box rather than over what you are
 * writing: matching *skriver* back to *skriva* is a linguistic problem, not a
 * string one, and pinning answers the same need without guessing.
 */
export function matchRows(
  vocabulary: readonly VocabularyEntry[],
  grammarNotes: readonly GrammarNote[],
  alreadyPinned: ReadonlySet<string>,
  limitPerKind: number = MAX_MATCHES_PER_KIND,
): Matches {
  const words = vocabulary.slice(0, limitPerKind).map(
    (entry): MatchRow => ({
      key: entry.id,
      targetId: entry.id,
      kind: 'vocabularyEntry',
      kindLabel: KIND_LABELS.vocabularyEntry,
      label: labelOrUntitled(entry.lemma, 'vocabularyEntry'),
      detail: entry.translation,
      pinned: alreadyPinned.has(entry.id),
    }),
  )
  const notes = grammarNotes.slice(0, limitPerKind).map(
    (note): MatchRow => ({
      key: note.id,
      targetId: note.id,
      kind: 'grammarNote',
      kindLabel: KIND_LABELS.grammarNote,
      label: labelOrUntitled(note.title, 'grammarNote'),
      detail: '',
      pinned: alreadyPinned.has(note.id),
    }),
  )
  return {
    rows: [...words, ...notes],
    hidden:
      vocabulary.length - words.length + (grammarNotes.length - notes.length),
  }
}

/**
 * The Pins as they appear beside the writing on a phone, where the panel
 * itself is closed most of the time.
 *
 * Read straight off the stored Pins — `pinnedAs` is on both shapes, so a chip
 * needs no lookup and a Tombstone costs nothing to show.
 */
export interface PinChip {
  readonly key: string
  readonly kind: PinnedKind
  readonly label: string
  readonly tombstone: boolean
}

export function pinChips(pins: readonly Pin[]): PinChip[] {
  return pins.map((pin, index) => ({
    key: `${String(index)}:${pin.status === 'resolved' ? pin.targetId : pin.pinnedAs}`,
    kind: pin.pinnedKind,
    label: labelOrUntitled(pin.pinnedAs, pin.pinnedKind),
    tombstone: pin.status === 'tombstone',
  }))
}
