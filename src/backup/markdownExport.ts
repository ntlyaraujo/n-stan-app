/**
 * The escape hatch: everything you have written, as one readable Markdown
 * document (spec 6, #44).
 *
 * The JSON backup is the one that restores. This is the other half of the
 * bargain it makes — JSON alone would leave months of Swedish trapped in an app
 * only you run, so there has to be a copy that opens in any notes app on any
 * machine, with no import step and no schema to honour.
 *
 * Three consequences follow, and they are the whole design:
 *
 * 1. **Lossy on purpose.** A Vocabulary Entry's typed fields flatten to labelled
 *    text. Nothing here round-trips, and nothing tries to: an id, a timestamp
 *    and a Lookup outcome are the app's bookkeeping rather than your writing,
 *    so they are dropped. What survives is what you wrote and what it means.
 *
 * 2. **One document, not a folder.** A single `.md` file is one download, opens
 *    in everything, and needs no archive format — and a heading tree is what a
 *    notes app splits on anyway.
 *
 * 3. **It is not a backup, so it does not reset the export reminder.** Only
 *    {@link downloadBackup} records an export. A reminder quieted by a file that
 *    cannot restore would be worse than no reminder at all.
 *
 * Tombstones export as the plain text they already are, which is the point of
 * ADR-0001: a record of what you practiced must read the same years later, and
 * here it is no longer even a link.
 */

import type {
  GrammarNote,
  JournalEntry,
  Pin,
  Prompt,
  Tag,
  VocabularyEntry,
} from '../domain/index.ts'
import { isBuiltInPrompt, isResolvedPin, PARADIGM } from '../domain/index.ts'
import { now } from '../data/index.ts'
import type { BackupData } from './backupFile.ts'
import { BACKUP_APP } from './backupFile.ts'
import { readBackupData } from './exportBackup.ts'

// --- labels ---------------------------------------------------------------

/**
 * Human labels for the Forms and the Parts of Speech.
 *
 * The capture form has its own copy of these. They are deliberately not shared:
 * this module is the data layer, and reaching up into `src/screens/` for a
 * string would invert the dependency. Key drift is caught anyway — `Record`
 * over the domain's own unions means a renamed Form fails the build here.
 */
const FORM_LABELS: Readonly<Record<string, string>> = {
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

const PART_OF_SPEECH_LABELS: Readonly<Record<VocabularyEntry['partOfSpeech'], string>> = {
  noun: 'Noun',
  verb: 'Verb',
  adjective: 'Adjective',
  adverb: 'Adverb',
  phrase: 'Phrase',
  other: 'Other',
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Shown where a Form of the Paradigm has not been filled in. */
const BLANK = '—'

// --- small helpers --------------------------------------------------------

function isFilled(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== ''
}

/**
 * A heading has to survive on one line, so a Lemma or title that happens to
 * contain a line break is flattened rather than breaking the document's shape.
 */
function headingText(raw: string, fallback: string): string {
  const flat = raw.replace(/\s+/gu, ' ').trim()
  return flat === '' ? fallback : flat
}

/**
 * `2026-09-20` as `20 September 2026`, read straight off the string.
 *
 * A Journal Entry's Date is a calendar day chosen by you, not an instant, so it
 * must never go through `Date` — parsing it would drag it across a timezone and
 * could move the entry to the day before.
 */
export function formatCalendarDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date)
  if (match === null) return date
  const [, year, month, day] = match
  return `${String(Number(day))} ${MONTHS[Number(month) - 1] ?? month} ${year}`
}

/** An instant, in the reader's own timezone: this one is a real moment in time. */
function formatInstant(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  const time = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
  return `${String(parsed.getDate())} ${MONTHS[parsed.getMonth()]} ${String(parsed.getFullYear())}, ${time}`
}

function tagLine(tags: readonly Tag[]): readonly string[] {
  return tags.length === 0 ? [] : [`Tags: ${tags.join(', ')}`]
}

function countLine(data: BackupData): string {
  const customPrompts = data.prompts.filter((prompt) => !isBuiltInPrompt(prompt))
  return [
    plural(data.vocabularyEntries.length, 'Vocabulary Entry', 'Vocabulary Entries'),
    plural(data.grammarNotes.length, 'Grammar Note', 'Grammar Notes'),
    plural(data.journalEntries.length, 'Journal Entry', 'Journal Entries'),
    plural(customPrompts.length, 'Custom Prompt', 'Custom Prompts'),
  ].join(' · ')
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

// --- vocabulary -----------------------------------------------------------

/**
 * What a Vocabulary Entry is, in one line: Part of Speech, then the thing that
 * is not a Form but still defines the word — Gender for a noun, Conjugation
 * Group for a verb — then the translation.
 *
 * A noun with no Gender says so rather than staying silent about it. It is the
 * one gap the capture screen flags, and it is worth carrying across.
 */
function vocabularySummary(entry: VocabularyEntry): string {
  const parts: string[] = [PART_OF_SPEECH_LABELS[entry.partOfSpeech]]
  if (entry.partOfSpeech === 'noun') {
    parts.push(entry.gender ?? 'Gender not recorded')
  }
  if (entry.partOfSpeech === 'verb' && entry.conjugationGroup !== undefined) {
    parts.push(`Conjugation Group ${entry.conjugationGroup}`)
  }
  if (isFilled(entry.translation)) parts.push(entry.translation.trim())
  return parts.join(' · ')
}

/**
 * Every Form of the Paradigm in Paradigm order, filled or not, so that what is
 * still missing stays visible in the export rather than quietly vanishing. The
 * Paradigm comes from the domain, so an adverb, phrase or other renders no list
 * at all without this module knowing why.
 */
function paradigmLines(entry: VocabularyEntry): readonly string[] {
  const names = PARADIGM[entry.partOfSpeech]
  if (names.length === 0) return []
  const forms: Readonly<Record<string, string | undefined>> =
    'forms' in entry ? entry.forms : {}
  return names.map((name) => {
    const value = forms[name]
    return `- ${FORM_LABELS[name] ?? name}: ${isFilled(value) ? value.trim() : BLANK}`
  })
}

function vocabularyEntrySection(entry: VocabularyEntry): string {
  const blocks: string[] = [
    `### ${headingText(entry.lemma, 'Untitled')}`,
    vocabularySummary(entry),
  ]
  const forms = paradigmLines(entry)
  if (forms.length > 0) blocks.push(forms.join('\n'))
  if (isFilled(entry.exampleSentence)) {
    blocks.push(blockquote(entry.exampleSentence))
  }
  blocks.push(...tagLine(entry.tags))
  return blocks.join('\n\n')
}

/** Your own sentence, set apart from the app's labels around it. */
function blockquote(text: string): string {
  return text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`.trimEnd())
    .join('\n')
}

// --- grammar notes --------------------------------------------------------

/**
 * A Grammar Note's body is already Markdown and is written out untouched,
 * headings and hand-written tables included. Rewriting it to fit under this
 * document's heading levels would mean editing your writing to suit the export,
 * which is the wrong way round.
 */
function grammarNoteSection(
  note: GrammarNote,
  lemmaById: ReadonlyMap<string, string>,
): string {
  const blocks: string[] = [`### ${headingText(note.title, 'Untitled Grammar Note')}`]
  if (isFilled(note.body)) blocks.push(note.body.trim())

  const references = note.references.map(
    (reference) => lemmaById.get(reference.vocabularyEntryId) ?? '(no longer in the app)',
  )
  if (references.length > 0) blocks.push(`References: ${references.join(', ')}`)
  blocks.push(...tagLine(note.tags))
  return blocks.join('\n\n')
}

// --- journal --------------------------------------------------------------

/**
 * A Pin, as text. A Tombstone keeps the Lemma or title it was pinned as and
 * says plainly that the thing itself is gone — it is not a broken link to be
 * repaired, it is the record standing after the target was deleted.
 */
function pinText(pin: Pin): string {
  const kind = pin.pinnedKind === 'vocabularyEntry' ? 'Vocabulary Entry' : 'Grammar Note'
  return isResolvedPin(pin)
    ? `${pin.pinnedAs} (${kind})`
    : `${pin.pinnedAs} (${kind}, since deleted)`
}

function journalEntryBlocks(
  entry: JournalEntry,
  promptById: ReadonlyMap<string, string>,
): string {
  const blocks: string[] = []

  const prompt =
    entry.attachedPromptId === undefined
      ? undefined
      : promptById.get(entry.attachedPromptId)
  if (prompt !== undefined) blocks.push(`*Prompt: ${prompt.replace(/\s+/gu, ' ').trim()}*`)

  blocks.push(isFilled(entry.body) ? entry.body.trim() : '*(empty)*')

  if (entry.pins.length > 0) {
    blocks.push(`Pinned: ${entry.pins.map(pinText).join(', ')}`)
  }
  blocks.push(...tagLine(entry.tags))
  return blocks.join('\n\n')
}

/**
 * Newest Date first, and within a Date the most recently written first — the
 * order the Journal list already shows.
 */
function journalSection(
  entries: readonly JournalEntry[],
  promptById: ReadonlyMap<string, string>,
): string {
  const ordered = [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )

  const sections: string[] = []
  let currentDate: string | undefined
  for (const entry of ordered) {
    if (entry.date === currentDate) {
      // A second entry on the same day: a rule keeps it from running into the
      // one above without inventing a title the entry does not have.
      sections.push('---')
    } else {
      sections.push(`### ${formatCalendarDate(entry.date)}`)
      currentDate = entry.date
    }
    sections.push(journalEntryBlocks(entry, promptById))
  }
  return sections.join('\n\n')
}

// --- prompts --------------------------------------------------------------

/**
 * Only the Prompts you wrote. A Built-in Prompt ships with the app and would be
 * the same in any copy of it, so exporting them would be exporting the app back
 * to yourself.
 */
function customPromptsSection(prompts: readonly Prompt[]): string {
  return prompts
    .filter((prompt) => !isBuiltInPrompt(prompt))
    .map((prompt) => `- ${prompt.text.replace(/\s+/gu, ' ').trim()} *(${prompt.level})*`)
    .join('\n')
}

// --- the document ---------------------------------------------------------

function section(title: string, body: string, empty: string): string {
  return `## ${title}\n\n${body === '' ? `*${empty}*` : body}`
}

/** Everything in {@link BackupData}, as one Markdown document. */
export function markdownExportDocument(data: BackupData, exportedAt: string): string {
  const lemmaById = new Map(data.vocabularyEntries.map((entry) => [entry.id, entry.lemma]))
  const promptById = new Map(data.prompts.map((prompt) => [prompt.id, prompt.text]))

  const preamble = [
    `# ${BACKUP_APP}`,
    `Exported ${formatInstant(exportedAt)}. ${countLine(data)}.`,
    'This is the readable copy, and it is lossy: ids, timestamps and Dictionary bookkeeping are left out, and nothing here can be imported back. The JSON backup is the one that restores.',
  ].join('\n\n')

  const journal = section(
    'Journal',
    journalSection(data.journalEntries, promptById),
    'No Journal Entries yet.',
  )

  const vocabulary = section(
    'Vocabulary',
    [...data.vocabularyEntries]
      .sort((a, b) => a.lemma.localeCompare(b.lemma, 'sv'))
      .map(vocabularyEntrySection)
      .join('\n\n'),
    'No Vocabulary Entries yet.',
  )

  const grammar = section(
    'Grammar Notes',
    [...data.grammarNotes]
      .sort((a, b) => a.title.localeCompare(b.title, 'sv'))
      .map((note) => grammarNoteSection(note, lemmaById))
      .join('\n\n'),
    'No Grammar Notes yet.',
  )

  const prompts = section(
    'Custom Prompts',
    customPromptsSection(data.prompts),
    'No Custom Prompts yet.',
  )

  return `${[preamble, journal, vocabulary, grammar, prompts].join('\n\n')}\n`
}

/** Read everything out and render it, in one pass over the database. */
export async function createMarkdownExport(
  exportedAt: string = now(),
): Promise<string> {
  return markdownExportDocument(await readBackupData(), exportedAt)
}

/** `n-stan-app-2026-09-20-1432.md`, alongside the JSON backup of the same minute. */
export function markdownExportFileName(exportedAt: string): string {
  const stamp = exportedAt.replace(/[-:]/gu, '').replace(/\.\d+Z?$/u, '')
  const [date, time = ''] = stamp.split('T')
  const day = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  return `${BACKUP_APP}-${day}-${time.slice(0, 4)}.md`
}

/**
 * Render the document and hand it to the browser as a download.
 *
 * Deliberately no {@link recordExport} call: this file cannot restore anything,
 * so it must not be what quiets the reminder to take a real backup.
 */
export async function downloadMarkdownExport(): Promise<string> {
  const exportedAt = now()
  const document_ = await createMarkdownExport(exportedAt)
  const blob = new Blob([document_], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = markdownExportFileName(exportedAt)
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 10_000)
  }
  return document_
}
