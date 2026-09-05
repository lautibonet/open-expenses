# Open Expenses

A personal expense tracking app that replaces a manually maintained spreadsheet. Local-first, frontend-only, deployed as a static PWA with optional Google Drive backup.

## Language

**Transaction**:
A recorded movement of money classified as Income or Expense, linked to an account, a category, an amount, a date, and a period (month number 1-12).
_Avoid_: Entry, record, line item

**Transfer**:
A movement of money between two of the user's own accounts. Structurally separate from Transactions; never counts as Income or Expense. Stores `sourceAmount`, `destinationAmount`, `exchangeRate`, and `baseCurrencyAmount`. For same-currency transfers, `sourceAmount` equals `destinationAmount`.
_Avoid_: Movement, internal transfer

**Account (CashAccount)**:
A named place where the user holds money, defined by a name, a currency, and an initial balance. Its balance is computed from the initial balance plus Transactions and Transfers up to a given point in time; on Stats it is reported as of the end of the Scope's Period.
_Avoid_: Wallet, bank account, source

**Category**:
A mandatory classification label applied to every Transaction, marked as either Income or Expense. Flat list, no hierarchy. Pre-populated with defaults during onboarding.
_Avoid_: Type, group, classification

**Period**:
A calendar month (January through December) assigned to a Transaction or Transfer to group it for reporting, together with the year of the Period the movement belongs to. Months are stored locale-independently and displayed in the active Language. Not a separate entity — a month text field plus a `year` on the movement. Reporting (Stats year filter, period totals, yearly averages) uses the stored year, not the movement's date; dates are purely informational. New movements default to the current year; pre-existing movements without a stored year fall back to their date's year.
_Avoid_: Cycle, fiscal period, date range

**Scope**:
The reporting window chosen on the Stats and Movements screens: a single Period (a month together with its year). Filtering by Scope always uses the stored Period year, never the movement's date. Aggregations that span multiple Periods are not narrowed to the Scope's month: the total and per-account balances are cumulative balances as of the end of the Scope's Period (initial balances plus every movement whose stored Period is at or before it), and the Income, Expenses, and Net totals and averages on Stats are year-to-period: January through the Scope's Period of the Scope's year. There is no All Time Scope: selecting the latest Period shows the all-time figure.
_Avoid_: Filter, range, timeframe, selection, All Time

**Base Currency**:
The single currency in which the Stats total balance and all period totals/averages are reported. Set during onboarding. Accounts may hold different currencies; amounts are converted using exchange rates recorded at transaction/transfer time.
_Avoid_: Report currency, display currency

**Exchange Rate**:
The conversion factor between two currencies. Fetched from Frankfurter v2 (ECB rates) via `/rate/{FROM}/{TO}` for single pairs or `/rates?base={FROM}&quotes={TO1,TO2}` for batches. User-confirmed or manually overridden per Transaction or Transfer.
_Avoid_: Conversion rate, FX rate

**Movement**:
The unified display of Transactions and Transfers in a single chronological list. Each row carries a colored edge stripe identifying its kind: green for Income, red for Expense, grey for Transfer. Amounts are always positive; cross-currency items show both original and converted amounts (e.g. `$10.00 → €8.57`).
_Avoid_: Feed, timeline, history

**Transaction Form**:
The Transaction capture form on the Movements screen — account, category, amount, note, date, and period shown all at once, with no compact/expanded distinction. Revealed by the New Transaction button, the sidebar capture action, or the mobile bottom nav's center capture slot; presents as a bottom sheet on mobile and inline on desktop. Used for both recording and editing a Transaction.
_Avoid_: Quick Add, quick entry, mini form, inline add, more options

**Transfer Form**:
The Transfer capture form on the Movements screen — source account, destination account, source and destination amounts, note, date, and period shown all at once. Revealed by the Add Transfer button; presents as a bottom sheet on mobile and inline on desktop, like the Transaction Form. Used for both recording and editing a Transfer.
_Avoid_: Transfer dialog, move-money form

**Net**:
Income minus Expenses aggregated over an aggregation window — a single Period or a whole year — reported in Base Currency. A positive Net means money kept; a negative Net means money overspent. The Savings Rate shown on Stats is Net divided by Income. Never a kind of Transaction or Transfer.
_Avoid_: profit, earnings, balance

**Stats** (formerly Dashboard):
A read-only summary screen showing a total balance in Base Currency as of the end of the Scope's Period (per-account balances accumulated from initial balances and movements at or before that Period; cross-currency movements counted at their stored conversions), year-to-period totals and monthly averages of Income, Expenses, and Net (January through the Scope's Period of the Scope's year), per-category expense breakdown, and per-account balances as of the end of the Scope's Period. Reached via the `/stats` route (legacy `/dashboard` redirects here).
_Avoid_: overview, summary page

**Language**:
The user's preferred display language (English or Spanish). Chosen during Onboarding, changeable in Settings, and included in a Backup so a Restore reproduces the original device's language. Governs all displayed words except the App Name, and the formatting of dates, numbers, and currency amounts.
_Avoid_: locale, i18n, translation setting

**App Name**:
"Open Expenses" — the product's brand name. Rendered identically in every Language and never translated; the sole exception to Language governing all displayed words.
_Avoid_: localized name, translated title

**Landing**:
The Public Page that introduces the product, with a single call to action that opens the app and a link to the Privacy page. Reached deliberately at the `/landing` route — via the app footer, the Privacy page, or a shared URL — and never as the default entry: the root URL enters the app directly. Opening the app from the Landing follows the same entry contract as any other navigation: an un-onboarded user is sent to Onboarding.
_Avoid_: home page, marketing page, poster

**Public Page**:
A screen reachable without completing Onboarding — the Landing and the Privacy page. The complement of the app's shell screens (Movements, Stats, Settings), which are gated by the Onboarding entry contract.
_Avoid_: public route, open page, unauthenticated page

**Onboarding**:
The first-run flow that collects language, base currency, initial accounts, and initial categories before the app is usable. Its first step asks the preferred Language; the second asks whether to restore a Backup from a cloud provider or from an uploaded file, before the wizard itself runs. Steps after the first carry a Back control; going back only navigates — it never undoes completed work (a completed Restore, the chosen Language, staged accounts and categories all persist). Restoring a Backup overwrites the chosen Language with the Backup's.
_Avoid_: Setup, wizard, first-time flow

**Backup**:
A user-initiated snapshot of the full dataset saved off-device, either to a cloud provider or downloaded as a file. Backups are never triggered automatically — the user starts a cloud backup from the sidebar Backup action or the Settings backup card. _Avoid_: Sync, snapshot, export, autosave

**Backup Method**:
The destination of a cloud Backup — Google Drive today, with Dropbox and iCloud as future providers. Shown next to the last-backup time in the sidebar backup caption and the Settings backup card.
_Avoid_: Provider, cloud service, storage

**Restore**:
A user-initiated, full overwrite of local data from a prior Backup — from a cloud provider or an uploaded file. Restore replaces the entire local dataset and never triggers a new Backup.
_Avoid_: Recovery, import, rollback

**Cancelled Restore**:
A Restore attempt that ends before any data changes because the user backed out — closing the sign-in window, declining access, or not picking a file. It leaves local data untouched, re-enables the Restore controls, and is not a failed Restore.
_Avoid_: Failed restore, restore error
