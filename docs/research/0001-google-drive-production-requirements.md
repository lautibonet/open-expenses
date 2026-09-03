# Research: What Google Drive backup requires in production

- **Ticket:** lautibonet/open-expenses#119 ("What Google Drive backup requires in production", part of the launch map)
- **Date:** 2026-09-03
- **Scope of this doc:** fact-finding only. No source code was modified. All facts below were checked against Google's own developer/support documentation as of September 2026; each claim carries a link to the page that owns it.
- **Location:** no prior research-notes convention existed in this repo, so findings live in `docs/research/`. Previous relevant docs: `docs/google-drive-setup.md` (setup walkthrough) and `docs/adr/0004-google-drive-backup-with-drive-file-scope.md` (scope decision).

## TL;DR

The app already picked the right scope (`drive.file`, ADR 0004). It is a **sensitive** scope, not a **restricted** one, so the expensive part of Google's process — the CASA security assessment and annual re-verification — **does not apply**. What a public launch does require: publish the OAuth consent screen to production (free), and complete **sensitive-scope verification** (privacy policy URL, public home page, demo video, per-scope justification; typically 3–5 business days). Publishing *without* verification is possible but hard-caps the app at **100 total users** and shows every stranger a scary "Google hasn't verified this app" danger screen — not viable for launch. The "7-day refresh token expiry in testing" problem does **not** affect this app, because it uses the GIS implicit token flow and never holds a refresh token. Drive API quotas and costs are a non-issue at this scale.

## What the app actually does today (from `src/`, unmodified)

- Scope requested: `https://www.googleapis.com/auth/drive.file` — `src/app/core/services/drive-backup.service.ts:26`.
- OAuth flow: Google Identity Services `google.accounts.oauth2.initTokenClient` loaded from `accounts.google.com/gsi/client` (`drive-backup.service.ts:74-95, 268-285`). This is the **implicit/token flow for JavaScript web apps**: the app receives an **access token only** (expires in ~1 hour), stores it in `localStorage` under `open-expenses_google_token`, and **never receives a refresh token**.
- Disconnect revokes the token at `oauth2.googleapis.com/revoke` (`drive-backup.service.ts:97-112`).
- Client ID is read from a `<meta name="google-client-id">` tag in `src/index.html`.
- The Drive API is used only to create/find/update/download one file named `open-expenses-backup.json` in the user's own Drive (`src/app/backup/drive-backup-provider.ts`). The file counts against the **user's** Drive storage, not ours.
- Minor doc discrepancy: `docs/google-drive-setup.md:3` says the backup uses "OAuth 2.0 with PKCE". The code does not use PKCE — GIS `initTokenClient` is the implicit flow with no client secret and no code exchange. Worth fixing in a follow-up doc pass; behavior is fine as-is.

## Fact 1 — Publishing status, and the refresh-token / 7-day question

Google's current overview of OAuth app states ([OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), updated 2026-05-22):

| Publishing status | User type | Who can authorize | Notes |
|---|---|---|---|
| Testing | External | Only allow-listed test users, **hard cap of 100 test users** | Users see a "testing" warning screen; refresh token lifetime is limited (**~7 days**) |
| Published, Unverified | External | Any Google user | For apps requesting sensitive/restricted scopes: **unverified-app danger warnings** shown to every user **and a hard cap of 100 total users** |
| Published, Verified | External | Any Google user | Required for public apps requesting sensitive/restricted scopes; consent screen shows app name/logo/scopes without warnings |

Key points for this app:

- The classic "refresh tokens expire after 7 days while in Testing" problem ([refresh token expiry](https://developers.google.com/identity/protocols/oauth2#expiration); restated on the overview page above) applies to apps that **use refresh tokens**. Open Expenses **never gets a refresh token** — it re-runs `requestAccessToken()` per session and simply asks Google again when the ~1-hour access token is gone. So the 7-day problem does not break backups today, in Testing or in production.
- The Testing-mode constraints that *do* bite are: only the 100 allow-listed test users can connect at all, and everyone sees a tester warning screen.
- Crucially, **publishing the app is not enough**: once published-but-unverified with a sensitive scope, strangers still see the danger UI and the app is capped at **100 total users**. For a public launch, scope verification is effectively mandatory, not optional.
- Publishing the consent screen to production and going through verification cost **nothing** (no Google fee). The only paid step in Google's whole process is the third-party security assessment, which applies to **restricted** scopes only — not to us.

## Fact 2 — Scope classification: `drive.file` is sensitive, not restricted

- The app requests `drive.file` ("See, edit, create, and delete only the specific Google Drive files you use with this app") — [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes).
- Google's current restricted-scope list for Drive ([Restricted Scopes](https://support.google.com/cloud/answer/13464325)) contains: `drive`, `drive.readonly`, `drive.activity`, `drive.activity.readonly`, `drive.metadata`, `drive.metadata.readonly`, `drive.scripts`, `drive.meet.readonly`. **`drive.file` and `drive.appdata` are not on the restricted list** — they are classified as *sensitive*.
- Consequences of sensitive (vs restricted) for this app ([Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), updated 2026-08-19; [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)):
  - Verification required before a public launch (unless an exception applies — personal use, dev/testing, internal-only — none of which fit strangers on a public site).
  - **No CASA security assessment.** The annual third-party security assessment is required only for restricted scopes, and only when the app accesses restricted data "from or through a third-party server". Open Expenses has no server and uses a sensitive scope, so it never applies — at any scale, small or large.
  - **No annual re-verification.** Annual recertification is a restricted-scope requirement ([Annual re-verification](https://support.google.com/cloud/answer/13463816)).
  - Sensitive-scope verification is comparatively light: brand verification (automated, usually minutes to 2–3 business days) + data-access review (typically **3–5 business days**).
- The scope choice in ADR 0004 is correct and should not change. Full `drive` would move the app into restricted-scope territory (security assessment, annual recertification, several-week review).

## Fact 3 — What sensitive-scope verification demands (current process)

From [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) and [Submitting your app for verification](https://support.google.com/cloud/answer/13461325):

1. **Brand verification first** (Cloud Console OAuth Branding page):
   - App name, logo, user-support email, developer contact email.
   - **Domain ownership verified via Google Search Console** for the authorized domain (the domain must be associated with an Owner/Editor of the Cloud project).
   - **Public home page**: publicly reachable (not behind a login), clearly relevant to the app, must describe the app's functionality and link to the privacy policy (and optionally terms of service). A Play Store or Facebook page does not count.
   - Automated review usually completes in minutes; compliant results are valid for 7 days, so you must click "Publish branding" within that window or re-verify.
2. **Data-access (scope) verification** via the Verification Center:
   - Declare all scopes on the Data Access page; `drive.file` will be grouped under *sensitive*.
   - **Per-scope justification**: what the app uses the scope for, and why no narrower scope exists. For us: "drive.file lets the app create and update a single `open-expenses-backup.json` file in the user's own Drive; no narrower Drive scope can create and manage one app-owned file."
   - **Demo video** (uploaded to YouTube as unlisted, link submitted): show the OAuth grant flow in English, the consent screen displaying the app name, the browser address bar showing the OAuth client ID, and the app using the granted scope (i.e., actually backing up/restoring the file).
   - Google's Trust & Safety team may follow up by email.
3. **Timing to budget into launch:** brand ~2–3 business days, data access ~3–5 business days; do it before launch week.

## Fact 4 — Privacy policy: yes, Google requires one even for an app that "collects nothing"

- The privacy policy is a hard requirement of verification: it must be publicly visible, **hosted on the same domain as the home page**, and linked from the OAuth consent screen configuration. It must "disclose the manner in which your application accesses, uses, stores, or shares Google user data", and data use must be limited to what the policy discloses ([Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification); [App verification FAQ](https://support.google.com/cloud/answer/9110914)).
- The app *does* access Google user data (it writes a file into the user's Drive and handles an OAuth access token in the browser), so "we collect nothing" is not a valid empty policy. A minimal, honest policy for this app should state:
  - What the app accesses: it creates and maintains **one file** (`open-expenses-backup.json`) in the user's own Google Drive, using the `drive.file` scope; it cannot see any other Drive file.
  - Where data lives: entirely in the user's browser (local database, IndexedDB/localStorage) and in that user-owned Drive file. The app has **no backend, no accounts, no analytics**; backup data never passes through our servers.
  - What we don't do: no sharing, selling, transferring, or analyzing of Google user data; token stored only in the browser and revocable by disconnecting in Settings.
  - Contact email for privacy questions (same as the consent-screen support email).
  - A "Limited Use"-style commitment that the data is used only to provide the user-facing backup feature.
- The home page itself must exist and link to this policy — for a static PWA that means adding a public landing page + policy page to the deployed site before submitting verification.

## Fact 5 — Quotas and costs at small scale: a non-issue

Drive API usage limits ([Usage limits](https://developers.google.com/workspace/drive/api/guides/limits), updated May 2026 quota model):

- Per minute per project: **1,000,000 quota units**. Per minute per user per project: **325,000 quota units**.
- Per-method cost: read (`files.get`) 5 units; list (`files.list`) 100; download 200; edit/upload (`files.update`/create) 50.
- A single backup/restore is one `files.list` + one upload (or one download) — a few hundred units, i.e. ~0.05% of the per-user per-minute quota. Even hundreds of daily users never approach the limits.
- Per-day per-project billing threshold: 400,000,000 quota units — usage under it incurs **no charge**; Google says full billing details will be shared later in 2026 with at least 90 days' notice. The Drive API is otherwise free to use.
- User-level constraints: 750 GB/day upload per user, 5 TB max file — irrelevant for a JSON backup of expenses.
- Storage: the backup file counts against **the user's own** Drive quota (it is their file), not ours. No storage cost to the project.

## Launch checklist — what the launch spec must include

Everything below must be true before real, anonymous users can back up to Drive reliably:

1. **Consent screen published to "In production"** in the Google Cloud Console project (Testing mode blocks all but 100 test users).
2. **Brand verification completed**: app name/logo, support + developer contact emails, authorized production domain verified in Search Console.
3. **Public home page** on the production domain: describes the app, links to the privacy policy (and optionally terms). Not login-walled.
4. **Privacy policy published** on the same domain, disclosing exactly how the app accesses/uses/stores/shares Google user data (single app-owned Drive file, local-only data, no servers, no sharing), linked from the consent screen config. Content per Fact 4.
5. **Sensitive-scope verification submitted and approved** for `https://www.googleapis.com/auth/drive.file` (Data Access page in the Verification Center): scope justification + unlisted YouTube demo video showing consent flow in English, app name on consent screen, client ID in address bar, and backup/restore in action. Budget ~1–2 weeks end to end.
6. **Production origin registered**: the deployed HTTPS origin added to the OAuth client's Authorized JavaScript origins (localhost origins stay dev-only).
7. **Client ID shipped for production** in `src/index.html` (`google-client-id` meta) pointing at the verified project.
8. **No restricted scope ever introduced** (no full `drive`, no `drive.metadata`): upgrading would trigger the CASA security assessment + annual re-verification path. If more Drive capability is ever needed, prefer `drive.appdata`/`drive.file`-class scopes.
9. **Token expiry UX handled** (already implemented, keep it): app treats the ~1-hour access token as ephemeral and silently re-prompts via `requestAccessToken()` when absent/expired; no code depending on long-lived tokens.
10. **Quota awareness in spec** (informational): single-file backup pattern is ~250 quota units per backup; per-user limit 325k units/min — no action needed, just don't add polling or batch jobs against Drive.
11. **Doc fix (non-blocking)**: update `docs/google-drive-setup.md` to describe the actual GIS implicit token flow (not "OAuth 2.0 with PKCE") and add the production/verification steps above.

## Sources

All fetched September 2026; "last updated" dates as shown on each page:

- [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) — publishing statuses, 100-user caps, 7-day refresh-token expiry in Testing (updated 2026-05-22)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes) — scope strings and descriptions
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — verification steps, home page + privacy policy requirements, demo video, 3–5 business days (updated 2026-08-19)
- [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) — CASA security assessment, annual re-verification, permitted app types (updated 2026-08-19)
- [Restricted Scopes (Cloud Console Help)](https://support.google.com/cloud/answer/13464325) — authoritative restricted-scope list; Drive restricted scopes exclude `drive.file`
- [OAuth App Verification Help Center](https://support.google.com/cloud/answer/9110914) — verification hub, brand verification vs scope verification
- [Drive API Usage limits](https://developers.google.com/workspace/drive/api/guides/limits) — May 2026 quota model, per-method units, daily billing threshold
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) — Limited Use requirements referenced by the privacy-policy rules
