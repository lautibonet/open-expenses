# Personal Expense Tracker — Spec v2 (Frontend-Only)

> This version supersedes the earlier backend-based spec (`expense-tracker-spec.md`). That version's domain rules and business logic remain valid and are carried over unchanged; its persistence, auth, and multi-tenancy mechanics do not apply to this project anymore.

## Problem Statement

The user currently tracks personal finances in a manually maintained spreadsheet. It has real limitations: internal transfers between the user's own accounts require two error-prone rows instead of one clean movement, one account (in USD) has to be manually converted to EUR on every entry, the "period" concept doesn't match the calendar month but nothing automates that, and nothing validates or enforces consistency (category names, account references).

Separately, the user doesn't currently have a finished, polished project on their GitHub portfolio, and would rather ship one small, complete, genuinely-used app than a large multi-tier system left partially built.

## Solution

A single Angular application, deployed as a static site with no backend and no traditional account system. All data — cash accounts, categories, transactions, transfers, exchange rates — is stored locally in the browser via IndexedDB, giving instant, fully offline-capable reads and writes with zero network dependency for day-to-day use.

The user authenticates with Google only to enable an optional backup feature: the full dataset is periodically snapshotted as JSON and uploaded to a file the app itself owns in the user's Google Drive, using the most restrictive scope available (the app can only ever see files it created, never the user's broader Drive). This gives off-device backup and the ability to restore onto a new device or browser, without the user ever creating a password or the developer ever running or paying for a server.

Exchange rate lookups happen directly from the client against a free, key-less provider. The app is explicitly mono-user — one browser/device profile is one person's data — so none of the multi-tenant isolation mechanics designed in the earlier version apply here. The app is packaged as a PWA for installability and offline use.

## User Stories

### Local-first usage & onboarding

1. As a user, I want to open the app and start using it immediately, without registering or logging in, so there's no friction between deciding to track an expense and actually recording it.
2. As a first-time user, I want to complete a short onboarding flow (base currency, initial accounts, initial categories) before I start recording transactions, so my data has meaningful context from day one.
3. As a user, I want a default "Transfer" category to be created automatically the first time I open the app, so the internal-transfer flow works without manual setup.
4. As a returning user, I want the app to remember that I've already completed onboarding, so I land directly on my data instead of being asked to set up again.
5. As a user, I want the app to work fully offline, so I can log a transaction with no signal.
6. As a user, I want the app installable like a native app (PWA) on my phone or desktop, so it feels like a real tool, not a website I have to navigate to.

### CashAccount

7. As a user, I want to create any number of cash accounts representing where my money is (bank, cash, investment, etc.), so I can track all of it without the app forcing a rigid classification on me.
8. As a user, I want each account to have a name, a currency, and an initial balance, so the app has a baseline to compute its current balance from later.
9. As a user, I want account names to be unique, so I don't end up with duplicate or ambiguous accounts.
10. As a user, I want to edit an account's name and initial balance, so I can fix mistakes or keep names current.
11. As a user, I want to be blocked from changing an account's currency after creation, so historical transactions tied to it are never mislabeled.
12. As a user, I want to deactivate an account instead of permanently deleting it, so historical transactions and transfers tied to it remain intact and queryable.
13. As a user, I want to deactivate an account even if it has existing transactions or transfers, so I'm not blocked from tidying up my account list.

### Category

14. As a user, I want to create any number of categories, each marked Income or Expense, so the app knows whether to add or subtract a transaction's amount when reporting.
15. As a user, I want category names to be unique, so my category list stays unambiguous.
16. As a user, I want to mark a category as a "period anchor," so the app can later compute custom periods aligned to my pay cycle instead of the calendar month.
17. As a user, I want to edit or deactivate a category, so I can keep my category list relevant over time.
18. As a user, I want to be blocked from creating a second Transfer-type category, changing its type, or deleting it, so the transfer flow always has exactly one stable category to rely on.
19. As a user, I want to rename the system Transfer category, so I can label it however makes sense to me.

### Transaction (income/expense)

20. As a user, I want to record a transaction with an account, a category, an amount, a date, and an optional note, so I can log income and expenses.
21. As a user, I want the amount I enter to always be positive, with the category's type determining whether it's added or subtracted, so I never have to think about signs.
22. As a user, I want to be blocked from using the Transfer category on a regular transaction, so transfers and real income/expenses can never get mixed together in reports.
23. As a user, I want to edit an existing transaction's account, category, amount, date, or note, so I can correct mistakes.
24. As a user, I want to permanently delete a transaction, so I can remove entries made by mistake.
25. As a user, I want to record a transaction with a future date (e.g. a subscription I know is coming), so I can plan ahead, not just log the past.

### Transfer

26. As a user, I want to record a transfer between two of my own accounts (source and destination), with an amount, date, and optional note, so I can track moving money between my accounts.
27. As a user, I want a transfer to never count as income or expense in any report, so moving my own money around never distorts my totals.
28. As a user, I want to be blocked from creating a transfer where source and destination are the same account, so I can't create a meaningless movement.

### Multi-currency / ExchangeRate

29. As a user, I want to set a base currency for reports, so I have one consistent currency to view my overall finances in, even though my accounts are in different currencies.
30. As a user, when viewing my consolidated net worth, I want the app to suggest a current exchange rate for any account not in my base currency, so I don't have to look it up manually.
31. As a user, I want to confirm or override the suggested rate before it's applied, so I stay in control of the conversion instead of trusting an external source blindly.
32. As a user, I want my confirmed rate reused for future reports until I explicitly refresh it, so my consolidated total doesn't fluctuate silently every time I open the app.

### Backup & restore (Google Drive)

33. As a user, I want to connect my Google account to enable backup, so my data isn't only ever on one device.
34. As a user, I want my data automatically (and on-demand) backed up as a snapshot to my own Google Drive, so I don't lose everything if I clear my browser or switch devices.
35. As a user, I want the app to only ever access files it created in my Drive, not my whole Drive, so I'm not granting more access than the feature actually needs.
36. As a user, I want to restore my data from my most recent Drive backup on a new device or browser, so I can pick up where I left off without starting from scratch.
37. As a user, I want to see when my last backup happened, so I know how current my off-device copy is.
38. As a user, I want to disconnect Google Drive at any time and keep using the app fully locally, so backup stays optional, never a requirement to use the app.

### Deferred / future direction (not designed in detail — see Out of Scope)

39. As a user, I want the app to automatically compute which "period" a transaction belongs to, based on the most recent transaction tagged with a period-anchor category, so my reporting matches my pay cycle instead of the calendar month.
40. As a user, I want to see my current account balances computed from initial balance plus transactions and transfers, so I don't have to manually track running balances.
41. As a user, I want a summary report (income, expenses, savings, per-category totals) for a given period, so I can review my spending the way I used to with the spreadsheet's Stats sheet.
42. As a user, I want to see my total net worth across all accounts converted to my base currency, so I have one number representing my overall financial position.

## Implementation Decisions

**Stack & architecture**
- Angular, using standalone components and signals for state — no NgRx. The app's state shape doesn't justify the ceremony of a dedicated state management library.
- IndexedDB via Dexie.js as the persistence layer, replacing Postgres/JPA entirely. Dexie gives schema versioning and query ergonomics roughly analogous to what a JPA background would expect, without hand-rolling raw IndexedDB transaction/cursor code.
- No backend of any kind. The entire Spring Boot / Postgres / JWT design from the previous spec is dropped for this project — not deferred, dropped. Deployed as a static build (e.g. GitHub Pages, Netlify, Firebase Hosting, Cloudflare Pages); no server to run or pay for.
- Packaged as a PWA: a service worker caches the app shell for offline use and a web app manifest makes it installable. Offline support for the *data* is essentially free here since IndexedDB is already local — the service worker's job is caching the app itself, not the data.

**Mono-user by design**
- No `userId` scoping anywhere. All the ownership/isolation mechanics from the earlier spec (`findByIdAndUserId`, per-user unique constraints, etc.) are void — one browser/device profile is implicitly one user's data.
- Domain uniqueness rules (unique account names, unique category names, exactly one Transfer-type category) are preserved, but enforced as explicit check-before-write logic in the Dexie-backed service layer, since Dexie has no equivalent to a Postgres partial unique index.

**Onboarding**
- Same shape as before, no network dependency: on app start, check for a local "profile" record (base currency, `onboardingCompleted` flag). If absent, show the onboarding wizard; it writes directly to Dexie. The app must be fully usable through onboarding without ever connecting Google.

**Google authentication (Drive backup only, not app login)**
- OAuth 2.0 Authorization Code flow with PKCE via Google Identity Services — a public client, no client secret, entirely client-side. This is Google's documented, intended pattern for SPA-to-API auth, not a workaround.
- Scope: `drive.file` only. The app can see and manage only files it created itself, never the user's broader Drive — the deliberate minimal-permission choice.
- Token handling: access tokens are short-lived (~1 hour). Rather than persisting a long-lived refresh token in browser storage (a real, if modest, XSS-exposure concern), prefer silently re-acquiring a token via Google Identity Services while an active Google session exists in the browser. If silent re-acquisition fails, prompt the user to reconnect.
- Connecting Google is strictly optional and additive — it must never be a gate to using the app, onboarding, or any core feature.
- Disconnecting revokes the stored token and stops backups, but never deletes local data.

**Backup & restore**
- Format: a full-dataset JSON snapshot (every Dexie table serialized), not an incremental diff — appropriate given the data volume of a personal expense history, and it avoids building any sync/merge logic.
- Trigger: debounced automatic backup (e.g., some minutes after the last write, or on app close/visibility change) plus a manual "back up now" action — avoids uploading on every keystroke.
- Restore fully replaces local IndexedDB rather than merging with it. This is last-write-wins by design, which matches the mono-user, single-active-device usage pattern — there is no real-time multi-device conflict resolution.
- The timestamp of the last successful backup is stored and surfaced in the UI, so the user always knows how current their off-device copy is.

**Exchange rates**
- Called directly from the client. Default provider: Frankfurter (ECB reference rates) — free, no API key, CORS-enabled — which removes the "exposed API key in the client bundle" concern entirely, since there's no key to expose. If a keyed provider were ever substituted, that key would be visible in the client bundle; acceptable for a personal-use free-tier key, not appropriate if this app were ever offered to third-party users.

**Money representation**
- Native JS floating-point numbers are not used for amounts, to avoid rounding error accumulation across sums. Amounts are stored either as integer minor units (cents) or via a decimal-safe library (e.g. Dinero.js, big.js) — the specific choice is left open, but "never a raw JS `number` holding a fractional currency amount" is the fixed decision.
- Currency fields (`currency`, `baseCurrency`) remain free-form ISO 4217 strings rather than an enum, consistent with the original reasoning: new currencies shouldn't require a code change.

**Domain invariants carried over unchanged from the original design**
- A transaction's amount is always positive; the associated category's type (Income/Expense) determines its effect on totals.
- A category of type Transfer can never be used on a regular transaction.
- A transfer can never have the same source and destination account.
- A transfer never counts toward income/expense totals — enforced structurally by keeping `Transfer` and `Transaction` as fully separate data stores, not a shared table with a discriminator (same reasoning as the original spec: it makes accidentally including a transfer in an income/expense aggregate structurally impossible, not just filtered out).

## Testing Decisions

- No existing test setup for this pivot (frontend testing wasn't previously established either) — the following is a starting convention.
- A good test asserts on the resulting Dexie state after an operation, and on thrown or returned domain errors — not on internal call sequences between services or how a mapper/adapter is wired.
- **Unit tests**: for service-layer business rules — duplicate name rejection, single-Transfer-category enforcement, currency immutability, self-transfer rejection, positive-amount validation, Transfer-category misuse rejection on `Transaction`. Run against a real in-memory IndexedDB implementation (e.g. `fake-indexeddb`) rather than a fully mocked data layer, since these rules are meaningfully entangled with actual querying (e.g. "does a Transfer-type category already exist" requires a real query, not a stub).
- **Integration/E2E tests**: full user flows in a real browser — onboarding wizard end-to-end, creating a transaction and seeing it reflected in the UI, and the Drive connect → backup → restore round trip. The Drive flow specifically should run against a mocked Drive API / OAuth response in CI rather than real Google infrastructure.
- Suggested module coverage: onboarding flow, `CashAccountService`, `CategoryService`, `TransactionService`, `TransferService`, `ExchangeRateService` (mocking the Frankfurter call), `DriveBackupService` (mocking both Drive API calls and OAuth token acquisition).

## Out of Scope

- Full implementation of the period computation engine, real-time account balance calculation, Stats-style aggregate reporting, and the net worth snapshot view — all design intent only, same as the previous spec.
- Real-time or conflict-resolved multi-device sync — restore is a full overwrite, not a merge.
- Any multi-user or shared-account functionality — this app is explicitly mono-user.
- Any backend, server, or hosted database of any kind.
- Broad public distribution of the app (Google's OAuth verification requirements for sensitive scopes at scale, rate-limited/keyed exchange-rate providers, etc.) — this is designed for the author's personal use and as a portfolio piece, not for general third-party users.
- Automated data migration/import tooling from the original spreadsheet.

## Further Notes

- This spec supersedes the earlier backend-based version. That document remains a useful reference for *why* certain domain rules exist (e.g. the Transfer/Category relationship, the Transaction/Transfer separation) since that reasoning is unchanged — only the persistence, auth, and multi-tenancy mechanics were replaced.
- The primary motivation for this pivot, in the user's own words: having a fully-developed, lightweight, actually-finished app for a currently-empty GitHub portfolio matters more here than demonstrating a complete multi-tier stack. A small, polished, genuinely-used tool is the goal.
- The same design bias that ran through the original spec carries over: favor the simplest architecture that fits real, current, single-user usage (mono-user, no sync engine, no server) while keeping the specific choices that make the one piece of real infrastructure (Drive backup) trustworthy and minimal (the `drive.file` scope, full-snapshot format appropriate at this data size, currency as a free-form string).
