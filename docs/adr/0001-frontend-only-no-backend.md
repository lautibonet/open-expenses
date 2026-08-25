# Frontend-only, no backend

The entire app runs in the browser with no server, no database, and no traditional auth. Data persists in IndexedDB via Dexie.js. The only network dependency is optional Google Drive backup (OAuth PKCE, `drive.file` scope) and exchange rate lookups (Frankfurter API, keyless).

This was chosen to ship a small, complete, genuinely-used app for a portfolio piece — not to demonstrate a multi-tier stack. A backend would add deployment cost, auth complexity, and hosting fees for a mono-user app that benefits from none of it.

The trade-off: no real-time multi-device sync. Restore is a full JSON snapshot overwrite, which matches single-device personal usage.
