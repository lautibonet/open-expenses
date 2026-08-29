# Open Expenses

A personal expense tracking app that replaces a manually maintained spreadsheet. Local-first, frontend-only, deployed as a static PWA with optional Google Drive backup.

## Language

**Transaction**:
A recorded movement of money classified as Income or Expense, linked to an account, a category, an amount, a date, and a period (month name).
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

**Period**:
A calendar month (January through December) assigned to a Transaction or Transfer to group it for reporting, together with the year of the Period the movement belongs to. Months are stored locale-independently and displayed in the active Language. Not a separate entity — a month text field plus a `year` on the movement. Reporting (Stats year filter, period totals, yearly averages) uses the stored year, not the movement's date; dates are purely informational. New movements default to the current year; pre-existing movements without a stored year fall back to their date's year.
_Avoid_: Cycle, fiscal period, date range

**Scope**:
The reporting window chosen on the Stats and Movements screens: either a single Period (a month together with its year) or All Time. Filtering by Scope always uses the stored Period year, never the movement's date. Under All Time the month dimension disappears and only the year selector remains.
_Avoid_: Filter, range, timeframe, selection

**Base Currency**:
The single currency in which the Stats total balance and all period totals/averages are reported. Set during onboarding. Accounts may hold different currencies; amounts are converted using exchange rates recorded at transaction/transfer time.
_Avoid_: Report currency, display currency

**Exchange Rate**:
The conversion factor between two currencies. Fetched from Frankfurter v2 (ECB rates) via `/rate/{FROM}/{TO}` for single pairs or `/rates?base={FROM}&quotes={TO1,TO2}` for batches. User-confirmed or manually overridden per Transaction or Transfer.
_Avoid_: Conversion rate, FX rate

**Movement**:
The unified display of Transactions and Transfers in a single chronological list. Each row starts with a direction arrow: → for Income, ← for Expense, = for Transfer. Amounts are always positive; cross-currency items show both original and converted amounts (e.g. `$10.00 → €8.57`).
_Avoid_: Feed, timeline, history

**Direction Arrow**:
A visual indicator at the start of each Movement row. → (right arrow) for Income, ← (left arrow) for Expense, = (equals) for Transfer. Uses green/red color coding for Income/Expense respectively.
_Avoid_: Sign, prefix, indicator, direction glyph

**Quick Add**:
The compact capture form at the top of the Movements screen for recording a Transaction or Transfer in one step, without opening the full editor.
_Avoid_: Quick entry, mini form, inline add

**Stats** (formerly Dashboard):
A read-only summary screen showing a total balance in base currency (sum of all account balances, non-base converted using latest rate), period totals, per-category expense breakdown, yearly averages, and per-account balances (current and period-end). Reached via the `/dashboard` route.
_Avoid_: overview, summary page

**Language**:
The user's preferred display language (English or Spanish). Chosen during Onboarding, changeable in Settings, and included in a Backup so a Restore reproduces the original device's language. Governs all displayed words and the formatting of dates, numbers, and currency amounts.
_Avoid_: locale, i18n, translation setting

**Onboarding**:
The first-run flow that collects language, base currency, initial accounts, and initial categories before the app is usable. Its first step asks the preferred Language; the second asks whether to restore a Backup from a cloud provider or from an uploaded file, before the wizard itself runs. Restoring a Backup overwrites the chosen Language with the Backup's.
_Avoid_: Setup, wizard, first-time flow

**Backup**:
A user-initiated snapshot of the full dataset saved off-device, either to a cloud provider or downloaded as a file. Backups are never triggered automatically — the user starts a cloud backup by tapping the backup banner. _Avoid_: Sync, snapshot, export, autosave

**Backup Method**:
The destination of a cloud Backup — Google Drive today, with Dropbox and iCloud as future providers. Shown on the backup banner next to the last-backup time.
_Avoid_: Provider, cloud service, storage

**Restore**:
A user-initiated, full overwrite of local data from a prior Backup — from a cloud provider or an uploaded file. Restore replaces the entire local dataset and never triggers a new Backup.
_Avoid_: Recovery, import, rollback
