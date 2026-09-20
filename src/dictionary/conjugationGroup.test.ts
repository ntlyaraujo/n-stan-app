/**
 * #18 — Conjugation Group from the paradigm identifier.
 *
 * Every entry below comes from a recorded live response; the assertions are
 * about what the derivation does with real SALDO data, not with invented data.
 */

import { describe, expect, it } from 'vitest'
import type { ConjugationGroup } from '../domain/index.ts'
import { deriveConjugationGroup } from './conjugationGroup.ts'
import { FIXTURES } from './fixtures.ts'
import { entryOf } from './testEntries.ts'

describe('deriveConjugationGroup', () => {
  const DIGIT_CASES: readonly {
    lemgram: string
    fixture: unknown
    paradigm: string
    group: ConjugationGroup
  }[] = [
    { lemgram: 'beundra..vb.1', fixture: FIXTURES.beundraVb, paradigm: 'vb_1a_beundra', group: '1' },
    { lemgram: 'väga..vb.1', fixture: FIXTURES.vagaVb, paradigm: 'vb_2a_viga', group: '2a' },
    { lemgram: 'köpa..vb.1', fixture: FIXTURES.kopaVb, paradigm: 'vb_2a_ansöka', group: '2b' },
    { lemgram: 'sy..vb.1', fixture: FIXTURES.syVb, paradigm: 'vb_3a_sy', group: '3' },
    { lemgram: 'dricka..vb.1', fixture: FIXTURES.drickaVb, paradigm: 'vb_4a_dricka', group: '4' },
  ]

  it.each(DIGIT_CASES)('gives $lemgram group $group', ({ lemgram, fixture, paradigm, group }) => {
    const entry = entryOf(fixture, lemgram)
    expect(entry.paradigm).toBe(paradigm)
    expect(deriveConjugationGroup(entry)).toBe(group)
  })

  describe('the 2a/2b split', () => {
    it('comes from the preterite, because SALDO codes both as 2a', () => {
      const vaga = entryOf(FIXTURES.vagaVb, 'väga..vb.1')
      const kopa = entryOf(FIXTURES.kopaVb, 'köpa..vb.1')

      // Identical paradigm code, opposite sides of the Swedish split. Reading
      // "2a" out of the identifier would be wrong for 345 of the 980 verbs
      // SALDO codes 2a — 35 % of them.
      expect(vaga.paradigm.split('_')[1]).toBe('2a')
      expect(kopa.paradigm.split('_')[1]).toBe('2a')
      expect(deriveConjugationGroup(vaga)).toBe('2a')
      expect(deriveConjugationGroup(kopa)).toBe('2b')
    })

    it('reads -de as 2a and -te as 2b', () => {
      expect(preterite(entryOf(FIXTURES.vagaVb, 'väga..vb.1'))).toBe('vägde')
      expect(preterite(entryOf(FIXTURES.kopaVb, 'köpa..vb.1'))).toBe('köpte')
    })

    it('gives nothing to a group-2 deponent, which has no preterite to split on', () => {
      const skammas = entryOf(FIXTURES.skammasVb, 'skämmas..vb.1')
      expect(skammas.paradigm).toBe('vb_2s_trivas')
      expect(deriveConjugationGroup(skammas)).toBeUndefined()
    })
  })

  describe('the digit-less classes', () => {
    it('gives nothing for the vacillating `va` class, including `tala`', () => {
      // The spec's own worked verb example. `vb_va_tala` is genuinely two
      // parallel conjugations — two preterites, two supines — so there is no
      // digit and no single right answer. A guess here would teach the learner
      // wrong Swedish; an empty, correctable field will not.
      const tala = entryOf(FIXTURES.talaVb, 'tala..vb.1')
      expect(tala.paradigm).toBe('vb_va_tala')
      expect(deriveConjugationGroup(tala)).toBeUndefined()
    })

    it('gives nothing for irregular `om` verbs', () => {
      const veta = entryOf(FIXTURES.vetaVb, 'veta..vb.1')
      expect(veta.paradigm).toBe('vb_om_veta')
      expect(deriveConjugationGroup(veta)).toBeUndefined()
    })

    it('gives nothing for defective `0d` verbs', () => {
      const lyster = entryOf(FIXTURES.lysterVb, 'lyster..vb.1')
      expect(lyster.paradigm).toBe('vb_0d_lyster')
      expect(deriveConjugationGroup(lyster)).toBeUndefined()
    })
  })

  it('still reads the digit when the verb has no active forms at all', () => {
    // A deponent group-1 verb: no `inf aktiv`, but `vb_1s_` is unambiguous.
    const andas = entryOf(FIXTURES.andasVb, 'andas..vb.1')
    expect(andas.paradigm).toBe('vb_1s_andas')
    expect(deriveConjugationGroup(andas)).toBe('1')
  })

  it('reads each sense of a lemma separately', () => {
    // *väga* is group 2a in one sense and group 1 in another.
    expect(deriveConjugationGroup(entryOf(FIXTURES.vagaVb, 'väga..vb.1'))).toBe('2a')
    expect(deriveConjugationGroup(entryOf(FIXTURES.vagaVb, 'väga..vb.2'))).toBe('1')
  })

  describe("the spec's worked examples", () => {
    it('gives no group to a noun or an adjective', () => {
      expect(deriveConjugationGroup(entryOf(FIXTURES.bokNn, 'bok..nn.1'))).toBeUndefined()
      expect(deriveConjugationGroup(entryOf(FIXTURES.storAv, 'stor..av.1'))).toBeUndefined()
    })
  })
})

function preterite(entry: { inflectionTable: readonly { msd: string; writtenForm: string }[] }) {
  return entry.inflectionTable.find((row) => row.msd === 'pret ind aktiv')?.writtenForm
}
