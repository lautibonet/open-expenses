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
