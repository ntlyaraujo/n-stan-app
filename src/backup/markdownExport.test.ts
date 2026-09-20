/**
 * Markdown export: the promises this file makes to a reader who no longer has
 * the app (#44).
 *
 * It is allowed to be lossy, so most of what could be asserted here does not
 * matter. What does: that nothing you wrote is dropped, that a Tombstone still
 * says what it recorded, that a Journal Entry's Date survives without being
 * dragged across a timezone, and that a gap in a Paradigm is still visible as a
 * gap. Those are the things a lossy format can quietly get wrong.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { deleteDatabase } from '../data/db.ts'
import { createGrammarNote } from '../data/grammarNoteRepository.ts'
import { createJournalEntry } from '../data/journalEntryRepository.ts'
import { createVocabularyEntry } from '../data/vocabularyRepository.ts'
import type { BackupData } from './backupFile.ts'
import {
  createMarkdownExport,
  formatCalendarDate,
  markdownExportDocument,
  markdownExportFileName,
} from './markdownExport.ts'

const EXPORTED_AT = '2026-09-20T14:32:11.325Z'

const EMPTY: BackupData = {
  vocabularyEntries: [],
  grammarNotes: [],
  journalEntries: [],
  prompts: [],
}

function stamps(id: string) {
  return { id, createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z' }
}

/** One of everything worth losing, assembled without touching the database. */
const FULL: BackupData = {
  vocabularyEntries: [
    {
      ...stamps('v-bok'),
      lemma: 'bok',
      partOfSpeech: 'noun',
      gender: 'en',
      translation: 'book',
      exampleSentence: 'Jag läser en bok varje kväll.',
      tags: ['substantiv', 'Vardag'],
      lookupOutcome: 'filled',
      forms: {
        indefiniteSingular: 'bok',
        definiteSingular: 'boken',
        indefinitePlural: 'böcker',
        definitePlural: 'böckerna',
      },
    },
    {
      ...stamps('v-hus'),
      lemma: 'hus',
      partOfSpeech: 'noun',
      // No Gender, and only half a Paradigm: both gaps must still be visible.
      translation: 'house',
      exampleSentence: '',
      tags: [],
      lookupOutcome: 'deferred',
      forms: { indefiniteSingular: 'hus', definiteSingular: 'huset' },
    },
    {
      ...stamps('v-tala'),
      lemma: 'tala',
      partOfSpeech: 'verb',
      conjugationGroup: '1',
      translation: 'to speak',
      exampleSentence: 'Jag talar svenska.',
      tags: [],
      lookupOutcome: 'filled',
      forms: {
        infinitive: 'tala',
        present: 'talar',
        preterite: 'talade',
        supine: 'talat',
      },
    },
    {
      ...stamps('v-garna'),
      lemma: 'gärna',
      partOfSpeech: 'adverb',
      translation: 'gladly',
      exampleSentence: '',
      tags: [],
      lookupOutcome: 'not-found',
    },
  ],
  grammarNotes: [
    {
      ...stamps('g-ett'),
      title: 'Ett-nouns',
      body: '## When to use *ett*\n\n| Word | Gender |\n| --- | --- |\n| hus | ett |',
      tags: ['grammatik'],
      references: [{ vocabularyEntryId: 'v-hus' }, { vocabularyEntryId: 'v-gone' }],
    },
  ],
  journalEntries: [
    {
      ...stamps('j-second'),
      date: '2026-09-18',
      body: 'Andra anteckningen samma dag.',
      pins: [],
      tags: [],
    },
    {
      ...stamps('j-first'),
      // Deliberately the first instant of a day: a timezone slip would move it.
      date: '2026-09-19',
      createdAt: '2026-09-19T00:00:00.000Z',
      updatedAt: '2026-09-19T00:00:00.000Z',
      body: 'Jag gick till parken.\n\nDet var soligt.',
      attachedPromptId: 'p-custom',
      pins: [
        { status: 'resolved', pinnedKind: 'vocabularyEntry', pinnedAs: 'bok', targetId: 'v-bok' },
        { status: 'tombstone', pinnedKind: 'grammarNote', pinnedAs: 'Word order' },
      ],
      tags: ['helg'],
    },
  ],
  prompts: [
    { ...stamps('p-custom'), origin: 'custom', text: 'Vad gjorde du i helgen?', level: 'beginner' },
    {
      ...stamps('p-built-in'),
      origin: 'built-in',
      text: 'Beskriv ditt rum.',
      level: 'beginner',
      hidden: false,
    },
  ],
}

describe('the exported document', () => {
  const markdown = markdownExportDocument(FULL, EXPORTED_AT)

  it('opens with the app, the counts and the warning that it cannot be imported', () => {
    expect(markdown).toMatch(/^# n-stan-app\n/u)
    expect(markdown).toContain('4 Vocabulary Entries · 1 Grammar Note · 2 Journal Entries · 1 Custom Prompt')
    expect(markdown).toContain('The JSON backup is the one that restores.')
  })

  it('has one section per kind, in a fixed order', () => {
    // Matched by indexOf rather than by scanning every `##` line: a Grammar
    // Note's body is exported verbatim and may carry level-two headings of its
    // own, which is the format being lossy in the harmless direction.
    const order = ['## Journal', '## Vocabulary', '## Grammar Notes', '## Custom Prompts']
    const positions = order.map((heading) => markdown.indexOf(`\n${heading}\n`))
    expect(positions).not.toContain(-1)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('keeps every word, note and entry you wrote', () => {
    expect(markdown).toContain('Jag gick till parken.\n\nDet var soligt.')
    expect(markdown).toContain('Jag läser en bok varje kväll.')
    expect(markdown).toContain('| hus | ett |')
  })
})

describe('journal', () => {
  const markdown = markdownExportDocument(FULL, EXPORTED_AT)

  it('reads newest first, under a date heading rather than a title', () => {
    expect(markdown.indexOf('### 19 September 2026')).toBeLessThan(
      markdown.indexOf('### 18 September 2026'),
    )
    expect(markdown).not.toMatch(/^### j-first$/mu)
  })

  it('names the Attached Prompt, resolved from the Prompt store', () => {
    expect(markdown).toContain('*Prompt: Vad gjorde du i helgen?*')
  })

  it('exports a Tombstone as the plain text it already is', () => {
    expect(markdown).toContain('Pinned: bok (Vocabulary Entry), Word order (Grammar Note, since deleted)')
  })

  it('carries an entry Tags', () => {
    expect(markdown).toContain('Tags: helg')
  })

  it('separates two entries sharing a Date without inventing a title', () => {
    const markdownTwoOnOneDay = markdownExportDocument(
      {
        ...EMPTY,
        journalEntries: [
          { ...stamps('a'), date: '2026-09-18', body: 'Morgon.', pins: [], tags: [] },
          {
            ...stamps('b'),
            createdAt: '2026-09-18T20:00:00.000Z',
            updatedAt: '2026-09-18T20:00:00.000Z',
            date: '2026-09-18',
            body: 'Kväll.',
            pins: [],
            tags: [],
          },
        ],
      },
      EXPORTED_AT,
    )
    expect([...markdownTwoOnOneDay.matchAll(/^### 18 September 2026$/gmu)]).toHaveLength(1)
    expect(markdownTwoOnOneDay).toContain('Kväll.\n\n---\n\nMorgon.')
  })
})

describe('vocabulary', () => {
  const markdown = markdownExportDocument(FULL, EXPORTED_AT)

  it('is sorted by Lemma the way the list is', () => {
    const lemmas = [...markdown.matchAll(/^### (bok|hus|tala|gärna)$/gmu)].map((m) => m[1])
    expect(lemmas).toEqual(['bok', 'gärna', 'hus', 'tala'])
  })

  it('flattens Part of Speech, Gender and translation onto one line', () => {
    expect(markdown).toContain('Noun · en · book')
    expect(markdown).toContain('Verb · Conjugation Group 1 · to speak')
  })

  it('says outright when a noun has no Gender', () => {
    expect(markdown).toContain('Noun · Gender not recorded · house')
  })

  it('shows an unfilled Form as a gap rather than omitting it', () => {
    expect(markdown).toContain('- Indefinite plural: —')
    expect(markdown).toContain('- Definite plural: —')
  })

  it('gives a Part of Speech with an empty Paradigm no Form list', () => {
    const adverb = markdown.slice(markdown.indexOf('### gärna'))
    expect(adverb.slice(0, adverb.indexOf('### hus'))).not.toContain('- ')
  })
})

describe('grammar notes', () => {
  const markdown = markdownExportDocument(FULL, EXPORTED_AT)

  it('resolves a Reference to the Lemma it points at', () => {
    expect(markdown).toContain('References: hus, (no longer in the app)')
  })

  it('leaves the note body as the Markdown it already was', () => {
    expect(markdown).toContain('## When to use *ett*')
  })
})

describe('prompts', () => {
  it('exports the Prompts you wrote and not the ones the app ships', () => {
    const markdown = markdownExportDocument(FULL, EXPORTED_AT)
    expect(markdown).toContain('- Vad gjorde du i helgen? *(beginner)*')
    expect(markdown).not.toContain('Beskriv ditt rum.')
  })
})

describe('an empty database', () => {
  it('still produces a document that says so in each section', () => {
    const markdown = markdownExportDocument(EMPTY, EXPORTED_AT)
    expect(markdown).toContain('*No Journal Entries yet.*')
    expect(markdown).toContain('*No Vocabulary Entries yet.*')
    expect(markdown).toContain('*No Grammar Notes yet.*')
    expect(markdown).toContain('*No Custom Prompts yet.*')
    expect(markdown).toContain('0 Vocabulary Entries · 0 Grammar Notes')
  })
})

describe('formatCalendarDate', () => {
  it('reads the day off the string, never through a Date', () => {
    expect(formatCalendarDate('2026-01-01')).toBe('1 January 2026')
    expect(formatCalendarDate('2026-12-31')).toBe('31 December 2026')
  })

  it('passes anything that is not a calendar day straight through', () => {
    expect(formatCalendarDate('not-a-date')).toBe('not-a-date')
  })
})

describe('markdownExportFileName', () => {
  it('sorts beside the JSON backup taken in the same minute', () => {
    expect(markdownExportFileName(EXPORTED_AT)).toBe('n-stan-app-2026-09-20-1432.md')
  })
})

describe('createMarkdownExport', () => {
  beforeEach(async () => {
    await deleteDatabase()
  })

  it('renders what is actually stored, in one read of the database', async () => {
    const { entry: hus } = await createVocabularyEntry({
      lemma: 'hus',
      translation: 'house',
      partOfSpeech: 'noun',
      gender: 'ett',
      forms: { indefiniteSingular: 'hus', definiteSingular: 'huset' },
    })
    await createGrammarNote({
      title: 'Ett-nouns',
      body: 'Neuter nouns take *ett*.',
      references: [{ vocabularyEntryId: hus.id }],
    })
    await createJournalEntry({ date: '2026-09-19', body: 'Jag bor i ett hus.' })

    const markdown = await createMarkdownExport(EXPORTED_AT)

    expect(markdown).toContain('### hus')
    expect(markdown).toContain('Noun · ett · house')
    expect(markdown).toContain('### Ett-nouns')
    expect(markdown).toContain('References: hus')
    expect(markdown).toContain('### 19 September 2026')
    expect(markdown).toContain('Jag bor i ett hus.')
  })
})
