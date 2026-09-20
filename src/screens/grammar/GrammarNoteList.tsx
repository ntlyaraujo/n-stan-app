// Placeholder screen. #31 (Grammar note list with search and tag filter)
// replaces the contents of this file.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'

export function GrammarNoteList() {
  return (
    <Screen title="Grammar" description="The rules you have written down for yourself.">
      <NotBuiltYet ticket="#31">
        The Grammar Note list, with search and a Tag filter.
      </NotBuiltYet>
    </Screen>
  )
}
