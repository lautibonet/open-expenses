# Open Expenses

A personal expense tracking app that replaces a manually maintained spreadsheet. Local-first, frontend-only, deployed as a static PWA with optional Google Drive backup.

## Language

**Transaction**:
A recorded movement of money classified as Income or Expense, linked to an account, a category, an amount, a date, a period (month name), and optional tags.
_Avoid_: Entry, record, line item

**Transfer**:
A movement of money between two of the user's own accounts. Structurally separate from Transactions; never counts as Income or Expense.
_Avoid_: Movement, internal transfer

**Account (CashAccount)**:
A named place where the user holds money, defined by a name, a currency, and an initial balance. Current balance is computed from initial balance plus all Transactions and Transfers.
_Avoid_: Wallet, bank account, source

**Category**:
A mandatory classification label applied to every Transaction, marked as either Income or Expense. Flat list, no hierarchy. Pre-populated with defaults during onboarding.
_Aavoid_: Type, group, classification

**Tag**:
A freeform, reusable text label applied optionally to Transactions for extra grouping. Multiple tags per transaction. Extracted from existing transactions (no separate table).
_Avoid_: Label, keyword, marker

**Period**:
A month name (January through December) assigned to a Transaction or Transfer to group it for reporting. Not a separate entity — a text field on the movement. Year is always implied as the current year.
_Avoid_: Cycle, fiscal period, date range

**Base Currency**:
The single currency in which all Dashboard totals and averages are reported. Set during onboarding. Accounts may hold different currencies; amounts are converted using confirmed exchange rates.
_Aavoid_: Report currency, display currency

**Exchange Rate**:
The conversion factor between a Transaction's account currency and the base currency. Fetched from Frankfurter (ECB rates), user-confirmed or manually overridden per Transaction.
_Avoid_: Conversion rate, FX rate

**Movement**:
The unified display of Transactions and Transfers in a single chronological list. The Movements tab shows both types interleaved by date.
_Aavoid_: Feed, timeline, history

**Dashboard**:
A read-only summary screen showing period totals, per-category expense breakdown, yearly averages, and per-account balances (current and period-end).
_Avoid_: Stats, overview, summary page

**Onboarding**:
The first-run flow that collects base currency, initial accounts, and initial categories before the app is usable.
_Avoid_: Setup, wizard, first-time flow
