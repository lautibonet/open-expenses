import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ProfileService } from './core/services/profile.service';
import { db } from './core/db/database';

describe('app routes', () => {
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    router = TestBed.inject(Router);
    await db.delete();
    await db.open();
  });

  function shellRoute() {
    return routes.find((r) => r.path === '' && !!r.children);
  }

  describe('when onboarding is not completed', () => {
    it('redirects Movements to Onboarding', async () => {
      await router.navigateByUrl('/movements');
      expect(router.url).toBe('/onboarding');
    });

    it('redirects Stats to Onboarding', async () => {
      await router.navigateByUrl('/stats');
      expect(router.url).toBe('/onboarding');
    });

    it('redirects Settings to Onboarding', async () => {
      await router.navigateByUrl('/settings');
      expect(router.url).toBe('/onboarding');
    });

    it('redirects unknown URLs (wildcard into the shell) to Onboarding', async () => {
      await router.navigateByUrl('/nonsense');
      expect(router.url).toBe('/onboarding');
    });

    it('sends a visitor at the root to Onboarding', async () => {
      await router.navigateByUrl('/');
      expect(router.url).toBe('/onboarding');
    });

    it('keeps the public Landing reachable', async () => {
      await router.navigateByUrl('/landing');
      expect(router.url).toBe('/landing');
    });

    it('keeps the public Privacy page reachable, query parameters included', async () => {
      await router.navigateByUrl('/privacy?utm_source=google');
      expect(router.url).toBe('/privacy?utm_source=google');
    });

    it('keeps Onboarding itself reachable without a loop', async () => {
      await router.navigateByUrl('/onboarding');
      expect(router.url).toBe('/onboarding');
    });
  });

  describe('when onboarding is completed', () => {
    beforeEach(async () => {
      await TestBed.inject(ProfileService).completeOnboarding('EUR');
    });

    it('resolves Movements', async () => {
      await router.navigateByUrl('/movements');
      expect(router.url).toBe('/movements');
    });

    it('resolves Stats', async () => {
      await router.navigateByUrl('/stats');
      expect(router.url).toBe('/stats');
    });

    it('resolves Settings', async () => {
      await router.navigateByUrl('/settings');
      expect(router.url).toBe('/settings');
    });

    it('redirects the legacy dashboard route to Stats for existing deep links', async () => {
      await router.navigateByUrl('/dashboard');
      expect(router.url).toBe('/stats');
    });

    it('enters the app at the root', async () => {
      await router.navigateByUrl('/');
      expect(router.url).toBe('/movements');
    });

    it('keeps the public Landing reachable', async () => {
      await router.navigateByUrl('/landing');
      expect(router.url).toBe('/landing');
    });

    it('resolves the public Privacy route', async () => {
      await router.navigateByUrl('/privacy');
      expect(router.url).toBe('/privacy');
    });
  });

  it('registers the public Landing surface outside the shell', () => {
    const landing = routes.find((r) => r.path === 'landing' && r.loadComponent && !r.children);
    expect(landing).toBeDefined();
  });

  it('keeps the root out of the Landing, redirecting into the shell instead', () => {
    const rootRedirect = routes.find((r) => r.path === '' && r.redirectTo && !r.children);
    expect(rootRedirect?.redirectTo).toBe('movements');
    const landing = routes.find((r) => r.path === '' && r.loadComponent && !r.children);
    expect(landing).toBeUndefined();
  });

  it('registers the public Privacy surface outside the shell', () => {
    const privacy = routes.find((r) => r.path === 'privacy' && r.loadComponent && !r.children);
    expect(privacy).toBeDefined();
  });

  it('registers the Stats surface and the legacy dashboard redirect', () => {
    const stats = shellRoute()?.children?.find((r) => r.path === 'stats');
    expect(stats).toBeDefined();
    const legacy = shellRoute()?.children?.find((r) => r.path === 'dashboard');
    expect(legacy?.redirectTo).toBe('stats');
  });
});
