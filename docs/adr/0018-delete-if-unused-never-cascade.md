# Delete if unused, never cascade

Accounts and Categories had no deletion at all — only soft Deactivation. We decided on a single "remove" action that branches on the data: an item with no movements (no Transaction or Transfer references it) is permanently Deleted behind an inline confirm; an item with movements is refused with an inline explanation of why, offering Deactivation as the fallback. There is no guard on deleting the last Account: Onboarding already permits continuing with zero accounts, so an empty ledger is a valid state.

We rejected cascade deletion — silently destroying the Transactions and Transfers that carry the user's financial history is the one mistake this app can never undo. Refusal with explanation keeps history intact and steers users to Deactivation, which hides the item without touching history.
