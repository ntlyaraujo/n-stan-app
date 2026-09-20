// Placeholder screen. #33 (Backlinks on vocabulary entries) replaces the
// contents of this file; #43 adds the Journal Entries that used the word.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'

export function VocabularyEntryDetail() {
  return (
    <Screen title="Vocabulary Entry">
      <NotBuiltYet ticket="#33">
        One Vocabulary Entry: its Paradigm, its Tags, and the Backlinks from Grammar Notes and
        Journal Entries.
      </NotBuiltYet>
    </Screen>
  )
}
