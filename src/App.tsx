import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './app/AppLayout.tsx'
import { NotFound } from './app/NotFound.tsx'
import { JournalList } from './screens/journal/JournalList.tsx'
import { JournalEntryScreen } from './screens/journal/JournalEntryScreen.tsx'
import { VocabularyList } from './screens/vocabulary/VocabularyList.tsx'
import { VocabularyCaptureForm } from './screens/vocabulary/VocabularyCaptureForm.tsx'
import { VocabularyEntryDetail } from './screens/vocabulary/VocabularyEntryDetail.tsx'
import { GrammarNoteList } from './screens/grammar/GrammarNoteList.tsx'
import { GrammarNoteEditor } from './screens/grammar/GrammarNoteEditor.tsx'
import { GrammarNoteDetail } from './screens/grammar/GrammarNoteDetail.tsx'
import { SettingsScreen } from './screens/settings/SettingsScreen.tsx'

/**
 * Every route in the app (#16).
 *
 * The screens are placeholders that later tickets fill in, but the routes and
 * the files behind them are settled now, so a ticket that builds a screen edits
 * only its own file and never this one.
 *
 * The Journal is the landing screen (spec section 7). There is no dashboard.
 *
 * `basename` follows Vite's `base`, so deploying under a subpath (#27) is a
 * config change rather than a code change. A static host serving this app needs
 * a catch-all rewrite to index.html; otherwise a deep link 404s before React
 * ever runs.
 */
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/journal" replace />} />

          <Route path="journal">
            <Route index element={<JournalList />} />
            <Route path="new" element={<JournalEntryScreen />} />
            <Route path=":journalEntryId" element={<JournalEntryScreen />} />
          </Route>

          <Route path="vocabulary">
            <Route index element={<VocabularyList />} />
            <Route path="new" element={<VocabularyCaptureForm />} />
            <Route path=":vocabularyEntryId" element={<VocabularyEntryDetail />} />
            <Route path=":vocabularyEntryId/edit" element={<VocabularyCaptureForm />} />
          </Route>

          <Route path="grammar">
            <Route index element={<GrammarNoteList />} />
            <Route path="new" element={<GrammarNoteEditor />} />
            <Route path=":grammarNoteId" element={<GrammarNoteDetail />} />
            <Route path=":grammarNoteId/edit" element={<GrammarNoteEditor />} />
          </Route>

          <Route path="settings" element={<SettingsScreen />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
