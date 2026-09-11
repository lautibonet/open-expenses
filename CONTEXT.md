# Open Expenses

A personal expense tracking app that replaces a manually maintained spreadsheet. Local-first, frontend-only, deployed as a static PWA with optional Google Drive backup.

## Language

**Transaction**:
A recorded movement of money linked to an account, a category, an amount, a date, and a period (month number 1-12). On a Cash Account it is classified as Income or Expense by its Category and counts in the Income and Expenses totals and the category graph alike. On a Credit Card it never touches the Income and Expenses totals: it moves the card's balance as card spending (a Card Purchase, which reaches the category graph marked as paid with credit) or as a refund that cancels debt.
_Avoid_: Entry, record, line item

**Transfer**:
A movement of money between two of the user's own accounts. Structurally separate from Transactions. Counts as an Expense only when it moves money from a Cash Account into a Credit Card — a Card Payment; every other Transfer (Cash to Cash, Card to Cash, Card to Card) never counts as Income or Expense. Stores `sourceAmount`, `destinationAmount`, `exchangeRate`, and `baseCurrencyAmount` — and, on a Card Payment, a category. For same-currency transfers, `sourceAmount` equals `destinationAmount`.
_Avoid_: Movement, internal transfer

**Account**:
A named place where the user holds money — a Cash Account — or owes money — a Credit Card. Defined by a name, a currency, and an initial balance; a Credit Card additionally has a Linked Account and an optional Limit, and its initial balance is its starting debt. Its balance is computed from the initial balance plus Transactions and Transfers up to a given point in time; on Stats it is reported as of the end of the Scope's Period.
_Avoid_: Wallet, bank account, source

**Credit Card**:
An Account that represents money the user owes rather than holds: spending on it uses the bank's credit, not the user's money. Created with a name, a currency (defaulted from the Linked Account), a Linked Account, and an optional Limit — a ceiling on its debt that warns and is shown as used-of-limit on Stats, but never blocks. Its balance is its outstanding debt: it goes negative with every Card Purchase and returns toward zero with every Card Payment. Managed in Settings; never created during Onboarding.
_Avoid_: credit line, revolving credit

**Linked Account**:
The Cash Account associated with a Credit Card. It seeds the card's currency at creation and pre-fills the source of its Card Payments, and, being referenced, it cannot be Deleted while a card points to it — only Deactivated. A default, never a constraint: a Statement can be paid from any Account.
_Avoid_: backing account, paying account

**Card Payment**:
A Transfer from a Cash Account into a Credit Card that settles card debt — the moment the user pays a Statement, in full or in part, from any Account, possibly several times in one Period. It counts as an Expense in the Income and Expenses totals and in Net, under a required category created for the card (e.g. "Visa payment" / "Pago Visa"). That category labels the payment but never reaches the category graph, where it would double-count what the settled purchases already report. Interest and fees ride inside the Statement total and reach Expenses the same way — never recorded separately.
_Avoid_: statement payment, pay credit card, card settlement

**Statement**:
The monthly summary a card's issuer produces: what was billed, what is due, and by when. The app never stores or computes it — it is the source of truth the user reads from when recording. The card's balance always shows the total debt, not the Statement's due amount, and the app offers no statement-cycle view.
_Avoid_: bill, invoice, cycle

**Category**:
A mandatory classification label applied to every Transaction and to every Card Payment, marked as either Income or Expense. Flat list, no hierarchy. Pre-populated with defaults during onboarding.
_Avoid_: Type, group, classification

**Period**:
A calendar month (January through December) assigned to a Transaction or Transfer to group it for reporting, together with the year of the Period the movement belongs to. Months are stored locale-independently and displayed in the active Language. Not a separate entity — a month text field plus a `year` on the movement. Reporting (Stats year filter, period totals, yearly averages) uses the stored year, not the movement's date; dates are purely informational. New movements default to the current year; pre-existing movements without a stored year fall back to their date's year.
_Avoid_: Cycle, fiscal period, date range

**Scope**:
The reporting window chosen on the Stats and Movements screens. On Stats it is always a single Period (a month together with its year). On Movements it is a single Period or a whole year: the year Scope (its month selector's "All" option) covers every movement whose stored Period year is the Scope's year, and the Income, Expenses, and Net figures aggregate over that full year. Filtering by Scope always uses the stored Period year, never the movement's date. On Stats, aggregations that span multiple Periods are not narrowed to the Scope's month: the total and per-account balances are cumulative balances as of the end of the Scope's Period (initial balances plus every movement whose stored Period is at or before it), and the Income, Expenses, and Net totals and averages are year-to-period: January through the Scope's Period of the Scope's year. There is no All Time Scope: selecting the latest Period shows the all-time figure.
_Avoid_: Filter, range, timeframe, selection, All Time

**Base Currency**:
The single currency in which the Stats total balance and all period totals/averages are reported. Set during onboarding. Accounts may hold different currencies; amounts are converted using exchange rates recorded at transaction/transfer time.
_Avoid_: Report currency, display currency

**Exchange Rate**:
The conversion factor between two currencies. Fetched from Frankfurter v2 (ECB rates) via `/rate/{FROM}/{TO}` for single pairs or `/rates?base={FROM}&quotes={TO1,TO2}` for batches. User-confirmed or manually overridden per Transaction or Transfer.
_Avoid_: Conversion rate, FX rate

**Suggested Rate**:
The reference Exchange Rate fetched for a currency pair and the movement's date, offered in the Transfer Form. It refreshes only when the currency pair or the date changes — never in response to the user typing a rate, which is an override, not a new suggestion.
_Avoid_: Recommended rate, default rate, auto rate

**Movement**:
The unified display of Transactions and Transfers in a single chronological list. Each row carries a colored edge stripe identifying its kind: green for Income, red for Expense, grey for Transfer. Amounts are always positive; cross-currency items show both original and converted amounts (e.g. `$10.00 → €8.57`). As a data predicate, an Account or Category has movements when any Transaction or Transfer references it — having movements is what makes an item un-Deletable.
_Avoid_: Feed, timeline, history

**Movement Date**:
The user-selected calendar day of a Transaction or Transfer. A date, not an instant: it has no time of day and never shifts with the device's timezone — a movement created for September 1st stays September 1st on every device, in every timezone. Informational only; reporting uses the movement's stored Period.
_Avoid_: timestamp, datetime, created at

**Transaction Form**:
The Transaction capture form on the Movements screen — account, category, amount, note, date, and period shown all at once, with no compact/expanded distinction. When a Credit Card is selected as the account, a hint states that purchases on a card are counted when the Statement is paid. Revealed by the New Transaction button, the sidebar capture action, or the mobile bottom nav's center capture slot; presents as a bottom sheet on mobile and inline on desktop. Used for both recording and editing a Transaction.
_Avoid_: Quick Add, quick entry, mini form, inline add, more options

**Transfer Form**:
The Transfer capture form on the Movements screen — source account, destination account, source and destination amounts, note, date, and period shown all at once. When the destination is a Credit Card it becomes the Card Payment capture: a required category pre-filled with the card's payment category and a hint showing the card's outstanding balance. Revealed by the Add Transfer button; presents as a bottom sheet on mobile and inline on desktop, like the Transaction Form. Used for both recording and editing a Transfer.
_Avoid_: Transfer dialog, move-money form

**Net**:
Income minus Expenses aggregated over an aggregation window — a single Period or a whole year — reported in Base Currency. Income and Expenses count cash: money that entered or left a Cash Account, with card spending reaching Expenses only through Card Payments. A positive Net means money kept; a negative Net means money overspent. The Savings Rate shown on Stats is Net divided by Income. Never a kind of Transaction or Transfer.
_Avoid_: profit, earnings, balance

**Stats** (formerly Dashboard):
A read-only summary screen showing a total balance in Base Currency as of the end of the Scope's Period (per-account balances accumulated from initial balances and movements at or before that Period; cross-currency movements counted at their stored conversions), year-to-period totals and monthly averages of Income, Expenses, and Net (January through the Scope's Period of the Scope's year), a per-category spending breakdown, and per-account balances as of the end of the Scope's Period. The Income, Expenses, and Net figures count cash (Card Purchases excluded, Card Payments included), while the category breakdown counts spending (every purchase, cash or credit, each bar split into what was paid with cash and what with credit) — the two measure different things and can disagree within a Period or wherever debt is carried; they agree once every card is fully settled. When any Credit Card's balance is negative the total balance is shown as three figures — the total without debt, the Debt, and the total with debt — and collapses back to a single Total otherwise. Reached via the `/stats` route (legacy `/dashboard` redirects here).
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

**Last Backup**:
The freshness figure shown in the sidebar caption and the Settings backup card: the time of the most recent Backup whose data this device holds. A Backup sets it to the backup's own time; a Restore sets it to the time the restored snapshot was taken — never to the restoring device's action time, and never inherited from the snapshot's mirrored profile. It answers "how fresh is the data I'm holding", not "when did this device last act".
_Avoid_: last sync, backup date of this device

**Cancelled Restore**:
A Restore attempt that ends before any data changes because the user backed out — closing the sign-in window, declining access, or not picking a file. It leaves local data untouched, re-enables the Restore controls, and is not a failed Restore.
_Avoid_: Failed restore, restore error

**Deactivate**:
The reversible removal of an Account or Category from active use: it disappears from pickers, but every reference to it is kept intact and it can be reactivated at any time. The only form of removal available to items that have movements.
_Avoid_: Archive, disable, delete, hide

**Delete**:
The permanent, irreversible removal of an Account or Category that has no movements (a Category is un-used when no Transaction references it). Never cascades: if anything references the item, Delete is refused with an explanation and Deactivation is offered instead. A Credit Card counts as a reference to its Linked Account.
_Avoid_: Remove, erase, destroy

**Erase**:
A user-initiated, permanent wipe of all local data — Accounts, Categories, Transactions, Transfers, and the Profile — after which the app returns to Onboarding as a fresh start. Distinct from Restore: Erase never brings data back; it only throws it away.
_Avoid_: Reset, wipe, factory reset, clear data
