import { describe, expect, it } from 'vitest'

import { addTag, hasTag, normaliseTag, tagsMatch } from './tag.ts'
import { isComplete } from './vocabulary.ts'
import type { VocabularyEntry } from './vocabulary.ts'

const common = {
  id: 'id',
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
  translation: '',
  exampleSentence: '',
  tags: [],
  lookupOutcome: 'never-attempted',
} as const

describe('Complete', () => {
  it('is true when every Form of the Paradigm has a value', () => {
    const bok: VocabularyEntry = {
      ...common,
      lemma: 'bok',
      partOfSpeech: 'noun',
      gender: 'en',
      forms: {
        indefiniteSingular: 'bok',
        definiteSingular: 'boken',
        indefinitePlural: 'böcker',
        definitePlural: 'böckerna',
      },
    }

    expect(isComplete(bok)).toBe(true)
  })

  it('is false while a Form is missing or blank', () => {
    const tala: VocabularyEntry = {
      ...common,
      lemma: 'tala',
      partOfSpeech: 'verb',
      forms: { infinitive: 'tala', present: 'talar', preterite: '  ' },
    }

    expect(isComplete(tala)).toBe(false)
  })

  it('is true for a Part of Speech with an empty Paradigm', () => {
    const phrase: VocabularyEntry = {
      ...common,
      lemma: 'det spelar ingen roll',
      partOfSpeech: 'phrase',
    }

    expect(isComplete(phrase)).toBe(true)
  })

  it('does not depend on Gender, which is not a Form', () => {
    const hus: VocabularyEntry = {
      ...common,
      lemma: 'hus',
      partOfSpeech: 'noun',
      forms: {
        indefiniteSingular: 'hus',
        definiteSingular: 'huset',
        indefinitePlural: 'hus',
        definitePlural: 'husen',
      },
    }

    expect(hus.gender).toBeUndefined()
    expect(isComplete(hus)).toBe(true)
  })
})

describe('Tag', () => {
  it('trims and collapses whitespace but keeps the spelling', () => {
    expect(normaliseTag('  Verb   tenses ')).toBe('Verb tenses')
  })

  it('matches without regard to case', () => {
    expect(tagsMatch('Verb tenses', 'verb tenses')).toBe(true)
    expect(hasTag(['Verb tenses'], 'VERB TENSES')).toBe(true)
  })

  it('keeps the spelling first used', () => {
    expect(addTag(['Verb tenses'], 'verb tenses')).toEqual(['Verb tenses'])
    expect(addTag(['Verb tenses'], 'mat')).toEqual(['Verb tenses', 'mat'])
  })
})
