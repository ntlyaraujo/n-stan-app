/**
 * What the capture form edits (#20), and how it turns into a Vocabulary Entry.
 *
 * A Vocabulary Entry is a union on Part of Speech, but a form being typed into
 * is not: changing the Part of Speech mid-capture must not silently throw away
 * what has already been typed. So the draft holds **every** Form of every
 * Paradigm in one flat record, and the conversion below takes the slice the
 * chosen Part of Speech actually has. Switch from noun to verb and back and the
 * noun Forms are still there.
 *
 * Empty and whitespace-only mean "not filled in", exactly as the domain says, so
 * they are written out as `undefined` rather than as an empty string.
 */

import type {
  AdjectiveForms,
  ConjugationGroup,
  Gender,
  LookupOutcome,
  NounForms,
  PartOfSpeech,
  Tag,
  VerbForms,
  VocabularyEntry,
} from '../../domain/index.ts'
import { ADJECTIVE_PARADIGM, NOUN_PARADIGM, VERB_PARADIGM } from '../../domain/index.ts'
import type { VocabularyEntryDraft } from '../../data/index.ts'
import type { DictionarySense } from '../../dictionary/index.ts'

/** Every Form name in the app, across all three Paradigms. */
export type FormName =
  | (typeof NOUN_PARADIGM)[number]
  | (typeof VERB_PARADIGM)[number]
  | (typeof ADJECTIVE_PARADIGM)[number]

/**
 * The Forms a Part of Speech has, typed — the domain's `PARADIGM` is deliberately
 * widened to `string[]`, and the capture form needs the names back.
 */
export const PARADIGM_FIELDS: Readonly<Record<PartOfSpeech, readonly FormName[]>> = {
  noun: NOUN_PARADIGM,
  verb: VERB_PARADIGM,
  adjective: ADJECTIVE_PARADIGM,
  adverb: [],
  phrase: [],
  other: [],
}

/** Label and worked example for each Form, from spec 3.1. */
export const FORM_LABELS: Readonly<Record<FormName, string>> = {
  indefiniteSingular: 'Indefinite singular',
  definiteSingular: 'Definite singular',
  indefinitePlural: 'Indefinite plural',
  definitePlural: 'Definite plural',
  infinitive: 'Infinitive',
  present: 'Present',
  preterite: 'Preterite',
  supine: 'Supine',
  positiveEnForm: 'Positive en-form',
  positiveEttForm: 'Positive ett-form',
  positivePlural: 'Positive plural',
}

export const FORM_EXAMPLES: Readonly<Record<FormName, string>> = {
  indefiniteSingular: 'bok',
  definiteSingular: 'boken',
  indefinitePlural: 'böcker',
  definitePlural: 'böckerna',
  infinitive: 'tala',
  present: 'talar',
  preterite: 'talade',
  supine: 'talat',
  positiveEnForm: 'stor',
  positiveEttForm: 'stort',
  positivePlural: 'stora',
}

export const PART_OF_SPEECH_LABELS: Readonly<Record<PartOfSpeech, string>> = {
  noun: 'Noun',
  verb: 'Verb',
  adjective: 'Adjective',
  adverb: 'Adverb',
  phrase: 'Phrase',
  other: 'Other',
}

const EMPTY_FORMS: Readonly<Record<FormName, string>> = {
  indefiniteSingular: '',
  definiteSingular: '',
  indefinitePlural: '',
  definitePlural: '',
  infinitive: '',
  present: '',
  preterite: '',
  supine: '',
  positiveEnForm: '',
  positiveEttForm: '',
  positivePlural: '',
}

export interface VocabularyDraft {
  readonly lemma: string
  readonly partOfSpeech: PartOfSpeech
  readonly translation: string
  readonly exampleSentence: string
  readonly tags: readonly Tag[]
  /** `''` is "not chosen". Gender is not a Form and does not affect Complete. */
  readonly gender: Gender | ''
  /** `''` is "not chosen". Best-effort from the Dictionary, always correctable. */
  readonly conjugationGroup: ConjugationGroup | ''
  readonly forms: Readonly<Record<FormName, string>>
  readonly lookupOutcome: LookupOutcome
}

export function emptyDraft(): VocabularyDraft {
  return {
    lemma: '',
    partOfSpeech: 'noun',
    translation: '',
    exampleSentence: '',
    tags: [],
    gender: '',
    conjugationGroup: '',
    forms: EMPTY_FORMS,
    lookupOutcome: 'never-attempted',
  }
}

/**
 * The Forms an entry carries, or null for a Part of Speech with no Paradigm.
 * The union is narrowed here, once, so no screen has to do it in a callback.
 */
export function formsOf(entry: VocabularyEntry): Record<string, string | undefined> | null {
  switch (entry.partOfSpeech) {
    case 'noun':
    case 'verb':
    case 'adjective':
      return entry.forms
    case 'adverb':
    case 'phrase':
    case 'other':
      return null
  }
}

/** The same, as the flat record the draft holds: every Form name, always. */
function draftFormsOf(entry: VocabularyEntry): Readonly<Record<FormName, string>> {
  switch (entry.partOfSpeech) {
    case 'noun':
    case 'verb':
    case 'adjective':
      return { ...EMPTY_FORMS, ...readForms(entry.forms) }
    case 'adverb':
    case 'phrase':
    case 'other':
      return EMPTY_FORMS
  }
}

function readForms(
  forms: NounForms | VerbForms | AdjectiveForms,
): Partial<Record<FormName, string>> {
  return Object.fromEntries(
    Object.entries(forms).flatMap(([name, value]) =>
      typeof value === 'string' ? [[name, value]] : [],
    ),
  ) as Partial<Record<FormName, string>>
}

export function draftFromEntry(entry: VocabularyEntry): VocabularyDraft {
  return {
    lemma: entry.lemma,
    partOfSpeech: entry.partOfSpeech,
    translation: entry.translation,
    exampleSentence: entry.exampleSentence,
    tags: entry.tags,
    gender: entry.partOfSpeech === 'noun' ? (entry.gender ?? '') : '',
    conjugationGroup: entry.partOfSpeech === 'verb' ? (entry.conjugationGroup ?? '') : '',
    forms: draftFormsOf(entry),
    lookupOutcome: entry.lookupOutcome,
  }
}

/** Trimmed, with blank Forms dropped: absent and empty both mean "not filled in". */
function slice<K extends FormName>(
  draft: VocabularyDraft,
  names: readonly K[],
): { [Name in K]?: string } {
  const forms: Partial<Record<K, string>> = {}
  for (const name of names) {
    const value = draft.forms[name].trim()
    if (value !== '') forms[name] = value
  }
  return forms
}

/**
 * The draft as the data layer wants it. Every Form is optional here too — a
 * half-filled Paradigm is a legitimate Vocabulary Entry that the completeness
 * filter will offer back for review.
 */
export function vocabularyEntryDraftOf(draft: VocabularyDraft): VocabularyEntryDraft {
  const common = {
    lemma: draft.lemma.trim(),
    translation: draft.translation.trim(),
    exampleSentence: draft.exampleSentence.trim(),
    tags: draft.tags,
    lookupOutcome: draft.lookupOutcome,
  }

  switch (draft.partOfSpeech) {
    case 'noun':
      return {
        ...common,
        partOfSpeech: 'noun',
        gender: draft.gender === '' ? undefined : draft.gender,
        forms: slice(draft, NOUN_PARADIGM),
      }
    case 'verb':
      return {
        ...common,
        partOfSpeech: 'verb',
        conjugationGroup:
          draft.conjugationGroup === '' ? undefined : draft.conjugationGroup,
        forms: slice(draft, VERB_PARADIGM),
      }
    case 'adjective':
      return { ...common, partOfSpeech: 'adjective', forms: slice(draft, ADJECTIVE_PARADIGM) }
    case 'adverb':
    case 'phrase':
    case 'other':
      return { ...common, partOfSpeech: draft.partOfSpeech }
  }
}

/** An existing entry rewritten from the draft, keeping its identity and history. */
export function entryFromDraft(
  entry: VocabularyEntry,
  draft: VocabularyDraft,
): VocabularyEntry {
  return {
    ...vocabularyEntryDraftOf(draft),
    id: entry.id,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  } as VocabularyEntry
}

/** Whether anything the Dictionary would fill in has been typed already. */
export function paradigmIsUntouched(draft: VocabularyDraft): boolean {
  return (
    draft.gender === '' &&
    draft.conjugationGroup === '' &&
    PARADIGM_FIELDS[draft.partOfSpeech].every((name) => draft.forms[name].trim() === '')
  )
}

/**
 * Auto-fill: write a sense's Forms into the draft.
 *
 * `keepTyped` is the difference between the automatic fill, which must never
 * overwrite what you typed, and the Auto-fill button, which you pressed because
 * you wanted the Dictionary's answer instead. Neither locks anything: what is
 * written here is an ordinary value in an ordinary editable field.
 */
export function draftWithSense(
  draft: VocabularyDraft,
  sense: DictionarySense,
  { keepTyped }: { keepTyped: boolean },
): VocabularyDraft {
  const forms = { ...draft.forms }
  for (const [name, value] of Object.entries(readForms(sense.forms)) as [
    FormName,
    string,
  ][]) {
    if (keepTyped && forms[name].trim() !== '') continue
    forms[name] = value
  }

  const gender =
    sense.partOfSpeech === 'noun' && sense.gender !== undefined
      ? keepTyped && draft.gender !== ''
        ? draft.gender
        : sense.gender
      : draft.gender
  const conjugationGroup =
    sense.partOfSpeech === 'verb' && sense.conjugationGroup !== undefined
      ? keepTyped && draft.conjugationGroup !== ''
        ? draft.conjugationGroup
        : sense.conjugationGroup
      : draft.conjugationGroup

  return { ...draft, forms, gender, conjugationGroup }
}

/**
 * How one sense is told from another in the picker. SALDO offers no gloss — the
 * Forms are the only thing that distinguishes *bok* the book from *bok* the
 * beech, so they are the label.
 */
export function senseLabel(sense: DictionarySense): string {
  const forms = Object.values(readForms(sense.forms)).filter((value) => value !== '')
  return forms.length === 0 ? sense.lemgram : forms.join(' · ')
}
