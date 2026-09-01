import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';

describe('app routes', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    router = TestBed.inject(Router);
  });

  it('lands on Movements when the app is launched with no path', async () => {
    await router.navigateByUrl('/');
    expect(router.url).toBe('/movements');
  });

  it('resolves the Stats route', async () => {
    await router.navigateByUrl('/stats');
    expect(router.url).toBe('/stats');
  });

  it('redirects the legacy dashboard route to Stats for existing deep links', async () => {
    await router.navigateByUrl('/dashboard');
    expect(router.url).toBe('/stats');
  });

  it('registers the Stats surface and the legacy dashboard redirect', () => {
    const shell = routes.find((r) => r.path === '');
    const stats = shell?.children?.find((r) => r.path === 'stats');
    expect(stats).toBeDefined();
    const legacy = shell?.children?.find((r) => r.path === 'dashboard');
    expect(legacy?.redirectTo).toBe('stats');
  });
});
