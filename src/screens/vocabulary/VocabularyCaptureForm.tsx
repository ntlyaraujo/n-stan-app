// Placeholder screen. #20 (Vocabulary capture form) replaces the contents of
// this file, with Auto-fill from #17/#19 and the offline retry from #22.
// Serves both /vocabulary/new and /vocabulary/:vocabularyEntryId/edit.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'

export function VocabularyCaptureForm() {
  return (
    <Screen title="Capture a word">
      <NotBuiltYet ticket="#20">
        Capturing a Vocabulary Entry: Lemma, Part of Speech, the Forms of its Paradigm, and
        Dictionary Auto-fill.
      </NotBuiltYet>
    </Screen>
  )
}
