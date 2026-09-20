// Placeholder screen. #21 (Vocabulary list with search and filters) replaces the
// contents of this file.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'

export function VocabularyList() {
  return (
    <Screen title="Vocabulary" description="The words and expressions you have captured.">
      <NotBuiltYet ticket="#21">
        The Vocabulary Entry list, with search and filters by Part of Speech and Tag.
      </NotBuiltYet>
    </Screen>
  )
}
