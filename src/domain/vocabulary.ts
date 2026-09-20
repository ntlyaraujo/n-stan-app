/**
 * Vocabulary Entry: one captured word or expression, typed by Part of Speech.
 *
 * The Part of Speech determines which Forms exist — together, its Paradigm.
 * Every Form is optional, so capture stays fast and a Paradigm can be completed
 * later. Complete is derived from the Paradigm and never stored; see
 * {@link isComplete}.
 */

import type { Entity } from './entity.ts'
import type { Tag } from './tag.ts'

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrase',
  'other',
] as const

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]

/** Whether a noun takes *en* or *ett*. The two values are the words themselves. */
export const GENDERS = ['en', 'ett'] as const

export type Gender = (typeof GENDERS)[number]

/**
 * Which Swedish verb group a verb inflects by. Derived best-effort from the
 * Dictionary and always correctable by hand, so a Conjugation Group is never
 * required for a verb to be Complete.
 */
export const CONJUGATION_GROUPS = ['1', '2a', '2b', '3', '4'] as const

export type ConjugationGroup = (typeof CONJUGATION_GROUPS)[number]

/**
 * The outcome of the last Lookup against the Dictionary. This, and never
 * completeness, decides whether the Dictionary is tried again.
 */
export const LOOKUP_OUTCOMES = [
  'never-attempted',
  'filled',
  'not-found',
  'deferred',
] as const

export type LookupOutcome = (typeof LOOKUP_OUTCOMES)[number]

/** One Form. Absent, empty and whitespace-only all mean "not filled in". */
export type Form = string | undefined

export const NOUN_PARADIGM = [
  'indefiniteSingular',
  'definiteSingular',
  'indefinitePlural',
  'definitePlural',
] as const

export const VERB_PARADIGM = [
  'infinitive',
  'present',
  'preterite',
  'supine',
] as const

export const ADJECTIVE_PARADIGM = [
  'positiveEnForm',
  'positiveEttForm',
  'positivePlural',
] as const

/** *bok / boken / böcker / böckerna* */
export type NounForms = { readonly [K in (typeof NOUN_PARADIGM)[number]]?: Form }

/** *tala / talar / talade / talat* */
export type VerbForms = { readonly [K in (typeof VERB_PARADIGM)[number]]?: Form }

/** *stor / stort / stora* */
export type AdjectiveForms = {
  readonly [K in (typeof ADJECTIVE_PARADIGM)[number]]?: Form
}

interface VocabularyEntryCommon extends Entity {
  /** The word or expression as you would look it up. Does not identify the entry. */
  readonly lemma: string
  readonly translation: string
  /** One sentence, written by you, personally meaningful. */
  readonly exampleSentence: string
  readonly tags: readonly Tag[]
  readonly lookupOutcome: LookupOutcome
}

export interface NounVocabularyEntry extends VocabularyEntryCommon {
  readonly partOfSpeech: 'noun'
  readonly gender?: Gender
  readonly forms: NounForms
}

export interface VerbVocabularyEntry extends VocabularyEntryCommon {
  readonly partOfSpeech: 'verb'
  readonly conjugationGroup?: ConjugationGroup
  readonly forms: VerbForms
}

export interface AdjectiveVocabularyEntry extends VocabularyEntryCommon {
  readonly partOfSpeech: 'adjective'
  readonly forms: AdjectiveForms
}

/** An adverb, phrase or other has an empty Paradigm and so carries no Forms. */
export interface UninflectedVocabularyEntry extends VocabularyEntryCommon {
  readonly partOfSpeech: 'adverb' | 'phrase' | 'other'
}

export type VocabularyEntry =
  | NounVocabularyEntry
  | VerbVocabularyEntry
  | AdjectiveVocabularyEntry
  | UninflectedVocabularyEntry

/**
 * The Forms a Part of Speech requires: four for a noun, four for a verb, three
 * for an adjective, none for an adverb, phrase or other.
 *
 * Gender and Conjugation Group are not Forms — they are their own concepts and
 * so sit outside the Paradigm and outside completeness.
 */
export const PARADIGM: Readonly<Record<PartOfSpeech, readonly string[]>> = {
  noun: NOUN_PARADIGM,
  verb: VERB_PARADIGM,
  adjective: ADJECTIVE_PARADIGM,
  adverb: [],
  phrase: [],
  other: [],
}

function isFilled(form: Form): boolean {
  return form !== undefined && form.trim() !== ''
}

/** Every Form of an entry's Paradigm, in Paradigm order, filled or not. */
export function paradigmForms(entry: VocabularyEntry): readonly Form[] {
  switch (entry.partOfSpeech) {
    case 'noun':
      return NOUN_PARADIGM.map((form) => entry.forms[form])
    case 'verb':
      return VERB_PARADIGM.map((form) => entry.forms[form])
    case 'adjective':
      return ADJECTIVE_PARADIGM.map((form) => entry.forms[form])
    case 'adverb':
    case 'phrase':
    case 'other':
      return []
  }
}

/**
 * Complete: every Form of the Paradigm has a value. Derived, never stored.
 *
 * A Part of Speech with an empty Paradigm — adverb, phrase and other — is
 * therefore always Complete, which falls out of the empty array below rather
 * than being special-cased.
 */
export function isComplete(entry: VocabularyEntry): boolean {
  return paradigmForms(entry).every(isFilled)
}

/** How many Forms of the Paradigm are filled in. For "2 of 4" style hints. */
export function filledFormCount(entry: VocabularyEntry): number {
  return paradigmForms(entry).filter(isFilled).length
}

/**
 * Whether the Dictionary is worth trying again for this entry. Completeness
 * never decides this; the Lookup outcome does.
 */
export function shouldAttemptLookup(entry: VocabularyEntry): boolean {
  return (
    entry.lookupOutcome === 'never-attempted' || entry.lookupOutcome === 'deferred'
  )
}
