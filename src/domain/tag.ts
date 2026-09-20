/**
 * Tag: a free-text label in one namespace shared by Vocabulary Entries, Grammar
 * Notes and Journal Entries.
 *
 * Tags match without regard to case, so *Verb tenses* and *verb tenses* are one
 * Tag, kept in the spelling first used.
 */

export type Tag = string

/**
 * The spelling a Tag is stored under: trimmed, inner whitespace collapsed, and
 * Unicode-normalised so that an *ä* typed as a combining diaeresis is the same
 * Tag as a precomposed one.
 *
 * Case is deliberately preserved — the first spelling used is the one kept.
 */
export function normaliseTag(raw: string): Tag {
  return raw.normalize('NFC').trim().replace(/\s+/gu, ' ')
}

/**
 * The key two Tags are compared by. Case-folded, so it is a matching key only —
 * never store it or show it.
 */
export function tagKey(tag: Tag): string {
  return normaliseTag(tag).toLowerCase()
}

export function tagsMatch(a: Tag, b: Tag): boolean {
  return tagKey(a) === tagKey(b)
}

/** Whether a set of Tags already contains one, matched without regard to case. */
export function hasTag(tags: readonly Tag[], tag: Tag): boolean {
  return tags.some((existing) => tagsMatch(existing, tag))
}

/**
 * Add a Tag to a set, keeping the spelling already in use when the Tag is
 * already there. Empty input is ignored.
 */
export function addTag(tags: readonly Tag[], raw: string): readonly Tag[] {
  const tag = normaliseTag(raw)
  if (tag === '' || hasTag(tags, tag)) return tags
  return [...tags, tag]
}

export function removeTag(tags: readonly Tag[], tag: Tag): readonly Tag[] {
  return tags.filter((existing) => !tagsMatch(existing, tag))
}
