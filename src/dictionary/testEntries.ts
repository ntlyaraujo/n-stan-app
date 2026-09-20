/**
 * Pull one recorded SALDO entry out of a recorded response, by lemgram.
 *
 * Test support only: it runs the fixture through the same `parseKarpResponse`
 * the client uses, so a fixture that stops matching the wire types fails here
 * rather than being silently reshaped by a cast.
 */

import { parseKarpResponse, type SaldomEntry } from './karp.ts'

export function entryOf(fixture: unknown, lemgram: string): SaldomEntry {
  const response = parseKarpResponse(fixture)
  if (response === undefined) throw new Error('Fixture is not a Karp response')
  const entry = response.hits.find((hit) => hit.entry.lemgram === lemgram)?.entry
  if (entry === undefined) throw new Error(`Fixture has no entry ${lemgram}`)
  return entry
}
