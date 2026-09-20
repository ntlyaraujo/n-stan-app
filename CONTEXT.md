# n-stan-app

A personal Swedish practice app built around one loop: a word is captured, used in
writing, then reviewed through what it is linked to. This glossary fixes the language
for that loop.

## Language

### Lexical

**Vocabulary Entry**:
One captured word or expression, typed by Part of Speech. Always qualified; bare "entry"
means a Journal Entry.
_Avoid_: entry, word, item, term, lexeme, card

**Lemma**:
The form of a Vocabulary Entry you would look it up under. A Lemma identifies a word to
a reader, not to the app: two entries may share one (*bok* the book, *bok* the beech).
_Avoid_: base form, headword, root, dictionary form

**Part of Speech**:
The category a Vocabulary Entry is typed by: noun, verb, adjective, adverb, phrase or
other. It determines which Forms exist.
_Avoid_: word type, category, class, POS

**Form**:
One inflected shape of a Lemma, such as *böckerna* or *talade*. A Form is a domain
concept, not a text input: say "the definite plural Form", never "the form field".
_Avoid_: form field, inflection field, variant, conjugation (as a noun)

**Paradigm**:
The complete set of Forms a Part of Speech requires: four for a noun, four for a verb,
three for an adjective, none for an adverb, phrase or other.
_Avoid_: table, inflection set, declension

**Gender**:
Whether a noun takes *en* or *ett*. Those two are the values themselves, everywhere.
_Avoid_: utrum, neutrum, common, neuter, article

**Conjugation Group**:
Which Swedish verb group a verb inflects by. Derived best-effort from the Dictionary and
always correctable by hand.
_Avoid_: verb class, conjugation, group (bare)

**Complete**:
A Vocabulary Entry every Form of whose Paradigm has a value. Derived, never stored. A
Part of Speech with an empty Paradigm is therefore always Complete.
_Avoid_: completeness flag, filled in, done, finished

### Dictionary

**Dictionary**:
The external lexical authority that supplies Forms (SALDO, from Språkbanken). Singular
and fixed; the app has one.
_Avoid_: API, lexicon, source, provider

**Lookup**:
One attempt to read a Lemma from the Dictionary. Its outcome — never attempted, filled,
not found, deferred — is what decides whether to try again. Completeness never does.
_Avoid_: fetch, query, search, request

**Auto-fill**:
Writing the result of a Lookup into a Vocabulary Entry's Forms. Auto-fill prefills and
never locks: every Form stays editable afterwards.
_Avoid_: import, sync, populate, overwrite

### Writing

**Journal Entry**:
One piece of your own Swedish writing, carrying a date and no title. Identified to you by
its date and first line.
_Avoid_: entry (when ambiguous), post, log, note, draft

**Grammar Note**:
A titled Markdown explanation of a rule, which may reference vocabulary. Always
qualified: bare "note" is ambiguous.
_Avoid_: note, rule, article, doc

**Date**:
The day a Journal Entry belongs to, chosen by you and defaulting to the day you wrote it.
Distinct from when the entry was created, which is recorded separately and never edited.
_Avoid_: created at, timestamp, written on, day

**Prompt**:
A Swedish-language writing suggestion, levelled beginner, intermediate or advanced.
Prompts are suggestions, never assignments: a Journal Entry may have none.
_Avoid_: question, exercise, mission, task

**Built-in Prompt**:
A Prompt that ships with the app. Read-only: you may hide one from the picker, but
editing it produces a Custom Prompt instead. This is what lets a shipped Prompt set be
revised later without discarding your wording.
_Avoid_: default prompt, stock prompt, seed prompt, system prompt

**Custom Prompt**:
A Prompt you authored, including one that began as an edit of a Built-in Prompt. "Custom"
means written by you, never merely touched by you.
_Avoid_: user prompt, own prompt, personal prompt

**Attached**:
The relationship between a Journal Entry and its one optional Prompt. A Prompt is
attached; vocabulary and Grammar Notes are Pinned.
_Avoid_: linked, assigned, selected

### Connections

**Reference**:
A deliberate link from a Grammar Note to a Vocabulary Entry, created by picking the word
on the note.
_Avoid_: link (bare), association, relation

**Backlink**:
The same Reference seen from the Vocabulary Entry's side. Backlinks are shown, never
created directly.
_Avoid_: reverse link, inbound reference, mention

**Pin**:
A Vocabulary Entry or Grammar Note kept beside a Journal Entry while writing, which is
also the record that you practiced it. A Pin belongs to one Journal Entry and never
carries over to the next.
_Avoid_: working set, bookmark, favourite, starred, attached

**Tombstone**:
The Lemma or title a Pin keeps after the thing it pointed at is deleted. A Journal Entry's
record of what you practiced is history and must not change retroactively, so a Pin
survives as unlinked text rather than disappearing.
_Avoid_: dangling link, broken link, ghost, orphan

**Tag**:
A free-text label in one namespace shared by Vocabulary Entries, Grammar Notes and
Journal Entries. Tags match without regard to case, so *Verb tenses* and *verb tenses*
are one Tag, kept in the spelling first used. A Tag is a filter, deliberately weaker than
a Reference or a Pin.
_Avoid_: label, category, topic, keyword

**Unlink**:
Removing a Reference or a Pin while both things it joined survive. Deleting something
Unlinks it everywhere and never destroys what pointed at it: Grammar Notes lose a
Reference outright, Journal Entries keep a Tombstone.
_Avoid_: detach, cascade, orphan
