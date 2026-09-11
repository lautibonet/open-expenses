# Credit cards are accounts, and card spending is counted when the statement is paid

A credit card is modeled as a second kind of Account (`cash` | `credit-card`), not as its own entity: it carries a Linked Account, an optional Limit, and its own currency (defaulted from the Linked Account), and it reuses every existing mechanism — purchases are ordinary Transactions whose account is the card, payments are ordinary Transfers into it, and the debt is simply the card's negative balance, which the balance list already paints red (ADR 0021). A separate CreditCard entity with its own purchase and payment movement types was rejected: it would duplicate the derived-balance machinery, the period predicates, and the reporting rules for no modeling gain.

Card spending follows the owner's cash-basis philosophy: Expenses measure money that left a Cash Account, not credit that was consumed. Therefore a Transaction on a card account never counts as Income or Expense, and the Expense is the settlement — a Transfer from a Cash Account into a Credit Card (a Card Payment) counts as an Expense in the Income/Expenses/Net totals, in the Period of the payment. Every other Transfer kind (Cash to Cash, Card to Cash, Card to Card) never counts. This amends ADR 0002's "Transfers never count as Income or Expense" with a single targeted exception; the Income and Expenses totals and Net are thereby cash-basis figures.

The category graph counts spending, not cash: every purchase — cash or credit — appears under its real category, each bar split into what was paid with cash and what with credit, while the Card Payment's category is excluded from the graph so nothing double counts. The totals and the graph therefore measure different things and may disagree within a Period (and wherever debt is carried); they agree once every card is fully settled.

## Considered options

- **Separate CreditCard entity + "card purchase" and "card payment" movement types** — rejected: duplicates balances, periods, and reporting machinery, while the settlement semantics would still have to be designed from scratch.
- **The spreadsheet's income-offset trick** (record the purchase as an Expense plus an offsetting "credit received" Income) — rejected: the offsetting income must live on some account, and every placement poisons something — on the card it erases the tracked debt; on a bank account it fabricates a balance that the settlement transfers then consume, leaving the app permanently wrong by exactly the financed amount. It only ever worked on paper because no liability balance was being reconciled.
- **Statement-timing for installments** (record each cuota as an Expense when the statement bills it) — rejected: the upfront debt commitment becomes invisible to the card balance and the Limit until billed, and the purchase event leaves no trace.
- **Accrual everywhere** (Expense at purchase, payment never an Expense) — rejected: a financed purchase destroys the purchase month's Net, and monthly Net is the owner's savings KPI.

## Consequences

- A card account may start with debt: its initial balance is unconstrained (typically negative), while Cash Accounts keep the non-negative rule.
- Card Payments carry a required, Expense-type category created with consent when the card is created (e.g. "Visa payment" / "Pago Visa"), pre-filled deterministically in the Transfer Form; it labels the payment but never reaches the category graph.
- A refund recorded on a card counts nowhere: it cancels debt, and the smaller later statement carries the correction into Expenses through a smaller Card Payment.
- Interest and fees are never recorded separately — they ride inside the Statement total and reach Expenses through the Card Payment.
- A card purchase can exceed the Limit: that warns inline, never blocks.
- The movements list shows card purchases with their real category even though they do not count as Expenses; their stripe treatment, the two-tone graph bars, the form hints, and the used-of-limit caption are settled in the UI pass (stripe treatment settled by ADR 0023: the red stripe stays, a Card badge is added).
- Backup schema version bumps to carry the account kind and the card's extra fields; Erase and Backup/Restore need no other changes.
