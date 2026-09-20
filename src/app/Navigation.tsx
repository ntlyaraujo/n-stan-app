import { NavLink } from 'react-router'
import type { ComponentType, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function iconBase(props: IconProps) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...props,
  }
}

function JournalIcon(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M5 17.5h14" />
      <path d="M9 7.5h6M9 11h6" />
    </svg>
  )
}

function VocabularyIcon(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
      <path d="M11 4h2v16h-2z" />
    </svg>
  )
}

function GrammarIcon(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 18 9.5 5l5.5 13" />
      <path d="M6 14h7" />
      <path d="M17.5 10.5h2.5v7.5" />
    </svg>
  )
}

function SettingsIcon(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </svg>
  )
}

type Section = {
  to: string
  label: string
  Icon: ComponentType<IconProps>
}

/**
 * The three sections of the app, plus Settings. There is no dashboard: the
 * planner half of the method is out of scope (spec section 8), so there would
 * be nothing for one to show.
 */
const SECTIONS: Section[] = [
  { to: '/journal', label: 'Journal', Icon: JournalIcon },
  { to: '/vocabulary', label: 'Vocabulary', Icon: VocabularyIcon },
  { to: '/grammar', label: 'Grammar', Icon: GrammarIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

function railClasses(isActive: boolean) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    FOCUS,
    isActive
      ? 'bg-accent-soft text-accent'
      : 'text-text-muted hover:bg-surface-sunken hover:text-text',
  ].join(' ')
}

function tabClasses(isActive: boolean) {
  return [
    'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[0.6875rem] font-medium transition-colors',
    FOCUS,
    isActive ? 'text-accent' : 'text-text-muted',
  ].join(' ')
}

/**
 * One navigation, two shapes: a bottom tab bar on a phone, a side rail from the
 * `md` breakpoint up. Both render the same links, so the active section stays
 * in sync across a resize.
 */
export function Navigation({ variant }: { variant: 'rail' | 'tabs' }) {
  if (variant === 'rail') {
    return (
      <nav
        aria-label="Sections"
        className="hidden shrink-0 border-r border-border bg-surface-raised md:flex md:w-56 md:flex-col md:gap-1 md:p-3"
      >
        <p className="px-3 pb-3 pt-2 text-sm font-semibold tracking-tight text-text">n-stan-app</p>
        {SECTIONS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => railClasses(isActive)}>
            <Icon className="size-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    )
  }

  return (
    <nav
      aria-label="Sections"
      className="shrink-0 border-t border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch gap-1 px-2 py-1.5">
        {SECTIONS.map(({ to, label, Icon }) => (
          <li key={to} className="flex flex-1">
            <NavLink to={to} className={({ isActive }) => tabClasses(isActive)}>
              <Icon className="size-6" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
