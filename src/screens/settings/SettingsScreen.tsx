// Settings and About.
//
// The attribution below is real and required (#28): keep it, and keep it
// reachable from the navigation. The stubbed sections belong to later tickets —
// #24 JSON export, #44 Markdown export, #25 JSON import, #26 export reminder,
// #23 persistent storage, #46 dark theme — each of which replaces its own
// placeholder block here rather than the whole file.
import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'
import { AttributionStatement } from '../../app/Attribution.tsx'

export function SettingsScreen() {
  return (
    <Screen title="Settings" description="Your data, how it looks, and where the words come from.">
      <div className="flex flex-col gap-4">
        <NotBuiltYet ticket="#24, #44">
          Export: a JSON backup that can be imported again, and a readable Markdown copy.
        </NotBuiltYet>
        <NotBuiltYet ticket="#25">
          Import: restoring from a JSON backup, validated before anything is written.
        </NotBuiltYet>
        <NotBuiltYet ticket="#46">Theme: light, dark, or follow the system.</NotBuiltYet>
        <AttributionStatement />
      </div>
    </Screen>
  )
}
