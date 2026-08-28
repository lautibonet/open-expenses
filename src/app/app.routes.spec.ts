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

  it('still resolves the legacy dashboard route for existing deep links', async () => {
    await router.navigateByUrl('/dashboard');
    expect(router.url).toBe('/dashboard');
  });

  it('keeps the legacy dashboard route registered as the future Stats surface', () => {
    const shell = routes.find((r) => r.path === '');
    const dashboard = shell?.children?.find((r) => r.path === 'dashboard');
    expect(dashboard).toBeDefined();
  });
});
