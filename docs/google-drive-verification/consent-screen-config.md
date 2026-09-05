# OAuth Consent Screen Configuration

Every value needed to fill in Google Cloud Console's OAuth consent screen (now called "Google Auth Platform" → "Branding" and "Audience" pages) for the production Open Expenses project. Assembled for issue #135; the owner enters these values and publishes.

## Branding page

| Field | Value |
| --- | --- |
| App name | `Open Expenses` |
| User support email | a Google account owned by the operator (see note below) |
| App logo | `public/icons/icon.svg` |
| App home page | `https://openexpenses.app` |
| Privacy policy URL | `https://openexpenses.app/privacy` |
| Terms of service URL | leave empty (none published) |
| Authorized domain 1 | `openexpenses.app` |

The user support email must be a Google account or Google Group — Google's picker rejects plain domain addresses, and custom-domain groups now require paid Google Workspace. The operator's own Google account is used; the public-facing contact stays `contact@openexpenses.app` (the privacy policy page and the free-text **Developer contact email** field).

The privacy policy URL is a client-side route (`/privacy`, #132). Cloudflare Pages serves `index.html` for unmatched routes (see `docs/deploy.md`), so Google's crawler can fetch the rendered page from `https://openexpenses.app/privacy` without special handling. The app must be deployed to the apex domain before submitting; Google rejects URLs it cannot reach.

## Audience page

| Field | Value |
| --- | --- |
| User type | External |
| Publishing status | starts as **Testing**; publish to **In production** (owner step below) |
| Scopes | `https://www.googleapis.com/auth/drive.file` only |
| Test users | the owner's Google account (used while in Testing) |

## Data access (scopes) page

Add exactly one scope: `https://www.googleapis.com/auth/drive.file`. Never add the full `https://www.googleapis.com/auth/drive` scope or any other restricted scope: full `drive` is classified as restricted, which would require a CASA security assessment plus annual re-verification. `drive.file` is sensitive, which needs only this verification round. This constraint is settled in #119 and ADR 0004.

## Owner steps (gates issue #135, budget 1–2 weeks, free)

Completed 2026-09-05:

1. **Consent screen published to In production.** Google's console reports sensitive-scope verification as **not needed below 100 users**; the obligation activates (by console status change and email) when usage crosses that cap, at which point the justification and video below get submitted.
2. **Brand verification** — the Search Console domain-property verification done for the custom domain (#134) carries over; Branding shows verified.
3. **Sensitive-scope verification** — not required yet (see 1). The [justification](sensitive-scope-justification.md) and [demo video script](demo-video-script.md) are ready to submit when it becomes due.
4. **Production origin added**: `https://openexpenses.app` joined `http://localhost:4200` on the single OAuth client. One client serves both dev and production; the distinction lives in the publishing status, not the client.
5. **Client ID**: the existing client ID was reused, so `src/index.html` is unchanged — there is no separate production client ID to install.

Note for step 4: after saving a new origin, Google can serve stale client config for 10–30 minutes; a browser that saw the old config reports `origin_mismatch` (or a "does not comply with Google's OAuth 2.0 policy" block) even though the console is correct. Retry later from a fresh session before debugging further.

## Acceptance check

Connect Google Drive from a Google account that is not on the test-users list. The consent popup must show the verified branding and the single `drive.file` scope, with no "unverified app" or "Google hasn't verified this app" warning screen. Confirmed 2026-09-05 on a non-test account (#135 closed).
