/**
 * Cloudflare Pages Function: strict asset 404.
 *
 * Invoked only for paths that do not match a static asset. Routes fall
 * through to the SPA's index.html (Pages' own fallback); a request for an
 * asset-shaped path that the current deployment does not have must return
 * a real 404. Serving index.html there would let the `/*.js` header rule
 * stamp `immutable` onto an HTML body and cache the poison at the edge for
 * a year — the blank-page incident of September 2026.
 */
const ASSET_PATH = /\.[a-z0-9]+$/i;

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (!ASSET_PATH.test(url.pathname)) {
    return env.ASSETS.fetch(new Request(new URL('/index.html', url)));
  }
  return new Response('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
