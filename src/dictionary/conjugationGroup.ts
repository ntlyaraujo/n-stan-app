/**
 * Conjugation Group from a SALDO paradigm identifier (#18).
 *
 * Best-effort and always user-correctable, per spec section 4. Where the
 * paradigm permits a confident answer this gives one; where it does not, it
 * returns nothing rather than a guess. A wrong Conjugation Group silently
 * teaches the learner wrong Swedish, which is worse than a blank field.
 *
 * Measured over all 7 992 `vb` entries in `saldom` on 2026-09-20:
 * 7 793 get a group (97.5 %) and 199 correctly get none.
 */

import type { ConjugationGroup } from '../domain/index.ts'
import type { SaldomEntry } from './karp.ts'
import { firstWrittenForm, VERB_MSD } from './saldom.ts'

/**
 * `vb_<code>_<exemplar>`, where `<code>` is two characters. The first is the
 * conjugation digit when there is one; `v` (vacklande), `o` (irregular/modal),
 * `i` and `0` (defective) have no digit at all.
 */
const VERB_PARADIGM_PATTERN = /^vb_(.)(.)_/

/**
 * Derive the Conjugation Group, or `undefined` when SALDO does not determine one.
 *
 * Two things the spec's one-line "map it from the paradigm identifier" hides,
 * both confirmed against the live API:
 *
 * 1. **SALDO's `2a` is not Swedish 2a.** `vb_2a_viga` (väga → väg*de*, Swedish
 *    2a) and `vb_2a_ansöka` (köpa → köp*te*, Swedish 2b) share the one code.
 *    345 of the 980 verbs coded `2a` are Swedish 2b — reading the letter off
 *    the identifier is wrong for 35 % of them. Only the digit is meaningful;
 *    the 2a/2b split has to come from the preterite ending.
 * 2. **The spec's own worked example `tala` has no group.** Its paradigm is
 *    `vb_va_tala` — two parallel conjugations, hence two preterites (`talade`
 *    *and* `talte`) and two supines. There is no digit to read, and picking
 *    one of the two conjugations would be inventing an answer. `tala` is in
 *    the 2.5 % that correctly comes back empty for the user to fill in.
 */
export function deriveConjugationGroup(entry: SaldomEntry): ConjugationGroup | undefined {
  if (entry.partOfSpeech !== 'vb') return undefined

  const digit = VERB_PARADIGM_PATTERN.exec(entry.paradigm)?.[1]
  switch (digit) {
    case '1':
      return '1'
    case '3':
      return '3'
    case '4':
      return '4'
    case '2':
      return groupTwoSubclass(entry)
    default:
      // `va`/`vm`/`vs` vacillating, `om`/`oa` irregular, `ik`/`id`/`0d`
      // defective — 149 verbs with genuinely no single group.
      return undefined
  }
}

/**
 * Group 2 splits on how the preterite is formed: *-de* after a voiced stem is
 * 2a, *-te* after a voiceless one is 2b. Verified across all 1 149 group-2
 * verbs: 709 end in *-de*, 390 in *-te*, and the remaining 50 have no active
 * preterite to test (46 deponents in `vb_2s_*`, two defectives, two whose only
 * `pret ind aktiv` row is an archaic subjunctive) and so get nothing.
 */
function groupTwoSubclass(entry: SaldomEntry): ConjugationGroup | undefined {
  const preterite = firstWrittenForm(entry, VERB_MSD.preterite)
  if (preterite === undefined) return undefined
  if (preterite.endsWith('te')) return '2b'
  if (preterite.endsWith('de')) return '2a'
  return undefined
}
