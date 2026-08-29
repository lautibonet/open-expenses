# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is the author and a small circle of trusted people (partner, close family). Each installation is mono-user — one browser profile, one person's data. The app serves both personal finance tracking and as a portfolio piece demonstrating a finished, production-quality Angular project.

## Product Purpose

Replace a manually maintained spreadsheet for personal expense tracking. The app captures the full lifecycle of money movement — income, expenses, transfers between accounts — with local-first data storage, optional off-device backup, and multi-currency support. Success means the spreadsheet is no longer needed and the app is genuinely used day-to-day.

## Positioning

An open-source, privacy-first personal finance tool that requires zero server, zero account, and zero ongoing cost. Unlike SaaS expense trackers, the data never leaves the device unless the user explicitly backs it up. Unlike spreadsheets, it enforces structural invariants (no accidental transfer-as-income, no duplicate account names) while staying lightweight enough to run entirely in the browser.

## Operating Context

- **Onboarding**: first-time wizard sets base currency, initial accounts, and reviews default categories; optional restore-from-backup as first step.
- **Daily use**: open app → add transaction or transfer → close. No login, no loading, no network dependency.
- **Periodic review**: Stats for monthly totals, category breakdown, yearly trends, and account balances.
- **Data safety**: manual cloud backup via Google Drive (on-demand, never automatic) and file download/upload for device migration.
- **Offline**: fully functional with no internet connection; exchange rates gracefully degrade to manual entry when offline.

## Capabilities and Constraints

- **Three tabs**: Stats (read-only summary), Movements (unified chronological list + CRUD), Settings (accounts, categories, base currency, backup).
- **Multi-currency**: accounts can hold different currencies; amounts converted via Frankfurter API (ECB rates) at transaction/transfer time, with user confirm or manual override.
- **Data model**: Transactions and Transfers are structurally separate; Periods are month-name text fields plus year on movements.
- **Money safety**: integer minor units or Dinero.js; amounts always positive; category type determines income/expense effect.
- **Local persistence**: IndexedDB via Dexie.js with schema versioning.
- **Backup**: full JSON snapshot, manual-only, to Google Drive (OAuth, drive.file scope only) or downloaded file.
- **PWA**: installable, offline-capable, service worker cached.
- **No backend**: static deployment, no server, no database, no auth system beyond optional Google OAuth for Drive.

## Brand Commitments

- Name: "Open Expenses" — chosen to signal open-source intent; not a binding constraint on visual identity.
- No logo, no color commitment, no established voice or personality yet.
- No domain or URL committed to.

## Evidence on Hand

- Fully functional Angular 21 app with working features across all three tabs.
- Complete spec at `docs/spec.md` with 59 user stories and implementation decisions.
- Domain glossary at `CONTEXT.md`.
- 7 architectural decision records in `docs/adr/`.
- Component-scoped SCSS over a global token layer in `styles.scss` (colors, type, radii, spacing, elevation), with shared style patterns extracted into `src/app/shared/styles/_patterns.scss`; the design system is documented at `DESIGN.md`.

## Product Principles

1. **Local-first by default.** The app works completely offline; network is optional and never a gate to core functionality.
2. **Data integrity without ceremony.** Structural invariants prevent real errors (self-transfers, duplicate names, sign confusion) without requiring the user to learn rules.
3. **Manual control over automation.** Backup, exchange rates, and period assignment are user-initiated decisions, not automated processes.
4. **One person, one device, no accounts.** No login, no multi-tenant isolation, no server. A browser profile is an identity.
5. **Open source as a design constraint.** The codebase is legible, the stack is lightweight, and the deployment is free. Complexity that doesn't serve these goals is cut.

## Accessibility & Inclusion

No product-specific accessibility requirements established yet. The app should meet baseline web accessibility (semantic HTML, keyboard navigation, sufficient contrast) as a standard expectation.
