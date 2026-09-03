import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const swSource = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
const indexSource = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf8');

const FONT_URLS = [
  '/fonts/inter-variable-latin.woff2',
  '/fonts/jetbrains-mono-500-latin.woff2',
];

function precacheUrls(source: string): string[] {
  const list = source.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
  if (!list) {
    throw new Error('PRECACHE_URLS not found in public/sw.js');
  }
  return [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

describe('offline font contract', () => {
  it('precaches the self-hosted fonts so installed PWAs render them offline', () => {
    const urls = precacheUrls(swSource);
    for (const url of FONT_URLS) {
      expect(urls).toContain(url);
    }
  });

  it('preloads the fonts used at first paint to avoid a flash of fallback text', () => {
    const preloaded = [...indexSource.matchAll(/rel="preload"[^>]*href="([^"]+)"/g)].map(
      (match) => match[1],
    );
    for (const url of FONT_URLS) {
      expect(preloaded).toContain(url);
    }
  });

  it('bumps the cache name so installed PWAs re-fetch the new assets', () => {
    expect(swSource).toContain("const CACHE_NAME = 'open-expenses-v2'");
  });
});
