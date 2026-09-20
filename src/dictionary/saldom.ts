/**
 * Mapping one SALDO entry onto the domain's Forms and Gender (#17).
 *
 * All msd values below were read off real responses on 2026-09-20, not from
 * documentation. Genitive rows (`… gen`), compounding stems (`ci`, `cm`, `c`,
 * `sms`), passive *s*-forms, imperatives, participles, comparatives and
 * superlatives are all deliberately ignored: the Paradigm is four Forms for a
 * noun, four for a verb and three for an adjective, and nothing else.
 */

import type {
  AdjectiveForms,
  Gender,
  NounForms,
  VerbForms,
} from '../domain/index.ts'
import type { SaldomEntry } from './karp.ts'

export const NOUN_MSD = {
  indefiniteSingular: 'sg indef nom',
  definiteSingular: 'sg def nom',
  indefinitePlural: 'pl indef nom',
  definitePlural: 'pl def nom',
} as const

export const VERB_MSD = {
  infinitive: 'inf aktiv',
  present: 'pres ind aktiv',
  preterite: 'pret ind aktiv',
  supine: 'sup aktiv',
} as const

export const ADJECTIVE_MSD = {
  positiveEnForm: 'pos indef sg u nom',
  positiveEttForm: 'pos indef sg n nom',
  positivePlural: 'pos indef pl nom',
} as const

/** The whole inflection table of an invariable adjective, e.g. *abborrliknande*. */
const INVARIABLE_MSD = 'invar'

/**
 * The first row carrying this msd, or `undefined`.
 *
 * `inflectionTable` is a flat list and **repeats msd values**, so it is not a
 * map: `tala..vb.1` has two `pret ind aktiv` rows (`talade`, `talte`) and two
 * `sup aktiv` rows (`talat`, `talt`), and `bok..nn.1` has four `cm` rows. The
 * obvious `Object.fromEntries(table.map(…))` keeps the *last* of each, which
 * for the spec's own worked example yields `talte` / `talt` — the rarer
 * variant, and not what the spec prints.
 *
 * First-match-wins is the rule, chosen because SALDO lists the primary form
 * first in every entry checked. It is a deliberate pick, not a safe one:
 * `anbringa..vb.1` lists the archaic `anbragte` before `anbringade`. A Form is
 * a prefill the learner can always overwrite, which is what makes the trade
 * acceptable; a Conjugation Group is not, which is why `conjugationGroup.ts`
 * refuses to derive one for these entries at all.
 */
export function firstWrittenForm(
  entry: SaldomEntry,
  msd: string,
): string | undefined {
  const written = entry.inflectionTable.find((row) => row.msd === msd)?.writtenForm
  return written !== undefined && written.trim() !== '' ? written : undefined
}

/**
 * *en* or *ett*, from the declared `inherent` field rather than the second
 * character of the paradigm identifier, which happens to agree but is not the
 * declared field.
 *
 * Every one of the 83 019 nouns carries exactly one marker. Two of the four
 * have no gender to give and correctly come back `undefined`: `v` vacillates
 * between both genders (718 nouns — *accept* takes both *accepten* and
 * *acceptet*) and `p` is plural-only (332 nouns, with no singular row at all).
 * `inherent` means something else entirely on other Parts of Speech, so it is
 * only read for `nn`.
 */
export function genderOf(entry: SaldomEntry): Gender | undefined {
  if (entry.partOfSpeech !== 'nn') return undefined
  switch (entry.inherent?.[0]) {
    case 'u':
      return 'en'
    case 'n':
      return 'ett'
    default:
      return undefined
  }
}

export function nounForms(entry: SaldomEntry): NounForms {
  return {
    indefiniteSingular: firstWrittenForm(entry, NOUN_MSD.indefiniteSingular),
    definiteSingular: firstWrittenForm(entry, NOUN_MSD.definiteSingular),
    indefinitePlural: firstWrittenForm(entry, NOUN_MSD.indefinitePlural),
    definitePlural: firstWrittenForm(entry, NOUN_MSD.definitePlural),
  }
}

/**
 * The four principal parts. A deponent verb — 219 of 7 992, e.g. *andas* — has
 * only *s*-forms and so yields four empty Forms. That is a successful Lookup
 * with nothing to fill, not a miss: the data will never arrive by asking again.
 */
export function verbForms(entry: SaldomEntry): VerbForms {
  return {
    infinitive: firstWrittenForm(entry, VERB_MSD.infinitive),
    present: firstWrittenForm(entry, VERB_MSD.present),
    preterite: firstWrittenForm(entry, VERB_MSD.preterite),
    supine: firstWrittenForm(entry, VERB_MSD.supine),
  }
}

/**
 * The three positive Forms.
 *
 * 1 657 of 21 003 adjectives (7.9 %) are invariable — *abborrliknande* — and
 * carry a single `invar` row instead of the three. Grammatically that one form
 * *is* all three, so it fills all three rather than leaving the entry
 * incomplete for a word that can never be completed.
 */
export function adjectiveForms(entry: SaldomEntry): AdjectiveForms {
  const invariable = firstWrittenForm(entry, INVARIABLE_MSD)
  return {
    positiveEnForm: firstWrittenForm(entry, ADJECTIVE_MSD.positiveEnForm) ?? invariable,
    positiveEttForm:
      firstWrittenForm(entry, ADJECTIVE_MSD.positiveEttForm) ?? invariable,
    positivePlural:
      firstWrittenForm(entry, ADJECTIVE_MSD.positivePlural) ?? invariable,
  }
}

/**
 * The trailing number of a lemgram — `bok..nn.2` is sense 2. SALDO numbers its
 * senses from 1 and gives no gloss to tell them apart, so the number is the
 * only ordering available when a lemma has several (*bok* is both the book and
 * the beech tree, with different plurals).
 */
export function senseNumber(entry: SaldomEntry): number {
  const number = /\.(\d+)$/.exec(entry.lemgram)?.[1]
  return number === undefined ? Number.MAX_SAFE_INTEGER : Number(number)
}

/**
 * Whether an entry really is the lemma that was asked for.
 *
 * Necessary because `equals|baseform|…` is analyzed: it matches tokens, so an
 * unconstrained `tala` returns fifteen multi-word `vbm` phrases alongside
 * `tala..vb.1`, and it is case-insensitive, so `BOK` finds *bok*. The request
 * already filters by part of speech, but this re-check is what actually
 * guarantees the entry is the word the learner typed.
 */
export function matchesLemma(entry: SaldomEntry, lemma: string): boolean {
  return entry.baseform.localeCompare(lemma.trim(), 'sv', { sensitivity: 'accent' }) === 0
}
