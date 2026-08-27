# Open Expenses

A personal expense tracking app that replaces a manually maintained spreadsheet. Local-first, frontend-only, deployed as a static PWA with optional Google Drive backup.

## Language

**Transaction**:
A recorded movement of money classified as Income or Expense, linked to an account, a category, an amount, a date, a period (month name), and optional tags.
_Avoid_: Entry, record, line item

**Transfer**:
A movement of money between two of the user's own accounts. Structurally separate from Transactions; never counts as Income or Expense. Stores `sourceAmount`, `destinationAmount`, `exchangeRate`, and `baseCurrencyAmount`. For same-currency transfers, `sourceAmount` equals `destinationAmount`.
_Avoid_: Movement, internal transfer

**Account (CashAccount)**:
A named place where the user holds money, defined by a name, a currency, and an initial balance. Current balance is computed from initial balance plus all Transactions and Transfers.
_Avoid_: Wallet, bank account, source

**Category**:
A mandatory classification label applied to every Transaction, marked as either Income or Expense. Flat list, no hierarchy. Pre-populated with defaults during onboarding.
_Avoid_: Type, group, classification

**Tag**:
A freeform, reusable text label applied optionally to Transactions for extra grouping. Multiple tags per transaction. Extracted from existing transactions (no separate table).
_Avoid_: Label, keyword, marker

**Period**:
A month name (January through December) assigned to a Transaction or Transfer to group it for reporting, together with the year of the Period the movement belongs to. Not a separate entity — a month text field plus a `year` on the movement. Reporting (Dashboard year filter, period totals, yearly averages) uses the stored year, not the movement's date; dates are purely informational. New movements default to the current year; pre-existing movements without a stored year fall back to their date's year.
_Avoid_: Cycle, fiscal period, date range

**Base Currency**:
The single currency in which the Dashboard total balance and all period totals/averages are reported. Set during onboarding. Accounts may hold different currencies; amounts are converted using exchange rates recorded at transaction/transfer time.
_Avoid_: Report currency, display currency

**Exchange Rate**:
The conversion factor between two currencies. Fetched from Frankfurter v2 (ECB rates) via `/rate/{FROM}/{TO}` for single pairs or `/rates?base={FROM}&quotes={TO1,TO2}` for batches. User-confirmed or manually overridden per Transaction or Transfer.
_Avoid_: Conversion rate, FX rate

**Movement**:
The unified display of Transactions and Transfers in a single chronological list. Each row starts with a direction arrow: → for Income, ← for Expense, = for Transfer. Amounts are always positive; cross-currency items show both original and converted amounts (e.g. `$10.00 → €8.57`).
_Avoid_: Feed, timeline, history

**Direction Arrow**:
A visual indicator at the start of each Movement row. → (right arrow) for Income, ← (left arrow) for Expense, = (equals) for Transfer. Uses green/red color coding for Income/Expense respectively.
_Avoid_: Sign, prefix, indicator

**Dashboard**:
A read-only summary screen showing a total balance in base currency (sum of all account balances, non-base converted using latest rate), period totals, per-category expense breakdown, yearly averages, and per-account balances (current and period-end).
_Avoid_: Stats, overview, summary page

**Onboarding**:
The first-run flow that collects base currency, initial accounts, and initial categories before the app is usable. Its first step asks whether to restore a Backup from a cloud provider or from an uploaded file, before the wizard itself runs.
_Avoid_: Setup, wizard, first-time flow

**Backup**:
A user-initiated snapshot of the full dataset saved off-device, either to a cloud provider or downloaded as a file. Backups are never triggered automatically — the user starts a cloud backup by tapping the backup banner. _Avoid_: Sync, snapshot, export, autosave

**Backup Method**:
The destination of a cloud Backup — Google Drive today, with Dropbox and iCloud as future providers. Shown on the backup banner next to the last-backup time.
_Avoid_: Provider, cloud service, storage

**Restore**:
A user-initiated, full overwrite of local data from a prior Backup — from a cloud provider or an uploaded file. Restore replaces the entire local dataset and never triggers a new Backup.
_Avoid_: Recovery, import, rollback
