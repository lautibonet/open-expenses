# 0016 - The canonical origin is the apex domain, no www

The production site is served at `openexpenses.app` (#126, launch spec #127), but `www.openexpenses.app` also exists as a DNS record people may type or paste. If both origins served content without a redirect, the PWA's service worker could be registered on either one and installed PWAs could end up pinned to whichever origin they first loaded — a user who lands on `www` would then be broken by any future change on the apex side, and the two origins would hold two independent service-worker caches and two independent installs.

We decide the **canonical origin is the apex, `https://openexpenses.app`, with no `www`**. The PWA manifest encodes it (`id` is the apex origin), and a Cloudflare Pages `_redirects` rule 301s every `https://www.openexpenses.app/*` request to the apex (`public/_redirects`). A request may only reach this app through the apex or through that redirect, so the service worker's scope, the manifest identity, and the OAuth origin (#119) all live on a single origin and never break behind a hostname change.

Consequences: the Pages project must attach `openexpenses.app` as the custom domain (the owner-side step in launch Phase 4); `www` may be attached as a custom domain too, solely so the redirect rule can run, or redirected at the Cloudflare zone level — either way, no content is ever served on `www`. Self-hosters get the redirect file for free if they use the deployed layout, but must reproduce the apex-only guarantee themselves if they choose a different origin.

