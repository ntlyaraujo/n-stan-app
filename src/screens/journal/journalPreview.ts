/**
 * What a Journal Entry looks like in a list (#39).
 *
 * An entry has no title, so its first non-blank line stands in for one —
 * `journalEntryPreview` in the data layer owns that rule. This is the rest of
 * the writing, shown under the preview so two entries written the same evening
 * can be told apart at a glance.
 */

/**
 * Everything after the preview line, collapsed onto one line for the card.
 *
 * Deliberately computed from the line the preview was taken from rather than by
 * searching the body for the preview text: an entry whose first line repeats
 * later in the writing must not have that later copy cut out instead.
 */
export function bodyAfterPreview(body: string): string {
  const lines = body.split('\n')
  const first = lines.findIndex((line) => line.trim() !== '')
  if (first === -1) return ''
  return lines
    .slice(first + 1)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim()
}
