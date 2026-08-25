# Periods as a text field, not an entity

Periods are a month name (January–December) stored as a text field on Transactions and Transfers, not a separate Period entity with its own table.

This was chosen because the user's pay-day boundary rule ("3rd business day before end of month") makes automated period assignment fragile, and the user already manually tags transactions with the correct month in their spreadsheet. A text field preserves this manual workflow without adding an entity that would need CRUD screens, period-transaction linking, and period-boundary computation.

The trade-off: no automated period engine, no "which period does this date belong to?" logic. The user picks the month from a dropdown. This is acceptable for personal use where the user is the sole data entry operator.
