# A Scope is a From → To run of Periods

A Scope is a run of consecutive Periods from a From Period to a To Period, possibly crossing a year boundary. A one-Period Scope is the From = To case and a whole year is January → December; there are no separate month and year kinds. Every scoped figure — the Movements list, Income, Expenses, and Net, the averages, the category breakdown — covers exactly the Scope's Periods on both screens. The motivating case was January: with Scopes confined to one Period year, "the last three months" could not be asked at all.

This drops the implicit year-to-period behaviour of Stats, where a single selected Period reported January through that Period. It is replaced by an explicit "Year to date" preset, which is also the Stats default Scope (January through the latest Period with movements). Keeping year-to-period as a special case of the one-Period Scope would have made Movements and Stats report different figures for the same Scope. The Movements "All" option becomes the "Whole year" preset. Presets (last 3 / 6 / 12 Periods, Year to date, Whole year) only fill in a From/To pair; they are not a kind of Scope.

## Considered Options

- **Keep month and year Scopes and add a third "custom range" kind.** Rejected: three kinds with three sets of rules (issues #194 and #216 already needed per-kind year-change rules), where one general shape covers all of them.
- **Rolling presets only, without a free From/To pair.** Rejected: cannot express an arbitrary run such as November → February.

## Consequences

- Stats balances stay period-end balances (ADR 0013), taken at the end of the To Period. The Stats charts show the twelve Periods ending at the To Period with the Scope's Periods marked, rather than January → December of one year.
- Averages still divide by the Scope's Periods with movements, not by its length, so a Scope reaching back before the first movement does not dilute them.
- The selectors always offer all twelve months and every year from the earliest with data, with no gaps. Changing a year keeps the month; picking a From after the To (or the reverse) moves the other end to match. The #194/#216 rule of landing on a year's latest Period with movements goes away.
- The Movements link becomes `?from=YYYY-MM&to=YYYY-MM`; the old `?period=&year=` links keep resolving.
