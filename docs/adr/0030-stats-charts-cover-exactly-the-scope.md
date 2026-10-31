# Stats charts cover exactly the Scope

The Net chart and the balance strip on Stats show exactly the Scope's Periods, with the To Period emphasised. This amends ADR 0029, which charted the twelve Periods ending at the To Period and marked the Scope's Periods inside them: two Scopes sharing a To Period (Year to date and Last 3 in November) drew the same chart, so switching between them looked like nothing changed.

For a one-Period Scope both charts are left out: a single column compares nothing, and the KPI and Total Balance figures already cover that Period. A Scope longer than twelve Periods keeps the twelve-Period track width and scrolls sideways, opening on the To Period; a shorter one keeps the same track width, left-aligned, rather than stretching. When the Scope crosses a year boundary, each January is labelled with its year on a row of its own below the initials. The captions and the Total Balance figures stay on the To Period (ADR 0013).

## Considered Options

- **Keep charting the twelve Periods ending at the To Period and only mark the Scope.** Rejected: the user reads the charts as the Scope, and an unchanged chart after a Scope change reads as a bug.
- **Cap long Scopes at their last twelve Periods.** Rejected: the chart would silently stop covering the Scope.
- **Shrink tracks to fit any length.** Rejected on its own: past twelve Periods the tracks get too thin to read on a phone.
