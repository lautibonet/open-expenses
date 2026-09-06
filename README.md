<p align="center">
  <img src="docs/assets/lockup.svg" alt="Open Expenses" width="418">
</p>

<p align="center">
  <a href="README.es.md"><img src="https://img.shields.io/badge/lang-es-yellow.svg" alt="lang-es"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-1a1c1c.svg" alt="License: AGPL-3.0"></a>
  <a href="https://github.com/lautibonet/open-expenses/actions/workflows/deploy.yml"><img src="https://github.com/lautibonet/open-expenses/actions/workflows/deploy.yml/badge.svg" alt="Deploy status"></a>
</p>

**Your money. Your browser. Your ledger.**

Open Expenses is a personal expense tracker that replaces the spreadsheet. It runs entirely in your browser as a PWA, keeps every figure on your device, and offers one optional backup to your own Google Drive. No account, no server, no tracking. Free software under AGPL-3.0.

## Try it

Open **[openexpenses.app](https://openexpenses.app/landing)**. Nothing to install: the hosted app is the production build of this repo, it works offline once loaded, and it updates itself through the service worker with an in-app prompt when a new version is ready.

## Origin

Open Expenses started as a Google Sheets template, refined by hand over ten years of real budgets. Month after month it taught one lesson: a ledger is a discipline, not a database. In 2026 the template became this app: the same ledger, rebuilt to run entirely in your browser.

## Highlights

- **LOCAL-FIRST.** Every figure lives in your browser (IndexedDB). The app works fully offline.
- **NO ACCOUNT. NO SERVER. NO TRACKING.** There is no backend: your data leaves your device only when you back it up.
- **MULTI-CURRENCY.** Accounts in different currencies; exchange rates come from the European Central Bank (via Frankfurter) and can be confirmed or overridden on each movement.
- **TRANSFERS ARE THEIR OWN THING.** Transfers between your own accounts never count as income or expense; the cross-currency ones record the rate they used.
- **STATS WITH INTENT.** Year-to-period totals, monthly averages, savings rate, expenses by category, and per-account balances as of the end of the chosen period.
- **BACKUP TO YOUR OWN DRIVE.** One manual action saves `open-expenses-backup.json` to your Google Drive; restoring it on another device is one step.
- **ENGLISH AND SPANISH.** The whole app, this README included.

## Screenshots

**Movements**, the ledger:

<p align="center">
  <img src="docs/screenshots/movements.png" alt="Movements screen: a ledger of transactions with green income, red expenses, a grey transfer, and a net flow card" width="854">
</p>

**Stats**, the summary:

<p align="center">
  <img src="docs/screenshots/stats.png" alt="Stats screen: income, expenses and net cards, a net by period chart, expenses by category, and per-account balances" width="854">
</p>

## Built with

Angular 21, TypeScript, Dexie over IndexedDB, and self-hosted Inter and JetBrains Mono. Every architectural decision is written down in [docs/adr/](docs/adr/).

**SELF-HOST.** It is a static site: clone the repo, run `npm ci` and `npm run build`, and serve `dist/open-expenses/browser` from any static host. Production runs on Cloudflare Pages; GitHub Pages works as a fallback.

## Support

If Open Expenses saves you a spreadsheet's worth of headaches, you can buy me a coffee:

<p align="center">
  <a href='https://ko-fi.com/N6E5263BIN' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
</p>

## License

Open Expenses is free software under [AGPL-3.0](LICENSE).
