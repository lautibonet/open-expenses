# Locale-neutral storage for periods and category types

The database stores Period as an integer month number (1–12, January = 1) and category type as lowercase codes (`income`/`expense`) instead of the English display strings ("January", "Income"/"Expense") that were stored before. Month names and Income/Expense labels are translated for display at render time, in the active Language.

## Context

Multi-language support (ADR on Language foundation) made it possible for a user to switch the app to Spanish. As long as the database stored the English month names and capitalized category types, the stored values were English display strings: every screen that filtered, grouped, or labeled by Period or category type had to know the English vocabulary, and translated display would have required mapping back and forth between languages at every read. Data written by a future non-English flow would also have corrupted Scope filtering.

Storing display strings made the storage layer locale-sensitive: the "spelling" of a month changed its meaning.

## Decision

- **Period** is stored as an integer 1–12 on Transactions and Transfers. January = 1. Scope filters, grouping, and averages compare integers; translation to the active Language happens only at render time.
- **Category type** is stored as the lowercase codes `income`/`expense`. A runtime guard (`isCategoryType`) classifies unknown values explicitly instead of letting them silently fall into the Expense branch.
- **Backup snapshots** carry a `schemaVersion` field (current: 2). Legacy snapshots (version 1, no field) are migrated in memory on Restore; snapshots from a newer schema version are rejected with a clear "update the app first" message.
- **One-time migration**: a Dexie schema version bump (v4 → v5) converts existing rows in place. Rows with unrecognizable period strings are left untouched — they remain invisible to Scope filters, matching the behavior they already had.

## Consequences and trade-offs

- Display must translate: every place that shows a Period or category type needs a translation key (`month.N`, `type.income`/`type.expense`) rather than reading the stored value directly. This is the cost of the decision, paid consistently at render time.
- Unrecognized period strings survive migration as opaque values. They are preserved rather than destroyed, but they do not participate in Scope filters or month pickers.
- Snapshot schema versioning introduces a compatibility contract: old apps cannot read new snapshots (they would see the field and could reject), and new apps must keep migrating all older versions in `migrateSnapshotToCurrent`. Version 1 snapshots are converted in memory, so users restoring an old Backup never need a two-step upgrade.

The alternative — keeping English names in storage and translating at the display boundary via a name-lookup table — was rejected: it keeps the storage locale-sensitive, requires a lossy mapping table for every additional language, and breaks the moment any writer stores a non-English name.

Supersedes the storage-format aspect of ADR 0003 (Periods as a text field): Periods are still a field on the movement, not an entity, but the field now holds an integer month number instead of a month name.
