// Placeholder screen. #37 (Journal entry editor) replaces the contents of this
// file, #38 adds the Prompt picker, and #42 wraps it in the responsive split
// layout with the side panel. Serves both /journal/new and /journal/:journalEntryId.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'

export function JournalEntryScreen() {
  return (
    <Screen title="Journal Entry">
      <NotBuiltYet ticket="#37">
        Writing and reading one Journal Entry, with its Date and optional Attached Prompt.
      </NotBuiltYet>
    </Screen>
  )
}
