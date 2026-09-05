# OAuth Consent Screen Configuration

Every value needed to fill in Google Cloud Console's OAuth consent screen (now called "Google Auth Platform" → "Branding" and "Audience" pages) for the production Open Expenses project. Assembled for issue #135; the owner enters these values and publishes.

## Branding page

| Field | Value |
| --- | --- |
| App name | `Open Expenses` |
| User support email | `contact@openexpenses.app` |
| App logo | `public/icons/icon.svg` |
| App home page | `https://openexpenses.app` |
| Privacy policy URL | `https://openexpenses.app/privacy` |
| Terms of service URL | leave empty (none published) |
| Authorized domain 1 | `openexpenses.app` |

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

1. **Publish the consent screen to In production** on the Audience page. Google shows a warning that unverified apps with sensitive scopes trigger an "unverified app" screen; that screen disappears once verification below is approved. Publishing costs nothing.
2. **Brand verification**: verify domain ownership of `openexpenses.app` in [Google Search Console](https://search.google.com/search-console/) (DNS record verification on the domain property is the cleanest path; the domain lives in Cloudflare, so a TXT record is a two-minute change). Search Console verification of the home-page domain is what Google uses to approve the branding above. This is the same ownership check as the domain ticket (#134), which is already live.
3. **Sensitive-scope verification**: on the Data access page (or via the verification email link), request verification for `drive.file`. Submit the justification text from [sensitive-scope-justification.md](sensitive-scope-justification.md) and the demo video from [demo-video-script.md](demo-video-script.md), recorded, uploaded to YouTube as **unlisted**, in **English**.
4. **Add the production origin**: on Credentials → the OAuth 2.0 client, add `https://openexpenses.app` under **Authorized JavaScript origins**. Keep `http://localhost:4200` for local development. The client ID may be reused or a new production client created; either way the one wired into the app must list the apex origin (ADR 0016 — no `www`, the redirect rule already handles it).
5. **Put the production client ID in `src/index.html`**: replace the meta tag's content:

   ```html
   <meta name="google-client-id" content="PRODUCTION_CLIENT_ID.apps.googleusercontent.com">
   ```

   This is the only code change left in #135 and it is owner-gated: it cannot happen before step 4 exists.

## Acceptance check

After steps 1–5, connect Google Drive from a Google account that is not on the test-users list. The consent popup must appear with the verified branding and the single `drive.file` scope, with no "unverified app" or "Google hasn't verified this app" warning screen. That is the final acceptance criterion of #135.
