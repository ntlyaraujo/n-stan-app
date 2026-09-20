/**
 * Identity and timestamps shared by every stored thing.
 *
 * Spec 3: "All entities carry an id and creation and update timestamps."
 */

export type Id = string

/** An ISO 8601 instant, e.g. `2026-09-20T18:04:11.325Z`. */
export type Timestamp = string

/**
 * A calendar day, `YYYY-MM-DD`, in local time.
 *
 * Used for a Journal Entry's Date, which is the day the entry belongs to and is
 * deliberately not an instant: it is chosen by you and never derived from
 * {@link Entity.createdAt}.
 */
export type CalendarDate = string

export interface Entity {
  readonly id: Id
  /** When the record was created. Recorded once and never edited. */
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}
