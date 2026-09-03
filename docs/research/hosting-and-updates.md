# Research: Where to host Open Expenses and how updates reach users

Resolves [issue #118](https://github.com/lautibonet/open-expenses/issues/118) (part of the launch map, #117).

**Date:** 2026-09-03
**Scope:** Static Angular 21 PWA, SPA routing, no backend, public GitHub repo, hosted-web-first distribution.
**Method:** Primary sources only — provider docs (Cloudflare, GitHub, Vercel) and Angular service-worker docs/source, all cited inline.

---

## TL;DR — Recommendation

> **Host Open Expenses on Cloudflare Pages (Free plan), deployed by a GitHub Actions workflow that builds the Angular app and runs `cloudflare/wrangler-action@v3` with `pages deploy dist/... --project-name=open-expenses` on every push to `main` (PRs get preview deployments automatically). Serve at the apex/root of a custom domain (or the `*.pages.dev` subdomain) so the Angular service worker registers with root scope. Before launch, add `@angular/pwa` to the repo (it is not installed today) and ship an "update available" prompt that listens to `SwUpdate.versionUpdates`, filters for `VERSION_READY`, asks the user to confirm, and reloads the page — never calling `activateUpdate()` without a reload.**

Quotable one-liner for the launch spec:

> "Open Expenses is hosted on Cloudflare Pages (free tier), deployed from GitHub Actions via wrangler on every push to `main`; users get updates through the Angular service worker, which detects the new deployment on the next open/refresh, downloads it in the background, and an in-app 'update available' prompt reloads the tab to activate it."

---

## 1. Provider comparison

### 1.1 GitHub Pages

| Aspect | Finding | Source |
|---|---|---|
| Free tier | Free for public repos; published site ≤ 1 GB; **soft bandwidth limit 100 GB/month**; 10 builds/hour soft limit (waived when publishing via a custom GitHub Actions workflow); deploys time out at 10 min | [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| Deploy ergonomics | Excellent: first-party `actions/deploy-pages` workflow, push-to-deploy from `main`, no third-party account needed | [docs.github.com Pages](https://docs.github.com/en/pages) |
| Custom domains | Supported (apex, www, and `*.github.io`) | [Configuring a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-github-pages-site) |
| SPA fallback | **Not native.** Unmatched routes return a 404; the standard workaround is copying `index.html` to `404.html` so the SPA bootstraps on deep links | [GitHub Pages limits / 404 handling](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits); well-known 404.html SPA pattern |
| Headers control | **None.** You cannot set `Cache-Control` or security headers; GitHub/Fastly default headers apply | GitHub Pages docs expose no custom-header mechanism (no `_headers`/config equivalent) |
| PWA suitability | Works (Angular SW fetches `ngsw.json` with a `?ngsw-cache-bust=` query param, bypassing HTTP cache), but: subpath hosting (`/repo/`) complicates `baseHref`, service-worker scope, and any future apex-domain migration; and "service workers don't work behind redirect" — an apex↔www redirect breaks the SW | [Angular devops: Changing your application's location](https://angular.dev/ecosystem/service-workers/devops#changing-your-applications-location); [Angular getting started: update checks](https://angular.dev/ecosystem/service-workers/devops#update-checks) |

**Verdict:** cheapest, zero-vendor option and fine as a self-host escape hatch, but no header control, no native SPA fallback, and the subpath/redirect quirks make it the weakest PWA home.

### 1.2 Vercel (Hobby)

| Aspect | Finding | Source |
|---|---|---|
| Free tier | Hobby: 100 deployments/day, 45-min builds, 100 MB static upload via CLI, 50 domains/project, 200 projects | [Vercel limits](https://vercel.com/docs/limits) |
| Deploy ergonomics | Best-in-class git integration, **but deploying from GitHub Actions** (rather than Vercel's own git app) requires the `vercel` CLI + a scoped token with `--prebuilt` — extra vendor coupling in CI | [Vercel CLI deploy docs](https://vercel.com/docs/cli/deploy) |
| Custom domains | Supported, easy | [Vercel domains docs](https://vercel.com/docs/domains) |
| SPA fallback | Native: framework preset / `vercel.json` rewrites unmatched routes to `index.html` | [vercel.json rewrites](https://vercel.com/docs/project-configuration/vercel-json#rewrites) |
| Headers control | Full, via `vercel.json` `headers` | [vercel.json headers](https://vercel.com/docs/project-configuration/vercel-json#headers) |
| PWA suitability | Good, **but** the Hobby plan is explicitly for **personal, non-commercial** use — worth re-reading the fair-use policy if the project ever grows beyond that | [Vercel limits / plans](https://vercel.com/docs/limits) |

**Verdict:** great DX, but the GitHub-Actions deploy path is second-class (Vercel wants you on their git integration), and Hobby's non-commercial framing adds a policy caveat for a public project.

### 1.3 Cloudflare Pages ✅

| Aspect | Finding | Source |
|---|---|---|
| Free tier | **Unlimited requests & bandwidth** for static assets; 500 builds/month via Git integration (bypassed entirely by deploying prebuilt output from GitHub Actions via Direct Upload); 20,000 files/site; 25 MiB/file; unlimited preview deployments; 100 projects | [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) |
| Deploy ergonomics | First-party `cloudflare/wrangler-action@v3` for GitHub Actions: build in Actions, `pages deploy <dir> --project-name=...` with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets; documented verbatim for GitHub Actions | [Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) |
| Custom domains | Up to 100 custom domains per project on Free, automatic TLS | [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) |
| SPA fallback | **Native and automatic:** "If your project does not include a top-level `404.html` file, Pages assumes that you are deploying a single-page application... matches all incoming paths to the root" | [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering) |
| Headers control | Yes — a `_headers` file in the build output adds/overrides headers (up to 100 rules), e.g. `Cache-Control: public, max-age=31556952, immutable` for hashed `/browser/*` assets; default is `Cache-Control: public, max-age=0, must-revalidate`, which is exactly what `index.html` and `ngsw.json` want | [Headers](https://developers.cloudflare.com/pages/configuration/headers/); [Serving Pages – caching](https://developers.cloudflare.com/pages/configuration/serving-pages/#caching-and-performance) |
| PWA suitability | Best of the three: root-domain hosting → service worker scope `/`; **atomic deployments** (each deploy is an immutable version swapped atomically), eliminating the partial-deployment hash-mismatch failure mode Angular warns about | [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/); [Angular devops: Hash mismatches](https://angular.dev/ecosystem/service-workers/devops#hash-mismatches) |

**Verdict:** wins on every axis this app cares about — free forever at any realistic scale, native SPA fallback, `_headers` control for PWA-correct caching, atomic deploys (safe for hash-verified Angular SW updates), and a first-party GitHub Actions deploy path.

---

## 2. Angular service worker: how updates actually reach users

### 2.1 Current state of this repo

**The app has no service worker today.** There is no `ngsw-config.json`, no `@angular/pwa` dependency, and no `provideServiceWorker(...)` call anywhere in `src/`. "PWA" in the README currently means installability metadata only. Adding the worker is a launch prerequisite:

```
ng add @angular/pwa
```

This adds `@angular/service-worker`, generates `ngsw-config.json`, registers the worker via `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() })`, and adds the manifest + icons ([Angular getting started](https://angular.dev/ecosystem/service-workers/getting-started)).

### 2.2 Versioning and update flow (production)

- A "version" is the whole set of hashed resources described by the `ngsw.json` manifest (generated at build time from `ngsw-config.json`). Any file change → new manifest hash → new version ([Angular devops: Application versions](https://angular.dev/ecosystem/service-workers/devops#application-versions)).
- "Every time the user opens or refreshes the application, the Angular service worker checks for updates to the application by looking for updates to the `ngsw.json` manifest. If an update is found, it is downloaded and cached automatically, and is served the next time the application is loaded." ([Update checks](https://angular.dev/ecosystem/service-workers/devops#update-checks))
- **Speed-before-freshness:** the worker serves the version it has installed immediately, without waiting for an update check — so a user sees the deployed new version on their **next** open/refresh, not the current one ([getting-started tour](https://angular.dev/ecosystem/service-workers/getting-started#updating-your-application-in-the-browser)).
- The check itself fetches `/ngsw.json?ngsw-cache-bust=<random>`, which defeats any HTTP cache — this is why Cloudflare's `max-age=0, must-revalidate` default (or even aggressive CDN caching) does not strand users on old manifests ([getting-started](https://angular.dev/ecosystem/service-workers/getting-started#making-changes-to-your-application)).
- A running tab keeps its version forever unless it reloads, the version fails hash validation, or `SwUpdate` activates an update; a newly-opened tab always gets the latest installed version ([Application tabs](https://angular.dev/ecosystem/service-workers/devops#application-tabs)).

### 2.3 Staleness pitfalls and mitigations

| Pitfall | Mitigation |
|---|---|
| Long-lived/installed tabs never see the update (SW serves cached version instantly) | Add `SwUpdate`-based prompt (below) and/or periodic `checkForUpdate()`; docs sample polls every 6 h after app stability ([communications: Checking for updates](https://angular.dev/ecosystem/service-workers/communications#checking-for-updates)) |
| Calling `activateUpdate()` without reloading "could break the application" via shell/lazy-chunk version mismatch | **Never do it.** Update by `document.location.reload()` after user confirmation ([SwUpdate API](https://angular.dev/api/service-worker/SwUpdate): "In most cases, you should not use this method and instead should update a client by reloading the page") |
| Hash mismatch → version rejected (stale CDN layers, non-atomic deploys) | Cloudflare Pages deployments are atomic/immutable per-deploy, addressing Angular's listed causes directly ([devops: Hashed content](https://angular.dev/ecosystem/service-workers/devops#hashed-content); [CF Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)) |
| Worker script itself cached stale by the browser | Set `updateViaCache` on `provideServiceWorker` (e.g. `'none'`) to bypass the HTTP cache for `ngsw-worker.js` ([getting-started: updateViaCache](https://angular.dev/ecosystem/service-workers/getting-started#cache-control-with-updateviacache)) |
| Broken/degraded states | `SwUpdate.unrecoverable` → force a reload; failsafe: a 404 on `ngsw.json` makes the worker unregister itself and purge caches ([devops: Fail-safe](https://angular.dev/ecosystem/service-workers/devops#service-worker-safety)) |
| SW behind a redirect (`example.com` → `www.example.com`) stops working | Serve at one canonical origin from day one; don't introduce a root redirect later ([devops: Changing your application's location](https://angular.dev/ecosystem/service-workers/devops#changing-your-applications-location)) |

### 2.4 Is an "update available" prompt recommended?

**Yes.** Angular's own docs describe exactly this pattern: `VersionReadyEvent` "may be used to notify the user of an available update or prompt them to refresh the page", and: "To avoid disrupting the user's progress, it is generally a good idea to prompt the user and let them confirm that it is OK to reload the page and update to the latest version." ([communications](https://angular.dev/ecosystem/service-workers/communications#version-updates), [#updating-to-the-latest-version](https://angular.dev/ecosystem/service-workers/communications#updating-to-the-latest-version))

Minimal shape (only add ~this once `@angular/pwa` lands):

```ts
inject(SwUpdate).versionUpdates
  .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
  .subscribe(() => { /* show "Update available — refresh?" */ if (confirm) document.location.reload(); });
```

Plus the 6-hour `checkForUpdate()` polling from the same docs page, and an `unrecoverable` handler that reloads.

---

## 3. Decision

| Criterion | GitHub Pages | Vercel Hobby | Cloudflare Pages |
|---|---|---|---|
| Free-tier fit for a public, potentially popular PWA | Soft 100 GB/mo bandwidth | Non-commercial ToS caveat | ✅ Unlimited bandwidth/requests |
| GitHub Actions deploy | ✅ First-party | CLI+token workaround | ✅ First-party (`wrangler-action`) |
| SPA fallback | ❌ 404.html hack | ✅ | ✅ Automatic |
| Custom domains | ✅ | ✅ | ✅ (100/project free) |
| Headers control (PWA caching) | ❌ | ✅ | ✅ (`_headers`) |
| Atomic deploys safe for hash-verified Angular SW | Basic | ✅ | ✅ |
| Root-domain serving (SW scope `/`) | Subpath unless custom domain | ✅ | ✅ |

**Winner: Cloudflare Pages.** GitHub Pages remains the documented self-host fallback path (works with the same `ngsw-config.json`, just needs the `404.html` copy trick and accepting default headers), which fits the "hosted web app first, repo as self-host path" distribution decision.

## 4. Recommended deploy flow (concrete)

1. `ng add @angular/pwa`; keep `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() })`.
2. Add `.github/workflows/deploy.yml`: on push to `main` (and `pull_request` for previews) → `npm ci && npm run build` → `cloudflare/wrangler-action@v3` with `command: pages deploy dist/open-expenses/browser --project-name=open-expenses`, secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` ([CF docs give this workflow verbatim](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)).
3. Optional `_headers` in build output for immutable hashed assets + security headers.
4. Add the `VersionReadyEvent` prompt + 6 h `checkForUpdate()` polling + `unrecoverable` reload handler.
5. Attach the custom domain at the apex; no root redirects ever.

## Sources

- Cloudflare Pages: [Limits](https://developers.cloudflare.com/pages/platform/limits/), [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/), [Headers](https://developers.cloudflare.com/pages/configuration/headers/), [Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- GitHub Pages: [Limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)
- Vercel: [Limits](https://vercel.com/docs/limits)
- Angular: [Service Workers overview](https://angular.dev/ecosystem/service-workers), [Getting started](https://angular.dev/ecosystem/service-workers/getting-started), [Configuration file](https://angular.dev/ecosystem/service-workers/config), [Communicating with the service worker](https://angular.dev/ecosystem/service-workers/communications), [Devops](https://angular.dev/ecosystem/service-workers/devops), [SwUpdate API](https://angular.dev/api/service-worker/SwUpdate), [angular/angular `update.ts`](https://github.com/angular/angular/blob/main/packages/service-worker/src/update.ts)
