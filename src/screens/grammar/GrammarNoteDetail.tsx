// Placeholder screen. #30 (Markdown rendering on view) replaces the contents of
// this file; #34 adds the delete warning showing what loses its link.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'

export function GrammarNoteDetail() {
  return (
    <Screen title="Grammar Note">
      <NotBuiltYet ticket="#30">
        One Grammar Note, its Markdown rendered, with the Vocabulary Entries it References.
      </NotBuiltYet>
    </Screen>
  )
}
