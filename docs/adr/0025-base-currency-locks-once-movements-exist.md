# Base Currency locks once movements exist

Every stored conversion — a Transaction's `baseCurrencyAmount`, its `exchangeRate` — is expressed in the Base Currency active when the movement was recorded. Changing the Base Currency afterwards silently reinterprets that history: a foreign Transaction's stored base amount keeps the old currency's figure but is summed as the new one, and Transactions on Accounts in the old Base Currency, which carry no stored conversion, become unconverted face amounts. Nothing at read time can repair it without historical cross-rates per date. The decision: the Base Currency is changeable only while no Transaction or Transfer exists; after that, Settings shows it read-only with a one-line explanation, and the profile service refuses the change with a translated error. This mirrors the rule ADR 0022 set for an Account's currency.

## Considered Options

- **Read-only right after Onboarding:** equally safe, but a wrong pick at Onboarding could then only be undone by Erase, which also discards the Accounts and Categories. Locking on the first movement keeps the mistake cheap to fix while it is still harmless.
- **Keep it editable and re-convert stored amounts:** needs a historical rate between the old and new Base Currency for every movement date, and reopens ADR 0005's stored-conversion model. Rejected.

## Consequences

- The lock itself ships with #191; until then the Base Currency stays editable.
- Restore is unaffected: it overwrites the Base Currency together with the whole dataset, so the two stay consistent.
- Data recorded before the lock shipped may already mix Base Currencies. The cash-basis totals mitigate the common case by counting a movement on an Account already in the Base Currency at its face amount; foreign movements stored under an older Base Currency stay stale.
