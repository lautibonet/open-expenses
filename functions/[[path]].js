/**
 * Cloudflare Pages Function: strict asset 404.
 *
 * A catch-all Function is invoked for every request, so it must proxy
 * static assets through `env.ASSETS.fetch` first. Only when the asset
 * genuinely misses does it branch: routes fall through to the SPA's
 * index.html (Pages' own fallback); asset-shaped paths get a real 404.
 * Serving index.html for a missing hashed asset would let the `/*.js`
 * header rule stamp `immutable` onto an HTML body and cache the poison
 * at the edge for a year — the blank-page incident of September 2026.
 */
const ASSET_PATH = /\.[a-z0-9]+$/i;

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const asset = await env.ASSETS.fetch(new Request(new URL(url.pathname, url)));
  if (asset.status !== 404) {
    return asset;
  }
  if (ASSET_PATH.test(url.pathname)) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
  return env.ASSETS.fetch(new Request(new URL('/index.html', url)));
}
