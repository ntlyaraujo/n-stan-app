// Placeholder screen. #29 (Grammar note editor) replaces the contents of this
// file; #32 adds the vocabulary picker. Serves both /grammar/new and
// /grammar/:grammarNoteId/edit.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'

export function GrammarNoteEditor() {
  return (
    <Screen title="Grammar Note">
      <NotBuiltYet ticket="#29">
        Writing a Grammar Note in Markdown, and the Vocabulary Entries it References.
      </NotBuiltYet>
    </Screen>
  )
}
