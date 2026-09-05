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

  it('lands on the public landing when the app is launched with no path', async () => {
    await router.navigateByUrl('/');
    expect(router.url).toBe('/');
  });

  it('resolves the Stats route', async () => {
    await router.navigateByUrl('/stats');
    expect(router.url).toBe('/stats');
  });

  it('resolves the public Privacy route', async () => {
    await router.navigateByUrl('/privacy');
    expect(router.url).toBe('/privacy');
  });

  it('redirects the legacy dashboard route to Stats for existing deep links', async () => {
    await router.navigateByUrl('/dashboard');
    expect(router.url).toBe('/stats');
  });

  it('registers the public landing surface outside the shell', () => {
    const landing = routes.find((r) => r.path === '' && r.loadComponent && !r.children);
    expect(landing).toBeDefined();
  });

  it('registers the public Privacy surface outside the shell', () => {
    const privacy = routes.find((r) => r.path === 'privacy' && r.loadComponent && !r.children);
    expect(privacy).toBeDefined();
  });

  it('registers the Stats surface and the legacy dashboard redirect', () => {
    const shell = routes.find((r) => r.path === '' && !!r.children);
    const stats = shell?.children?.find((r) => r.path === 'stats');
    expect(stats).toBeDefined();
    const legacy = shell?.children?.find((r) => r.path === 'dashboard');
    expect(legacy?.redirectTo).toBe('stats');
  });
});
