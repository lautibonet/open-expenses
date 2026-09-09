import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const headersSource = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');
const redirectsSource = readFileSync(resolve(process.cwd(), 'public/_redirects'), 'utf8');
const workflowSource = readFileSync(
  resolve(process.cwd(), '.github/workflows/deploy.yml'),
  'utf8',
);

const effectiveRules = headersSource
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

describe('Cloudflare Pages caching contract', () => {
  it('caches hashed JS and CSS assets forever', () => {
    for (const pattern of ['/*.js', '/*.css']) {
      const rule = new RegExp(
        `${pattern.replace('*', '\\*')}\\s+Cache-Control: public, max-age=31536000, immutable`,
      );
      expect(effectiveRules).toMatch(rule);
    }
  });

  it('never pins the Angular service worker scripts', () => {
    for (const worker of ['/ngsw-worker.js', '/safety-worker.js', '/worker-basic.min.js']) {
      const rule = new RegExp(`${worker}\\s+! Cache-Control`);
      expect(effectiveRules).toMatch(rule);
    }
  });

  it('leaves index.html and ngsw.json on the Pages defaults so redeploys are picked up', () => {
    expect(effectiveRules).not.toMatch(/\/index\.html(?![\w.])/);
    expect(effectiveRules).not.toMatch(/\/ngsw\.json(?![\w.])/);
  });
});

describe('canonical origin contract', () => {
  it('redirects www to the apex with a permanent redirect', () => {
    expect(redirectsSource).toMatch(
      /^https:\/\/www\.openexpenses\.app\/\* https:\/\/openexpenses\.app\/:splat 301$/m,
    );
  });
});

describe('Pages deploy pipeline contract', () => {
  it('runs on pushes to main and on pull requests', () => {
    expect(workflowSource).toMatch(/on:/);
    expect(workflowSource).toMatch(/branches:\s*\n\s*-\s*'?main'?/);
    expect(workflowSource).toMatch(/pull_request:/);
  });

  it('builds the production bundle before deploying', () => {
    expect(workflowSource).toContain('npm ci');
    expect(workflowSource).toMatch(/run:\s*npm run build/);
  });

  it('deploys the browser output root through wrangler-action v3', () => {
    expect(workflowSource).toContain('cloudflare/wrangler-action@v3');
    expect(workflowSource).toContain('pages deploy dist/open-expenses/browser');
  });

  it('targets the open-expenses Pages project with both repo secrets', () => {
    expect(workflowSource).toContain('--project-name=open-expenses');
    expect(workflowSource).toContain('secrets.CLOUDFLARE_API_TOKEN');
    expect(workflowSource).toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
  });

  it('deploys to main as production and to the PR head branch as a preview', () => {
    expect(workflowSource).toMatch(
      /--branch=\$\{\{\s*github\.head_ref \|\| github\.ref_name\s*\}\}/,
    );
  });

  it('skips the deploy steps while the owner secrets are missing instead of going red', () => {
    const guards = workflowSource.match(
      /if:\s*\$\{\{\s*env\.CLOUDFLARE_API_TOKEN (==|!=) ''/g,
    );
    expect(guards ?? []).toContain("if: ${{ env.CLOUDFLARE_API_TOKEN != ''");
    expect(guards ?? []).toContain("if: ${{ env.CLOUDFLARE_API_TOKEN == ''");
  });
});

describe('strict asset 404 contract', () => {
  // Loaded with a runtime import: the Function is a worker-runtime ES module
  // outside the TypeScript compilation, and the contract is behavioral, not
  // merely textual.
  let onRequest: (context: { request: Request; env: unknown }) => Promise<Response>;

  beforeAll(async () => {
    // @ts-expect-error worker ES module outside the TS program
    ({ onRequest } = await import('../functions/[[path]].js'));
  });

  /* A catch-all Function is invoked for every request, so the fake mimics
     the Pages asset pipeline as observed in production: deployed files
     resolve with their real type; a missing asset-shaped path is answered
     with the SPA's HTML (the fallback masquerade the Function must catch);
     a missing route path comes back as a genuine 404. */
  const deployed = new Set([
    '/index.html',
    '/main-33S5YQ4A.js',
    '/chunk-BKVAR53M.js',
    '/ngsw.json',
    '/styles-A5FP4VKE.css',
  ]);
  const env = {
    ASSETS: {
      fetch: async (req: Request) => {
        const path = new URL(req.url).pathname;
        if (deployed.has(path)) {
          const type = path.endsWith('.js')
            ? 'application/javascript'
            : path.endsWith('.css')
              ? 'text/css'
              : path.endsWith('.json')
                ? 'application/json'
                : 'text/html';
          return new Response('asset body', { status: 200, headers: { 'content-type': type } });
        }
        if (/\.[a-z0-9]+$/i.test(path)) {
          return new Response('index.html fallback', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          });
        }
        return new Response('no such asset', { status: 404 });
      },
    },
  };

  it('serves real assets through the asset pipeline', async () => {
    for (const path of ['/main-33S5YQ4A.js', '/chunk-BKVAR53M.js', '/ngsw.json']) {
      const res = await onRequest({ request: new Request(`https://openexpenses.app${path}`), env });
      expect(res.status).toBe(200);
    }
  });

  it('falls back to the SPA index for route requests that miss an asset', async () => {
    for (const path of ['/movements', '/stats', '/settings/erase', '/deep/route/path']) {
      const res = await onRequest({ request: new Request(`https://openexpenses.app${path}`), env });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
    }
  });

  it('returns a real 404 when an asset-shaped path is answered with the SPA fallback HTML', async () => {
    for (const path of ['/main-OLDHASH.js', '/missing.css', '/media/ghost.png']) {
      const res = await onRequest({ request: new Request(`https://openexpenses.app${path}`), env });
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toContain('text/plain');
    }
  });

  it('never caches the 404, so a future deployment carrying the asset cannot be shadowed', async () => {
    const res = await onRequest({
      request: new Request('https://openexpenses.app/main-OLDHASH.js'),
      env,
    });
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});
