/**
 * The pure rules behind the journal list (#39).
 *
 * Component tests are out of scope (spec section 7), but the two derivations
 * these screens make are not component behaviour: which day an entry is filed
 * under, and what stands in for the title it does not have. A silent bug in
 * either misfiles somebody's writing, so both are pinned here.
 */

import { describe, expect, it } from 'vitest'
import { today } from '../../data/index.ts'
import type { CalendarDate } from '../../domain/index.ts'
import {
  dayHeading,
  formatDate,
  formatTimeWritten,
  formatWrittenAt,
  relativeDayLabel,
} from './journalDates.ts'
import { bodyAfterPreview } from './journalPreview.ts'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function daysFromToday(offset: number): CalendarDate {
  const day = new Date()
  day.setDate(day.getDate() + offset)
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

describe('the day a Journal Entry is filed under', () => {
  it('names today and yesterday, and nothing else', () => {
    expect(relativeDayLabel(today())).toBe('Today')
    expect(relativeDayLabel(daysFromToday(-1))).toBe('Yesterday')
    expect(relativeDayLabel(daysFromToday(-2))).toBeUndefined()
    expect(relativeDayLabel(daysFromToday(1))).toBeUndefined()
  })

  it('crosses a month boundary backwards rather than subtracting from the day number', () => {
    // 1 March is the case a naive `date - 1` gets wrong. Whatever today is, the
    // day before it is a real Date and is labelled Yesterday.
    expect(dayHeading(daysFromToday(-1))).toBe('Yesterday')
  })

  it('reads a Date as a local day, never as UTC midnight', () => {
    // Parsed as UTC, `2026-01-01` is 31 December for anyone west of Greenwich —
    // an entry silently filed under the wrong day. This is that regression.
    expect(formatDate('2026-01-01')).toContain('1 January')
    expect(formatDate('2026-01-01')).toContain('Thursday')
    expect(formatDate('2025-12-31')).toContain('31 December')
  })

  it('heads a day with its relative label when it has one, and its date otherwise', () => {
    expect(dayHeading(today())).toBe('Today')
    expect(dayHeading('2026-03-15')).toContain('Sunday 15 March')
  })

  it('adds the year only once the Date leaves the current one', () => {
    const thisYear = new Date().getFullYear()
    expect(formatDate(`${thisYear}-06-01`)).not.toContain(String(thisYear))
    expect(formatDate(`${thisYear + 1}-06-01`)).toContain(String(thisYear + 1))
  })
})

describe('when an entry was written', () => {
  it('is a time of day, kept apart from the Date', () => {
    expect(formatTimeWritten('2026-09-20T18:04:11.325Z')).toMatch(/^\d{2}:\d{2}$/)
    expect(formatWrittenAt('2026-09-20T18:04:11.325Z')).toContain('September')
  })
})

describe('what stands in for the title an entry does not have', () => {
  it('shows the writing that follows the first line', () => {
    expect(bodyAfterPreview('Idag gick jag ut.\nSedan lagade jag mat.')).toBe(
      'Sedan lagade jag mat.',
    )
  })

  it('skips the blank lines above the first line, as the preview does', () => {
    expect(bodyAfterPreview('\n\n  Första raden\nAndra raden')).toBe('Andra raden')
  })

  it('has nothing to show for a single line, or for no writing at all', () => {
    expect(bodyAfterPreview('Bara en rad')).toBe('')
    expect(bodyAfterPreview('')).toBe('')
    expect(bodyAfterPreview('   \n\n  ')).toBe('')
  })

  it('cuts the first line, not a later copy of the same words', () => {
    expect(bodyAfterPreview('Hej\nHej igen\nHej')).toBe('Hej igen Hej')
  })

  it('collapses the rest onto one line', () => {
    expect(bodyAfterPreview('Rad ett\nRad två\n\nRad tre')).toBe('Rad två Rad tre')
  })
})
