# Movement dates stored as local midnights

Movement dates are stored as `Date` values at local midnight of the picked calendar day — never as UTC midnights. Forms parse the date input with local-timezone construction (`new Date(year, month-1, day)`), and date-to-string round-trips (edit prefill, "today" default, exchange-rate queries) use local calendar getters instead of slicing `toISOString()`.

## Context

A tester in Argentina (UTC-3) recorded movements for September 1st and 2nd; the list showed them as August 31st and September 1st. Forms built dates with `new Date("YYYY-MM-DD")`, which JavaScript parses as **UTC midnight**, while every read path — Angular's `date` pipe, `Intl.DateTimeFormat`, day-grouping keys — renders in the **device's local timezone**. West of UTC, a UTC-midnight instant displays as the previous calendar day, so every user in a negative-offset timezone saw all their dates shifted back by one day. The same UTC-slicing also made the form's "today" default revert to yesterday after 21:00 local, and skewed exchange-rate queries after 21:00.

A movement date is a calendar day, not an instant in time (see the Movement Date term in CONTEXT.md): the time-of-day component is meaningless, but the day shown must be the day picked, on every device, in every timezone.

## Decision

- Writers convert the `YYYY-MM-DD` input string to a `Date` at **local midnight** of that day (`src/app/core/format/local-date.ts`). Readers that need the calendar day again derive it with local getters (`getFullYear`/`getMonth`/`getDate`), never `toISOString()`.
- The form's "today" default and the exchange-rate service's date parameter use the **local** calendar date.
- **One-time migration**: a Dexie schema version bump (v5 → v6) shifts stored UTC-midnight dates to local midnight of the same UTC calendar day (which is the day the user originally picked). Dates that already carry a time component are left untouched. The migration runs in the device's current timezone, so it is correct for users who have not moved timezones since creating their movements — accepted, since a stored `Date` carries no record of the zone it was written in.

## Consequences and trade-offs

- Dates display correctly in any timezone **as long as the device's timezone matches the writer's**: a user who flies from Argentina to Spain will see their dates correctly, but a Restore onto a device in a different zone than the Backup's writer shows that writer's days (which is the right answer — the days were picked there).
- The stored `Date` remains an instant, so comparisons and IndexedDB ordering keep working unchanged; only the convention about which instant represents a day changed.
- The alternative — storing timezone-neutral `YYYY-MM-DD` strings — was considered and rejected for now: it is the cleaner long-term model but touches the Dexie schema, every indexed query, both forms, backups, and all consumers, for no additional user-visible correctness beyond what local midnights already give. If cross-timezone sync ever becomes real, string storage can supersede this decision behind the same `local-date.ts` seam.
