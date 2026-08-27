# Store the Period year explicitly on Movements

Transactions and Transfers each store a `year` alongside their `period` month name. The Dashboard year filter, the period Totals card, and the yearly averages all report against that stored year, not against the movement's date. The `date` remains the true calendar date and is treated as purely informational — for example, a movement dated 22 Dec that belongs to the January 2026 period is reported in January 2026.

This supersedes the simplification in ADR 0003 that the year was always implied as the current year. That assumption fails the moment a period and its date fall in different years, which happens every pay cycle that crosses a year boundary. Deriving the year from the date instead of storing it would make the reported figures depend on a calendar detail the user does not control, so the year of the Period is recorded on the movement itself, matching how the user already thinks in the spreadsheet.

New movements default their year to the current year. Pre-existing movements without a stored year fall back to their date's year so reporting keeps working: the Dexie upgrade backfills `year` from `date` on open, and restore normalizes old backups the same way. The cost is a small data migration and one extra number in the movement entry forms.
