# Pins keep their lemma when the word is deleted

A Journal Entry's Pins are its record of what you practiced, which makes them history
rather than a live index. Deleting a Vocabulary Entry therefore leaves each Pin holding
the Lemma it was made with as plain text instead of removing the Pin, because an entry
written in June must not quietly report two practiced words in September when it recorded
three. The alternative considered was archiving deleted words so their links keep
resolving: it preserves the same history, but adds an archived state that every list,
filter, picker and export has to know about, which is more than v1 should carry.

## Consequences

- A Pin has two shapes: one that resolves to a live Vocabulary Entry or Grammar Note, and
  one that is text only. Rendering, search and export each handle both.
- The Lemma is stored twice on purpose. It reads as denormalisation waiting to be cleaned
  up, and it is not.
- Capturing the same word again does not revive a Tombstone. A Lemma does not identify a
  Vocabulary Entry, so re-capture produces a new one and the old Journal Entry keeps its
  text.
