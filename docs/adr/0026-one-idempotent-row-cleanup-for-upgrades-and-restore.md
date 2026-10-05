# One idempotent row cleanup for upgrades and Restore

The Dexie upgrades and Restore each kept their own copy of the rules that repair old rows, and the Restore copy fell behind. It never linked cards to their Payment Category, never shifted Movement Dates to local midnight (ADR 0020), and left dates as text. The decision is that every row rule lives in one pure function, `cleanDataset` (`src/app/core/db/clean-dataset.ts`), which takes all five tables and returns them cleaned. Running it on data that is already clean changes nothing. The rules are:

- account kind
- legacy transfer amounts
- Period year
- locale-neutral month
- category type
- local-midnight Movement Dates
- the Payment Category link
- turning date text back into `Date`s
- stripping fields that are no longer used

The Dexie upgrade bodies for v2–v8 are deleted, though their `stores()` declarations stay. A single v9 upgrade runs the cleanup over the whole database and writes every row back with `bulkPut`. Restore runs the same cleanup on every snapshot, whatever its `schemaVersion`. The version is now used only to reject Backups from a newer app.

## Considered Options

- **Keep each version's upgrade body and call the shared rules from it:** this keeps the per-step history, but two callers would still decide separately which rules apply to which data. Restore's version gate is exactly how a v3 snapshot skipped the Payment Category backfill. Rejected.

## Consequences

- A future rule change edits `cleanDataset` and bumps the Dexie version so it reruns. No new upgrade body is written.
- ADR 0020's "one-time migration" now runs on every upgrade and every Restore. Rerunning it is safe because it shifts only UTC-midnight dates, and only in the restoring device's timezone.
- `year` is derived after dates are turned back into `Date`s and shifted, so a pre-ADR-0020 January 1st movement restored west of UTC keeps its year.
- With every card linked wherever a link is possible, Card Payment capture reads the stored link and never provisions a category. A card left unlinked because an Income category holds its payment name can't be paid until the card is renamed.
