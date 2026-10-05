# Delete returns a plan; refusal is a result, not an error

Settings ran three copies of the Delete flow (ADR 0018), and they had drifted apart. A card's delete returned its refusal as a plan (ADR 0024), while account and category deletes threw `TranslationError` and Settings caught it by matching the message key. Only the card flow dropped a plan that arrived after the user had moved on. The copies also failed to close each other, so an account confirm and a card confirm could be open at the same time. The decision has two parts:

- **Every deletion answers with a plan.** `planDeletion(id)` and `delete(id)` return a `DeletionPlan`: `{ kind: 'refused' } | { kind: 'proceed' }`, with the card adding its paired-category payload. `delete` decides by the same plan again inside its Dexie transaction, so a movement recorded since the confirm step refuses the delete instead of failing it.
- **Settings runs one delete flow with a single slot for the whole page.** At most one row, of any kind, is confirming or refused at a time, and a stale plan is dropped for every kind.

This deliberately narrows ADR 0012: services still throw translation keys for *errors* (e.g. `errors.accountNotFound`). Refusal under delete-if-unused is not an error, though. It is an expected answer to "can this go?", and callers branch on it.

## Considered Options

- **Keep the throws and convert them to a refusal at the Settings boundary:** this leaves the services untouched, but it keeps matching on message keys and the check-then-delete race in the account and category services. Rejected.
- **One flow instance per row, or per list:** this keeps each row self-contained, but the rows would then have to coordinate to stay mutually exclusive, which is exactly what the three copies got wrong. Rejected.

## Consequences

- `accountService.delete` and `planDeletion` hand Credit Cards over to the Payment Category module, so they return `CardDeletionPlan` for a card. The Settings card row calls the Payment Category module directly.
- Refusal copy, "Deactivate instead", the paired-category warning, and the "category kept" notice stay with each row. The flow only knows which row is confirming or refused, and with which plan.
