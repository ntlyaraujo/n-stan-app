/**
 * How long a live search waits for the typing to settle before it asks storage
 * (spec 5).
 *
 * One number for all three lists. Short enough that the results feel like they
 * follow the keystrokes, long enough that a word typed at speed is one query
 * rather than one per letter.
 */
export const SEARCH_DEBOUNCE_MS = 200
