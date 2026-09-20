/**
 * The Dictionary: Lookup against SALDO through Språkbanken's Karp v7 API.
 *
 * SALDO is licensed CC BY 4.0. Any UI built on this must visibly credit SALDO
 * and Språkbanken — spec section 4 makes that a requirement, not a courtesy.
 */

export {
  KARP_BASE_URL,
  LOOKUP_SIZE,
  SALDOM_PART_OF_SPEECH,
  SALDOM_RESOURCE,
  buildLookupUrl,
  isQueryableLemma,
  parseKarpResponse,
} from './karp.ts'
export type {
  KarpHit,
  KarpQueryResponse,
  SaldomEntry,
  SaldomInflection,
  SaldomPartOfSpeech,
} from './karp.ts'

export {
  ADJECTIVE_MSD,
  NOUN_MSD,
  VERB_MSD,
  adjectiveForms,
  firstWrittenForm,
  genderOf,
  matchesLemma,
  nounForms,
  senseNumber,
  verbForms,
} from './saldom.ts'

export { deriveConjugationGroup } from './conjugationGroup.ts'

export { lookUpLemma, mapKarpResponse, supportsLookup } from './lookup.ts'
export type {
  AdjectiveSense,
  DeferredLookup,
  DictionaryLookup,
  DictionarySense,
  FilledLookup,
  LookupOptions,
  LookupPartOfSpeech,
  NotFoundLookup,
  NounSense,
  VerbSense,
} from './lookup.ts'
