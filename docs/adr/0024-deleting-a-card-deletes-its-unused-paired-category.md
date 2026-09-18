# Deleting a card deletes its unused paired category

The Payment Category is provisioned unconditionally with the card, renamed with it, and hidden from every surface that picks categories for ordinary work (ADR 0022) — it is plumbing, part of the card rather than a classification the user curates. Card deletion therefore had a hole: deleting a card left its paired category behind, an orphaned plumbing entry only reachable through Settings. The decision: deleting a Credit Card also deletes its paired Payment Category, in the same transaction — but only when the category itself has no Transactions (deactivated categories included). A category that carries Transactions survives the card, and a page-level notice explains why; before deletion, the confirm step warns visibly that the payment category will be deleted, but only when the pre-check says it actually will; a dangling link (the category is already gone) is a silent no-op.

This is a targeted exception to ADR 0018's "never cascade", not a weakening of it: the paired category is not independent data the user curated — it was created with the card, renamed with the card, and never appears where ordinary categories are picked, so the user's classification history cannot live in it. The guard is deliberately transactions-only (a Category "has movements" when a Transaction references it): Transfers wear the payment category only as a label, and a card being deleted has no movements anyway, so counting Transfers would change nothing except obscure the rule. Where the guard is ambiguous, the category service's own predicate is renamed to say what it counts (`hasTransactions`).

We rejected the alternatives. Deleting the paired category unconditionally would cascade into a category the user's Transactions still reference — the one mistake this app can never undo, for no payoff. Keeping the category always would orphan plumbing that nothing else can reach, exactly the residue the paired lifecycle exists to avoid. Refusing to delete a card whose paired category has Transactions would hold an unused card hostage to a category state the ordinary UI makes nearly unreachable; the card goes, the category stays, and the notice explains why.

## Consequences

- The confirm step for a card shows the "payment category will be deleted too" warning only when the pre-check (`pairedCategoryDeletion`) says the category is linked, present, and unused; otherwise it shows the plain prompt.
- The paired deletion happens in the same transaction as the card's deletion: both vanish together or neither does.
- A paired category with Transactions — active or deactivated — survives, and Settings explains why with a page-level notice that names the category and offers Deactivation.
- A card whose payment category is already gone deletes without error.
- A Category's own delete-if-unused guard is unchanged by this decision: it counts Transactions only, and the service's method is named to say so.
