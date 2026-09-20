// Placeholder screen. #39 (Journal list grouped by Date) replaces the contents
// of this file; the route in src/App.tsx already points here.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'

export function JournalList() {
  return (
    <Screen title="Journal" description="Your own Swedish writing, newest first.">
      <NotBuiltYet ticket="#39">
        The list of Journal Entries, grouped by Date, lands with the journal phase.
      </NotBuiltYet>
    </Screen>
  )
}
