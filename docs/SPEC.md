# n-stan-app: Specification

A personal app for practicing Swedish, modeled on the method of *Fluentish* by Jo Franco.

Status: agreed design, not yet implemented.
Last updated: 2026-09-20

Vocabulary is fixed in [CONTEXT.md](../CONTEXT.md). Where this spec and that glossary
disagree, the glossary wins.

---

## 1. Purpose

Three connected spaces that feed each other:

1. **Vocabulary** you collect, stored with the grammatical forms Swedish actually requires.
2. **Grammar notes** you write, linked to the words they explain.
3. **A journal** where you write your own Swedish, with vocabulary and grammar visible beside you as you write.

The loop is the point. A word is captured, then used in writing, then reviewed through what it is linked to.

### Source material

*Fluentish* is a hybrid workbook and journal rather than a textbook. It has a planning half (goal setting, habit tracker, monthly planner, vocabulary list pages, verb table and grammar rule pages, daily missions) and a journaling half (60+ prompts ordered beginner to advanced). Its pedagogy is production-first and personally relevant: you write about your own life, rather than drilling flashcards. No source material mentions spaced repetition.

This app takes the vocabulary, grammar and journaling structure, and the writing-first philosophy. It deliberately leaves out the planning half. See section 8.

---

## 2. Scope of v1

**In scope**

- Vocabulary capture, typed by part of speech, with dictionary auto-fill
- Grammar notes in Markdown, linked to vocabulary
- Journal entries with a bundled prompt library
- A split view pairing the journal with searchable vocabulary and grammar
- Local-only storage, export and import
- Installable progressive web app, deployed as a static site

**Out of scope** (deliberate, with reasoning in section 8)

- Flashcards and spaced repetition
- The planning half: goals, habit tracking, monthly planner, daily missions
- An English translation field on journal entries
- Detecting which vocabulary you used by reading the text you typed
- A special character button row for å, ä and ö
- Dark mode (variables in place, theme ships later)
- Rule-based automatic linking, for example a note declaring it applies to all ett-nouns
- Wiki-style inline links in note bodies

---

## 3. Domain model

All entities carry an id and creation and update timestamps.

### 3.1 Vocabulary Entry

A Vocabulary Entry is typed by part of speech. The part of speech determines which Forms exist — together, its Paradigm. **Every Form is optional**, so capture stays fast and a Paradigm can be completed later.

| Part of speech | Forms |
|---|---|
| noun | gender (*en* or *ett*), indefinite singular, definite singular, indefinite plural, definite plural |
| verb | conjugation group, infinitive, present, preterite, supine |
| adjective | positive en-form, positive ett-form, positive plural |
| adverb | none |
| phrase | none |
| other | none |

Common to every type:

- **lemma**: the word or expression as you would look it up
- **translation**
- **example sentence**: one, written by you, personally meaningful
- **tags**
- **complete**: derived, never stored. Every Form in the Paradigm has a value. A part of
  speech with no Paradigm, meaning adverb, phrase and other, is therefore always complete.
- **lookup outcome**: never attempted, filled, not found or deferred. This, and not
  completeness, decides whether the Dictionary is tried again.

Worked examples of the paradigms: *bok / boken / böcker / böckerna* for a noun, *tala / talar / talade / talat* for a verb, *stor / stort / stora* for an adjective.

**Phrases are first-class.** A lot of useful Swedish arrives as an expression with no paradigm, for instance *det spelar ingen roll*, and it belongs in the collection.

**Duplicates warn but never block.** Homonyms are real: *bok* is both a book and a beech tree.

### 3.2 Grammar Note

- **title**
- **body**: free-form Markdown, rendered on view
- **tags**
- **references** to vocabulary entries, with backlinks shown automatically on the word

Conjugation and declension tables are written as Markdown tables. There is no table builder.

### 3.3 Journal Entry

- **date**: the day the entry belongs to, chosen by you and defaulting to today. Distinct
  from the creation timestamp, which is never edited. No title.
- **body**: a single text field, Swedish only
- **attached prompt**, optional
- **pins**: vocabulary entries and grammar notes kept beside you while writing, which
  double as the record of what you practiced. Pins belong to this entry and never carry
  over to the next one.
- **tags**

Multiple entries per day are allowed. The list groups by date and uses the first line of the text as the preview.

### 3.4 Prompt

- **text**, in Swedish
- **level**: beginner, intermediate or advanced
- **origin**: built-in or custom. Built-in prompts ship with the app and are read-only.
  You may hide one, and editing one produces a custom copy, so a revised prompt set can
  ship later without discarding your wording.

Roughly forty original prompts ship with the app, spread across the three levels, and you can add your own. They are original writing, not reproduced from the book.

Because prompts are Swedish-only, **the beginner set must be authored in deliberately simple Swedish** so that a prompt is never itself the obstacle.

### 3.5 Tags

A single shared namespace across vocabulary, grammar notes and journal entries. A tag such as *verb tenses* pulls up words and notes together. Tags match without regard to case, so *Verb tenses* and *verb tenses* are one tag, kept in the spelling first used. Each section's list supports search and filtering by tag, and vocabulary additionally filters by part of speech and by completeness.

### 3.6 Links

| Relationship | How it is created | Direction |
|---|---|---|
| Grammar note to vocabulary | Explicit picker on the note | Backlinks shown automatically on the word |
| Journal entry to vocabulary or grammar | Pinning it in the side panel while writing | Saved per entry |

**Deletion never cascades.** Deleting something warns you first, showing what is about to lose its link. Grammar notes and journal entries are never destroyed by the deletion of something they reference, and they lose it differently. A grammar note simply loses the reference. A journal entry keeps the pin as a **tombstone**: the lemma or title it was made with, held as plain text and no longer linked, because a record of what you practiced must not change months after the fact. See [ADR-0001](./adr/0001-pin-tombstones.md).

---

## 4. Dictionary auto-fill

Swedish noun gender and verb forms cannot be guessed from the base word, and typing them by hand for every entry would be the app's main source of friction.

**Source:** SALDO, from Språkbanken at the University of Gothenburg, through the Karp v7 API.

Verified live during design:

- Answers browser requests directly, with a permissive cross-origin header and no API key
- Returns exactly the needed fields, including the inherent marker that distinguishes *en* words from *ett* words
- Covers noun, verb and adjective paradigms in labeled form

**Behavior**

1. Looking up a lemma calls the API and prefills the Forms.
2. Every result is cached permanently in local storage, so a word is fetched once.
3. Auto-fill **prefills and never locks**. Every Form stays editable.
4. Offline, the entry saves immediately with blank Forms and its lookup is marked deferred. The fill is attempted automatically the next time that entry is opened with a connection.
5. Entries that are not complete are filterable, which doubles as a useful review list.

**Known caveat.** The conjugation group is not a labeled field in the API. It has to be derived from the paradigm identifier, which is a small mapping with real risk of edge cases. Treat the group as best-effort and always user-correctable.

**Attribution obligation.** SALDO is licensed CC BY 4.0. The app must visibly credit SALDO and Språkbanken. This is a requirement, not a courtesy.

**Rejected sources.** Folkets lexikon has no gender field at all, unlabeled and inconsistently ordered inflections, and is missing the definite plural for most nouns. Wikidata Lexemes are usable as a fallback but cover well under half as many Swedish words, with grammatical features expressed as bare identifiers. SAOL has no open license or API.

---

## 5. The split view

While writing, a panel beside the journal offers:

- **Live search** across vocabulary and grammar
- **Pins** for the words and notes you are deliberately practicing in this entry

Pinning binds the item to the entry, so one gesture both keeps it visible and records that you used it. Anything you did not end up using can be unpinned. Pins are per entry: a second entry the same evening starts with none.

**Layout.** Side by side on a wide screen. On a phone, a bottom sheet or a toggled tab.

---

## 6. Data, durability and export

Storage is IndexedDB. Single user, no login, no backend. Data never leaves your browser.

This has a real failure mode: browsers evict storage under pressure, and Safari on iOS can clear site data for sites left unopened for a while. For a journal built over months, that is the worst outcome this app has.

Mitigations, both required:

1. **Request persistent storage on first run.** One call, materially lower eviction risk.
2. **Nudge to export** after a stretch without one.

**Export produces both formats:**

| Format | Role |
|---|---|
| JSON | The real backup. Complete and re-importable. |
| Markdown | Escape hatch. Readable in any notes app, lossy on structured vocabulary fields. |

JSON alone would leave your Swedish notes trapped in an app only you run.

---

## 7. Technical decisions

| Area | Decision |
|---|---|
| Stack | React, TypeScript, Vite (the existing scaffold) |
| Styling | Tailwind, with colors as CSS variables from day one |
| Routing | react-router; bottom tabs on mobile becoming a side rail on desktop |
| Landing screen | Journal |
| Storage | IndexedDB |
| Testing | Vitest on the data layer only: storage, API response mapping, linking logic |
| Delivery | Installable PWA via the Vite PWA plugin, service worker caching the app shell only |
| Hosting | Static site on a free host |
| Editor | Plain textarea; Markdown rendered on view |
| Theme | Light at launch; variables in place so dark mode is not a retrofit |

Dictionary responses are cached in IndexedDB rather than by the service worker, so caching stays in one place.

Component tests are excluded on purpose. The storage and linking logic is where a silent bug would quietly lose writing, and that is what the tests guard.

---

## 8. Rationale for the close calls

The decisions most likely to be second-guessed later, with the reasoning that produced them.

**Runtime dictionary lookup instead of a bundled dataset.**
Bundling would mean downloading and parsing a source file well over a hundred megabytes, maintaining an extraction script, and shipping several megabytes to a phone. The app is mobile-first. A word is looked up once and cached forever, so the runtime cost is paid a single time per word, and capture still works offline because the Forms are optional.

**Local-only storage with no backend.**
Single user, no sharing requirement. A backend would add authentication, hosting and cost for no benefit. Sync can be added later if multi-device ever becomes a real need. The tradeoff is the eviction risk, addressed in section 6.

**No English field on journal entries.**
A single Swedish field keeps writing undivided. The consequence, accepted knowingly: there is no dedicated place to record what you could not express. Pinned vocabulary partly covers this.

**No titles on journal entries.**
Naming a piece of writing before it exists is friction. The prompt and the first line carry enough identity. This is why multiple entries per day and date grouping matter.

**Plain textarea instead of a rich editor.**
Avoids a large dependency, behaves predictably on mobile keyboards, and Markdown preview on the view screen already covers the tables grammar notes need.

**Explicit links rather than wiki-style or tag-implied.**
Inline wiki links would require building an editor with autocomplete and link parsing. Shared tags remain available as a cross-cutting filter, but they are a weaker relationship than a deliberate link.

**No contextual detection of vocabulary while typing.**
Matching typed Swedish against stored entries means handling inflection. Getting from *skriver* back to *skriva* is a linguistic problem, not a string match. Pinning solves the same need with no ambiguity.

**Swedish-only prompts.**
Reading the prompt is itself practice. The cost is that beginner prompts must be authored carefully, which is a writing constraint rather than a code one.

**Rule-based auto-linking deferred, not rejected.**
A note declaring that it applies to all ett-nouns, automatically gathering matching words, is genuinely attractive. Typed vocabulary entries make it feasible. It is a rule engine, so it waits for a second phase.

---

## 9. Build order

Ordered so the app becomes genuinely usable as early as possible, and so nothing irreplaceable accumulates before backup exists.

1. **Storage layer and schema**, with tests
2. **Vocabulary end to end**, including dictionary auto-fill
3. **Persistent storage request and JSON export**, before anything worth losing accumulates
4. **Deploy**, so real use begins while the rest is built
5. **Grammar notes and linking**
6. **Journal with the prompt library**
7. **Split view and pinning**, which needs all three entity types to exist to mean anything
8. **Polish**: Markdown export, PWA install, dark mode

---

## 10. Attribution

Swedish lexical data from **SALDO**, Språkbanken, University of Gothenburg, licensed CC BY 4.0.

Method and structure inspired by *Fluentish: Language Learning Planner and Journal* by Jo Franco. No content from the book is reproduced; all prompts in this app are original.
