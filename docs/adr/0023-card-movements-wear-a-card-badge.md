# Card movements wear a Card badge, and Card Payments show their category

A credit card is an Account (ADR 0022), so a card purchase arrives in the movements list as an ordinary expense Transaction and a Card Payment as an ordinary Transfer. Left alone, a card purchase is indistinguishable from a counted cash Expense — same red stripe, same category chip — which falsely suggests it was counted in the cash-basis Expenses. This settles the display decision ADR 0022 left open.

The 4px edge stripe encodes money *direction*, not cash-basis membership: green (income), red (expense), grey (transfer). It stays a three-colour grammar. A card purchase therefore **keeps its red expense stripe** — the direction is still money out — and gains a small outline **Card** badge beside its category chip. The badge is metadata, so it sits with the category, not on the stripe. A card refund wears the same badge on its green income stripe. A Card Payment (a Transfer into a credit card) shows its required Expense category as a chip, exactly as a Transaction does, with the `source → card` route demoted to a muted line beneath it.

## Considered options

- **A distinct stripe** (e.g. a hatched/patterned red reusing the category graph's credit texture) — rejected: at 4px the hatch cannot read, and it would introduce a fourth stripe treatment, breaking "the stripe is the movement type's only signal" and muddying the green/red/grey grammar. The credit texture stays a graph-only signal.
- **Leave it to the red stripe** — rejected: a counted cash Expense and a card purchase would look identical, the exact dishonesty this ticket exists to remove.

## Consequences

- A card-account Transaction announces "Card purchase" / "Card refund" to assistive technology instead of "Expense" / "Income", matching the visible badge.
- The Card Payment's category chip reuses the ledger's existing category-chip treatment; the route stays visible as context.
- The category graph keeps its own striped credit language for the cash/credit split (ADR 0022); the movement badge and the graph texture are independent signals that agree on meaning.
