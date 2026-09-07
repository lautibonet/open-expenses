# KPI row becomes one ledger-summary card

The Stats KPI row rendered three side-by-side cards (Income, Expenses, Net), which gave each figure only ~213px of the 800px column; a JetBrains Mono figure beyond ~11 characters overflowed the card and clipped digits. We replace the trio with a single full-width card of three striped lines — green Income, red Expenses, grey Net — whose year totals right-align into one tabular ledger column with the monthly average demoted beneath each figure and the Savings Rate as a footer line. The full column width makes any realistic amount in any locale fit without shrinking, and the shared card keeps the three figures visually attached for comparison, which the user judged the deciding property.

## Considered Options

- **Full-width row per KPI (three stacked cards):** maximum room per figure, but the user rejected it — separated cards read as detached from each other.
- **Keep the 3-across grid and shrink figures further before wrapping:** smallest diff, but it keeps the disliked behavior (a number breaking across lines) as a reachable edge case.
- **One ledger-summary card (chosen):** the figures form a single aligned ledger column; the wrap floor only fires on mobile, where `flex-wrap` drops an over-wide figure to its own full-width line instead of breaking it mid-number.

## Consequences

- The Net card's solid-ink inversion retires: inside a shared card a full-bleed inverted band would read as a hole in the page. Net's identity is carried by its position (last line) and the grey stripe; the Negative-Stays-Ink Rule already keeps its figures ink at every sign.
- The #111 stacked-KPI-gap decision (single-column grid with `--space-lg` row gap) is obsolete: the card participates in the page's normal card rhythm via the shared `.card` margin.
- The card's own padding drops to 0 so the direction stripes touch the card edge; the rows carry the 1rem gutter — the one exception to the 1rem card-padding spec.
- The scope label renders once in a caps header over the ledger instead of three times inside the cards.
- The `FitTextDirective` shrink-to-fit stays applied as a silent safety net; the `overflow-wrap: anywhere` floor remains the mathematical last resort.
