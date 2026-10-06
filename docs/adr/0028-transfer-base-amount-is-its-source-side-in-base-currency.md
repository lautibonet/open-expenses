# A Transfer's base amount is its source side in Base Currency

ADR 0005 gave every Transfer a `baseCurrencyAmount`, but `TransferService` filled it with the destination amount for a cross-currency Transfer and the source amount otherwise. That figure is in the Base Currency only by coincidence. With Base Currency USD, a EUR Cash Account paying €100 into a EUR Credit Card stored "100", so Expenses grew by $100 (#192). The per-account base balances behind the Stats Debt split (ADR 0013) read the same field for both legs and inherited the error. The total balance hid it, because the two legs cancel.

The decision: `baseCurrencyAmount` on every Transfer means the source side, the money that left the source Account, expressed in the Base Currency. It is derived when possible:

- source Account in the Base Currency → `sourceAmount`
- destination Account in the Base Currency → `destinationAmount`
- neither → `sourceAmount × baseExchangeRate`, a new stored field: a source→base Exchange Rate that the Transfer Form offers as a Suggested Rate and the user can override, shown only in this case

A Card Payment therefore counts in Expenses at the cash it spent, not at the debt it settled.

Existing rows are repaired by a `cleanDataset` rule (ADR 0026) against the profile's Base Currency, with a Dexie version bump. A row the rule cannot repair, where neither Account is in base and there is no `baseExchangeRate`, gets `baseCurrencyAmount: null`. Readers then count it at its face `sourceAmount`, and the conversion-warning strip flags it as unconverted, the same way it flags Transactions.

## Considered Options

- **Compute at read time and leave storage alone:** works whenever one Account is in the Base Currency, but leaves a field whose name lies, and still needs a rate when neither is. Rejected.
- **Fetch a source→base rate at read time:** breaks ADR 0013's rule that stored conversions are never replaced by fetched ones, and lets past Periods drift. Rejected.
- **Show the base rate only on Transfers that cross the cash/card boundary**, the only ones whose base amount moves a Stats figure: saves a field on rare Transfers, but splits the field's meaning by Transfer kind. Rejected.

## Consequences

- `baseCurrencyAmount` on Transfer becomes `number | null`, the same as on Transactions. `baseExchangeRate` exists only when neither Account is in the Base Currency, and its presence is what keeps the cleanup idempotent.
- Editing a Transfer re-derives its base amount on every save, as it already does for `destinationAmount`. An edit that moves it into the "neither in base" case asks for the base rate, and an edit that moves it out drops the stored `baseExchangeRate`.
- Movements rows keep showing `source → destination`. The base amount reaches only the totals and balances.
- `periodEndBaseAmount` uses the corrected figure for both legs, so the Debt and total-with-debt split on Stats agree with the Card Payments in Expenses.
- Rows recorded before the Base Currency lock (ADR 0025) under an older Base Currency are repaired against the current one. The cleanup cannot detect such rows, which is the same staleness ADR 0025 accepts for Transactions.
