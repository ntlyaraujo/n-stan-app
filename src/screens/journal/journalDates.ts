/**
 * Showing a Journal Entry's Date (#39).
 *
 * The Date is the day the entry belongs to — chosen by you, stored as
 * `YYYY-MM-DD` in local time, and deliberately not an instant. Everything here
 * parses it as a local day rather than through `new Date(string)`, which would
 * read it as UTC midnight and shift the day for anyone west of Greenwich.
 *
 * The creation timestamp is a separate thing and is never edited; it is shown
 * only as the time of day an entry was written, which is what tells two entries
 * on the same Date apart.
 */

import { today } from '../../data/index.ts'
import type { CalendarDate, Timestamp } from '../../domain/index.ts'

function localDay(date: CalendarDate): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

function toCalendarDate(day: Date): CalendarDate {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

function yesterday(): CalendarDate {
  const day = localDay(today())
  day.setDate(day.getDate() - 1)
  return toCalendarDate(day)
}

/** `Today` or `Yesterday`, when the Date is one of those. Otherwise nothing. */
export function relativeDayLabel(date: CalendarDate): string | undefined {
  if (date === today()) return 'Today'
  if (date === yesterday()) return 'Yesterday'
  return undefined
}

/** `Friday 20 September`, with the year added once the Date leaves this one. */
export function formatDate(date: CalendarDate): string {
  const day = localDay(date)
  return day.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(day.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  })
}

/** The heading one day of the journal list gets. */
export function dayHeading(date: CalendarDate): string {
  return relativeDayLabel(date) ?? formatDate(date)
}

/** The time of day an entry was written — never the Date, and never edited. */
export function formatTimeWritten(createdAt: Timestamp): string {
  return new Date(createdAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** When an entry was written, in full. Separate from its Date, and never edited. */
export function formatWrittenAt(createdAt: Timestamp): string {
  return new Date(createdAt).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}
