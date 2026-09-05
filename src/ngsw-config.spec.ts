import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configSource = readFileSync(resolve(process.cwd(), 'ngsw-config.json'), 'utf8');
const angularJsonSource = readFileSync(resolve(process.cwd(), 'angular.json'), 'utf8');
const appConfigSource = readFileSync(resolve(process.cwd(), 'src/app/app.config.ts'), 'utf8');
const indexSource = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf8');

const FONT_URLS = [
  '/fonts/inter-variable-latin.woff2',
  '/fonts/jetbrains-mono-500-latin.woff2',
];

describe('offline font contract', () => {
  it('prefetches the self-hosted fonts so installed PWAs render them offline', () => {
    const config = JSON.parse(configSource);
    const fontsGroup = config.assetGroups.find(
      (group: { name: string }) => group.name === 'fonts',
    );
    expect(fontsGroup).toBeDefined();
    expect(fontsGroup.installMode).toBe('prefetch');
    expect(fontsGroup.resources.files).toContain('/fonts/**');
    expect(config.index).toBe('/index.html');
  });

  it('preloads the fonts used at first paint to avoid a flash of fallback text', () => {
    const preloaded = [...indexSource.matchAll(/rel="preload"[^>]*href="([^"]+)"/g)].map(
      (match) => match[1],
    );
    for (const url of FONT_URLS) {
      expect(preloaded).toContain(url);
    }
  });
});

describe('service worker build contract', () => {
  it('is wired into the production build so ngsw.json is emitted', () => {
    expect(angularJsonSource).toContain('"serviceWorker": "ngsw-config.json"');
  });

  it('is registered outside dev mode, on stability, and never caches its own script', () => {
    expect(appConfigSource).toContain("provideServiceWorker('ngsw.json'");
    expect(appConfigSource).toContain('enabled: !isDevMode()');
    expect(appConfigSource).toContain("registrationStrategy: 'registerWhenStable:30000'");
    expect(appConfigSource).toContain("updateViaCache: 'none'");
  });
});
