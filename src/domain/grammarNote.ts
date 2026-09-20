/**
 * Grammar Note: a titled Markdown explanation of a rule, which may Reference
 * vocabulary.
 */

import type { Entity, Id } from './entity.ts'
import type { Tag } from './tag.ts'

/**
 * A deliberate link from a Grammar Note to a Vocabulary Entry, created by
 * picking the word on the note.
 */
export interface Reference {
  readonly vocabularyEntryId: Id
}

export interface GrammarNote extends Entity {
  readonly title: string
  /** Free-form Markdown, rendered on view. Tables are written by hand. */
  readonly body: string
  readonly tags: readonly Tag[]
  readonly references: readonly Reference[]
}

/**
 * The same Reference seen from the Vocabulary Entry's side. Backlinks are
 * derived when a word is shown and never stored or created directly, which is
 * why this carries the note's title rather than pointing back at a record.
 */
export interface Backlink {
  readonly grammarNoteId: Id
  readonly title: string
}
