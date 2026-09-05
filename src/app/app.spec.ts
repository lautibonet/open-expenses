import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { db } from './core/db/database';

describe('App boot', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  beforeEach(async () => {
    (window as any).matchMedia =
      (window as any).matchMedia ||
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();

    router = TestBed.inject(Router);
    await db.delete();
    await db.open();
  });

  async function bootAt(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(App);
    await fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
  }

  it('keeps the public landing at the root without redirecting to Onboarding', async () => {
    await bootAt('/');
    expect(router.url).toBe('/');
  });

  it('keeps the public Privacy page without redirecting to Onboarding', async () => {
    await bootAt('/privacy');
    expect(router.url).toBe('/privacy');
  });

  it('keeps the public Privacy page with query parameters', async () => {
    await bootAt('/privacy?utm_source=google');
    expect(router.url).toBe('/privacy?utm_source=google');
  });
});
