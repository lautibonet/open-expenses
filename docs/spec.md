# Spec: Open Expenses — Personal Expense Tracker

> **Status**: Ready for agent
> **Triage label**: `ready-for-agent`

## Problem Statement

The user currently tracks personal finances in a manually maintained spreadsheet. It has real limitations: internal transfers between the user's own accounts require two error-prone rows instead of one clean movement, one account (in USD) has to be manually converted to EUR on every entry, the period concept is manually tagged but nothing automates or validates it, and nothing enforces consistency (category names, account references). Reusable tagging for grouping transactions is not possible.

Separately, the user doesn't currently have a finished, polished project on their GitHub portfolio, and would rather ship one small, complete, genuinely-used app than a large multi-tier system left partially built.

## Solution

A single Angular application, deployed as a static site with no backend and no traditional account system. All data — accounts, categories, transactions, transfers, exchange rates — is stored locally in the browser via IndexedDB, giving instant, fully offline-capable reads and writes with zero network dependency for day-to-day use.

The app has three tabs: **Dashboard** (read-only summary with period totals, per-category breakdown, yearly averages, and per-account balances), **Movements** (unified chronological list of transactions and transfers with filtering), and **Settings** (account/category/tag management, base currency, Google Drive backup).

The user authenticates with Google only to enable an optional backup feature: the full dataset is periodically snapshotted as JSON and uploaded to a file the app itself owns in the user's Google Drive, using the most restrictive scope available (the app can only ever see files it created, never the user's broader Drive). This gives off-device backup and the ability to restore onto a new device or browser, without the user ever creating a password or the developer ever running or paying for a server.

Exchange rate lookups happen directly from the client against a free, key-less provider. The app is explicitly mono-user — one browser/device profile is one person's data — so none of the multi-tenant isolation mechanics from earlier designs apply here. The app is packaged as a PWA for installability and offline use.

## User Stories

### Local-first usage & onboarding

1. As a user, I want to open the app and start using it immediately, without registering or logging in, so there's no friction between deciding to track an expense and actually recording it.
2. As a first-time user, I want to complete a short onboarding flow (base currency, initial accounts, review default categories) before I start recording movements, so my data has meaningful context from day one.
3. As a first-time user, I want the app to ship with pre-populated default categories (Expense: Food, Transport, Housing, Subscriptions, Leisure, Misc; Income: Payroll, Second-hand Sale, Refund) that I can review and edit during onboarding, so I don't have to create everything from scratch.
4. As a returning user, I want the app to remember that I've already completed onboarding, so I land directly on my data instead of being asked to set up again.
5. As a user, I want the app to work fully offline, so I can log a transaction with no signal.
6. As a user, I want the app installable like a native app (PWA) on my phone or desktop, so it feels like a real tool, not a website I have to navigate to.

### Account

7. As a user, I want to create any number of accounts representing where my money is, so I can track all of it without the app forcing a rigid classification on me.
8. As a user, I want each account to have a name, a currency, and an initial balance, so the app has a baseline to compute its current balance from later.
9. As a user, I want account names to be unique, so I don't end up with duplicate or ambiguous accounts.
10. As a user, I want to edit an account's name and initial balance, so I can fix mistakes or keep names current.
11. As a user, I want to be blocked from changing an account's currency after creation, so historical transactions tied to it are never mislabeled.
12. As a user, I want to deactivate an account instead of permanently deleting it, so historical transactions and transfers tied to it remain intact and queryable.
13. As a user, I want to deactivate an account even if it has existing transactions or transfers, so I'm not blocked from tidying up my account list.

### Category

14. As a user, I want to create any number of categories, each marked Income or Expense, so the app knows whether to add or subtract a transaction's amount when reporting.
15. As a user, I want category names to be unique, so my category list stays unambiguous.
16. As a user, I want to edit or deactivate a category, so I can keep my category list relevant over time.
17. As a user, I want the app to ship with default categories that I can customize during onboarding, so I have a useful starting point.

### Tag

18. As a user, I want to apply freeform, reusable text labels (tags) to transactions for extra grouping, so I can filter and organize beyond categories.
19. As a user, I want multiple tags per transaction, so a single transaction can belong to multiple groupings (e.g. "vacation" and "food").
20. As a user, I want type-ahead auto-completion when entering tags, so I reuse existing tags consistently instead of creating duplicates.
21. As a user, I want tags to coexist with categories — category is mandatory, tags are optional — so I have both structured classification and freeform labeling.
22. As a user, I want to rename a tag inline when editing a transaction, so I can fix typos without a dedicated management screen.
23. As a user, I want unused tags to naturally disappear (or be cleanable), so my tag list doesn't accumulate stale entries.

### Transaction (income/expense)

24. As a user, I want to record a transaction with an account, a category, an amount, a date, a period (month name), and optional tags, so I can log income and expenses.
25. As a user, I want the amount I enter to always be positive, with the category's type determining whether it's added or subtracted, so I never have to think about signs.
26. As a user, I want to select a period from a dropdown of month names (January through December) when entering a transaction, so I can tag it to the correct reporting period.
27. As a user, I want to edit an existing transaction's account, category, amount, date, period, or tags, so I can correct mistakes.
28. As a user, I want to permanently delete a transaction, so I can remove entries made by mistake.
29. As a user, I want to record a transaction with a future date (e.g. a subscription I know is coming), so I can plan ahead, not just log the past.

### Transfer

30. As a user, I want to record a transfer between two of my own accounts (source and destination), with an amount, date, period, and optional note, so I can track moving money between my accounts.
31. As a user, I want a transfer to never count as income or expense in any report, so moving my own money around never distorts my totals.
32. As a user, I want to be blocked from creating a transfer where source and destination are the same account, so I can't create a meaningless movement.
33. As a user, I want to edit all fields of a transfer (source, destination, amount, date, period, note), so I can correct mistakes.
34. As a user, I want to permanently delete a transfer, so I can remove entries made by mistake.

### Movements (unified view)

35. As a user, I want a single Movements tab that shows both transactions and transfers in chronological order, so I see a plain timeline of all financial events.
36. As a user, I want transfers to display as compact single rows (e.g. "Transfer: Account A → Account B, amount, date"), so the list stays scannable.
37. As a user, I want two distinct add buttons ("+ Transaction" and "+ Transfer") on the Movements tab, so I go directly to the right form without a type-picking step.
38. As a user, I want the Movements tab to default to the current period (month), so I see recent activity immediately.
39. As a user, I want a period dropdown to switch between months, so I can browse any period's movements.
40. As a user, I want to filter movements by category, account, and tags, so I can find specific entries quickly.
41. As a user, I want movements sorted newest-first by default, so the most recent activity is always at the top.

### Dashboard

42. As a user, I want a dedicated Dashboard tab showing a read-only summary of my finances, so I can review my spending at a glance.
43. As a user, I want the Dashboard to show period totals (income, expenses, net) for the selected period, so I know how the current month went.
44. As a user, I want the Dashboard to show a per-category expense breakdown for the selected period, so I see where my money went.
45. As a user, I want the Dashboard to show average monthly income, average monthly expenses, and average monthly savings computed over all periods of the current year (excluding empty periods), so I have a meaningful trend view.
46. As a user, I want the Dashboard to show each account's current balance (initial balance plus all transactions and transfers), so I know where I stand.
47. As a user, I want the Dashboard to show a historical period-end balance table (rows = accounts, columns = periods, cells = balance at end of each period), so I can track how balances evolve over time.
48. As a user, I want a year selector (dropdown or arrows) at the top of the Dashboard, so I can view past years' data.
49. As a user, I want the Dashboard to be a single scrollable screen with card layout, so all summary information is in one place.

### Multi-currency / Exchange Rate

50. As a user, I want to set a base currency for reports, so I have one consistent currency to view my overall finances in, even though my accounts are in different currencies.
51. As a user, when entering a transaction in a non-base-currency account, I want the app to suggest a current exchange rate, so I don't have to look it up manually.
52. As a user, I want to confirm or override the suggested rate before it's applied, so I stay in control of the conversion.
53. As a user, if the exchange rate API fails, I want to manually type a rate as a fallback, so I can still save the transaction offline.
54. As a user, I want both the foreign amount and the base-currency equivalent stored per transaction, so I have an audit trail of the conversion.

### Settings

55. As a user, I want a Settings tab where I can manage my accounts (create, edit, deactivate), so I can keep my account list current.
56. As a user, I want a Settings tab where I can manage my categories (create, edit, deactivate), so I can keep my category list relevant.
57. As a user, I want a Settings tab where I can view and rename my tags, so I can maintain tag quality without leaving the app.
58. As a user, I want a Settings tab where I can change my base currency setting, so I can adjust my reporting currency if needed.
59. As a user, I want a Settings tab where I can connect/disconnect Google Drive backup and see the last backup timestamp, so I can manage my off-device backup.

### Backup & restore (Google Drive)

60. As a user, I want to connect my Google account to enable backup, so my data isn't only ever on one device.
61. As a user, I want my data automatically (and on-demand) backed up as a snapshot to my own Google Drive, so I don't lose everything if I clear my browser or switch devices.
62. As a user, I want the app to only ever access files it created in my Drive, not my whole Drive, so I'm not granting more access than the feature actually needs.
63. As a user, I want to restore my data from my most recent Drive backup on a new device or browser, so I can pick up where I left off without starting from scratch.
64. As a user, I want to see when my last backup happened, so I know how current my off-device copy is.
65. As a user, I want to disconnect Google Drive at any time and keep using the app fully locally, so backup stays optional, never a requirement to use the app.

## Implementation Decisions

**Stack & architecture**
- Angular, using standalone components and signals for state — no NgRx. The app's state shape doesn't justify the ceremony of a dedicated state management library.
- IndexedDB via Dexie.js as the persistence layer. Dexie gives schema versioning and query ergonomics without hand-rolling raw IndexedDB transaction/cursor code.
- No backend of any kind. Deployed as a static build (e.g. GitHub Pages, Netlify, Firebase Hosting, Cloudflare Pages); no server to run or pay for.
- Packaged as a PWA: a service worker caches the app shell for offline use and a web app manifest makes it installable. Offline support for the data is free since IndexedDB is already local.

**Mono-user by design**
- No userId scoping anywhere. One browser/device profile is implicitly one user's data.
- Domain uniqueness rules (unique account names, unique category names) are enforced as explicit check-before-write logic in the Dexie-backed service layer.

**Data model — Transactions and Transfers are structurally separate**
- Transfers and Transactions are fully separate data stores, not a shared table with a type discriminator. This makes accidentally including a Transfer in an Income/Expense aggregate structurally impossible (see ADR-0002).

**Data model — Periods are a text field, not an entity**
- Period is a month name (January through December) stored as a text field on both Transactions and Transfers. Not a separate entity with its own table. Year is always implied as the current year. No automated period engine (see ADR-0003).

**Data model — Tags are extracted, not a separate table**
- Tags are freeform text strings stored per-transaction. Existing tags are discovered by scanning all transactions for unique tag strings. No separate Tags table. Rename = find-and-replace across transactions.

**Data model — No Transfer category**
- The original spec's auto-created Transfer-type category is dropped entirely. Transfers are structurally separate from Transactions and never reference categories (see grilling decision).

**Onboarding**
- On app start, check for a local profile record (base currency, onboardingCompleted flag). If absent, show the onboarding wizard. Steps: set base currency, create initial accounts, review/edit pre-populated default categories. No pay-day rule configuration (periods are manually selected month names).

**Default categories**
- Expense: Food, Transport, Housing, Subscriptions, Leisure, Misc
- Income: Payroll, Second-hand Sale, Refund

**Navigation**
- Three tabs: Dashboard, Movements, Settings.

**Movements tab**
- Unified chronological list of Transactions and Transfers, interleaved by date.
- Two distinct add buttons: "+ Transaction" and "+ Transfer".
- Default view: current period (month). Period dropdown to switch.
- Filters: category, account, tags. Sort: newest-first.
- Transfers display as compact single rows.

**Dashboard**
- Single scrollable screen, card layout.
- Year selector at the top (defaults to current year).
- Sections: period totals (income/expenses/net), per-category expense breakdown, yearly averages (income/expenses/savings, current year, excluding empty periods), per-account current balance, historical period-end balance table (rows = accounts, columns = periods).

**Settings**
- Account management (CRUD, deactivate).
- Category management (CRUD, deactivate).
- Tag management (view, rename inline — no dedicated screen).
- Base currency setting.
- Google Drive backup (connect/disconnect/status).

**Google authentication (Drive backup only)**
- OAuth 2.0 Authorization Code flow with PKCE via Google Identity Services — public client, no client secret.
- Scope: drive.file only. The app can see and manage only files it created (see ADR-0004).
- Token handling: prefer silently re-acquiring via Google Identity Services while an active session exists. If silent re-acquisition fails, prompt to reconnect.
- Connecting Google is strictly optional — never a gate to using the app.

**Backup & restore**
- Full-dataset JSON snapshot (every Dexie table serialized), not incremental diff.
- Debounced automatic backup plus manual "back up now" action.
- Restore fully replaces local IndexedDB (last-write-wins, matches mono-user pattern).
- Last backup timestamp stored and surfaced in the UI.

**Exchange rates**
- Frankfurter API (ECB reference rates) — free, no API key, CORS-enabled.
- User always confirms or overrides the suggested rate, even when the API succeeds.
- Manual fallback: if API fails, user types a rate manually. Transaction saves with the manual rate.

**Money representation**
- Never a raw JS number holding a fractional currency amount. Use integer minor units (cents) or a decimal-safe library (e.g. Dinero.js, big.js).
- Currency fields remain free-form ISO 4217 strings (not an enum).

**Domain invariants**
- A transaction's amount is always positive; the category's type (Income/Expense) determines its effect on totals.
- A transfer can never have the same source and destination account.
- A transfer never counts toward income/expense totals — enforced structurally by separate data stores.
- Account names are unique. Category names are unique.
- An account's currency cannot be changed after creation.

## Testing Decisions

- A good test asserts on the resulting Dexie state after an operation, and on thrown or returned domain errors — not on internal call sequences between services.
- **Unit tests**: for service-layer business rules — duplicate name rejection, self-transfer rejection, positive-amount validation, currency immutability, tag coexistence with categories. Run against a real in-memory IndexedDB implementation (e.g. fake-indexeddb) rather than a fully mocked data layer.
- **Integration/E2E tests**: full user flows in a real browser — onboarding wizard end-to-end, creating a transaction and seeing it reflected in the Movements list, Dashboard period switching, Drive connect → backup → restore round trip (mocked Drive API in CI).
- Suggested module coverage: onboarding flow, AccountService, CategoryService, TransactionService, TransferService, ExchangeRateService (mocking the Frankfurter call), DriveBackupService (mocking Drive API and OAuth).

## Out of Scope

- Automated period computation engine (periods are manually selected month names).
- Real-time or conflict-resolved multi-device sync — restore is a full overwrite, not a merge.
- Any multi-user or shared-account functionality — this app is explicitly mono-user.
- Any backend, server, or hosted database of any kind.
- Broad public distribution of the app — designed for the author's personal use and as a portfolio piece.
- Automated data migration/import tooling from the original spreadsheet.
- Recurring transactions, search across transactions, CSV/PDF export — potential post-MVP features.
- Dedicated tag management screen — tags managed inline when editing transactions.
- Account type field (bank, cash, credit card, etc.) — accounts have name, currency, and initial balance only.
- Charts or visualizations on the Dashboard — table layout for period-end balances.

## Further Notes

- This spec supersedes the earlier v2 spec (docs/original-spec/open-expense-tracker-original-spec.md). Domain rules about Transaction/Transfer separation carry over; the period model, tag system, navigation structure, and Dashboard scope are new decisions from the grilling session.
- The primary motivation: having a fully-developed, lightweight, actually-finished app for a currently-empty GitHub portfolio matters more than demonstrating a complete multi-tier stack.
- Domain glossary is maintained in CONTEXT.md. Architectural decisions are recorded in docs/adr/ (0001 through 0004).
