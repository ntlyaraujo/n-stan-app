import { Link } from 'react-router'
import { Screen } from '../components/Screen.tsx'

export function NotFound() {
  return (
    <Screen title="Nothing here" description="That address does not match a screen in this app.">
      <Link
        to="/journal"
        className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Go to the Journal
      </Link>
    </Screen>
  )
}
