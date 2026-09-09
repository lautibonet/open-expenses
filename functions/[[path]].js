/**
 * Cloudflare Pages Function: strict asset 404.
 *
 * A catch-all Function is invoked for every request, so it must ask the
 * asset pipeline (`env.ASSETS.fetch`) for the path first and pass real
 * assets through untouched. The branch that matters: when an asset-shaped
 * path comes back as the SPA's HTML — the asset pipeline papers over a miss
 * with its own fallback — the Function refuses it with a real 404. Serving
 * index.html for a missing hashed asset would let the `/*.js` header rule
 * stamp `immutable` onto an HTML body and cache the poison at the edge for
 * a year — the blank-page incident of September 2026.
 */
const ASSET_PATH = /\.[a-z0-9]+$/i;

const notFound = () =>
  new Response('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;

  const direct = await env.ASSETS.fetch(new Request(new URL(path, url)));
  const type = direct.headers.get('content-type') ?? '';
  const isHtml = type.includes('text/html');

  // An asset request answered with HTML is the fallback masquerading as an
  // asset: exactly the response that poisons the edge cache. /index.html
  // itself is the one legitimate HTML asset.
  if (isHtml && path !== '/index.html' && ASSET_PATH.test(path)) {
    return notFound();
  }
  if (direct.status !== 404) {
    return direct;
  }

  // A genuine miss: routes get the SPA index, assets stay 404.
  if (ASSET_PATH.test(path)) {
    return notFound();
  }
  return env.ASSETS.fetch(new Request(new URL('/index.html', url)));
}
