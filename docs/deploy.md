# Cloudflare Pages Deploy Setup

Every push to `main` builds the app and deploys it to Cloudflare Pages; every pull request gets its own preview deployment. Deploys are atomic, and the site is served from the project root so the service worker scope is `/` (see ADR 0016 for the canonical apex origin).

## How the pipeline works

`.github/workflows/deploy.yml` runs on pushes to `main` and on pull requests:

1. `npm ci` + `npm run build` (Angular production build, output in `dist/open-expenses/browser`)
2. `cloudflare/wrangler-action@v3` runs `pages deploy dist/open-expenses/browser --project-name=open-expenses --branch=<head branch>`

- Deploys whose branch matches the project's production branch (`main`) go live on the production domain.
- Any other branch (PR head branches) becomes a preview deployment with a stable alias URL, printed to the workflow run summary.
- Until the two repo secrets below exist, the deploy steps skip with a notice instead of failing the run.

## Caching contract

`public/_headers` is copied into the build output and read by Pages:

- Hashed assets (`*.js`, `*.css`, plus `/media/*` for future media assets) get `Cache-Control: public, max-age=31536000, immutable`.
- `index.html`, `ngsw.json`, and the Angular service worker scripts keep the Pages defaults so the service worker's update check picks up redeploys immediately. The worker scripts explicitly reset `Cache-Control` with `! Cache-Control` so they never inherit the immutable rule.

SPA fallback needs no configuration: the build output has no top-level `404.html`, so Pages serves `index.html` for unmatched routes and Angular's router takes over.

This contract is enforced by `src/deploy.spec.ts`.

## Owner setup (one time)

Run the wizard, which walks you through every step and sets the secrets via `gh`:

```bash
bash scripts/setup-cloudflare-pages.sh
```

Or do it by hand:

1. Log in to [Cloudflare](https://dash.cloudflare.com/).
2. Create the Pages project named `open-expenses` with `main` as its production branch:
   `npx wrangler pages project create open-expenses --production-branch=main`
3. Create an API token with the **Cloudflare Pages — Edit** template (or a custom token with Account → Cloudflare Pages → Edit permissions).
4. Add both repo secrets (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

## Custom domain

`public/_redirects` 301s `www.openexpenses.app` to the apex `openexpenses.app`, the app's canonical origin (ADR 0016). Pointing the domain's DNS at Pages is an owner step tracked separately.

## Self-host fallback

GitHub Pages remains a documented self-host fallback; it is not wired up.
