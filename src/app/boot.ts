/**
 * Everything that runs once, at app start, before the first render matters.
 *
 * This file exists so that tickets needing first-run work each add one line here
 * and keep their actual logic in their own module. Nothing heavy belongs inline.
 *
 * Boot must never block the UI: a failure here is reported and swallowed, because
 * not being able to seed Prompts or claim persistent storage is not a reason to
 * show the user a blank screen.
 */

import { requestPersistentStorage } from '../backup/persistentStorage.ts'
import { seedBuiltInPrompts } from '../data/index.ts'

export async function boot(): Promise<void> {
  await Promise.allSettled([
    // Built-in Prompts are reseeded on every start. Seeding preserves your hidden
    // choices and never touches a Custom Prompt, so a revised set can ship later.
    seedBuiltInPrompts(),

    // Ask the browser not to evict the database. Declined or unsupported is a
    // normal outcome, not a failure: see `src/backup/persistentStorage.ts` (#23).
    requestPersistentStorage(),
  ]).then(reportFailures)
}

function reportFailures(results: PromiseSettledResult<unknown>[]): void {
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Boot step failed:', result.reason)
    }
  }
}
