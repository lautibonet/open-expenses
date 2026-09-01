import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { ProfileService } from './core/services/profile.service';
import { db } from './core/db/database';

describe('App boot landing', () => {
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
    await db.profile.clear();
  });

  async function bootAt(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(App);
    await fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
  }

  describe('when onboarding is completed', () => {
    beforeEach(async () => {
      await TestBed.inject(ProfileService).completeOnboarding('EUR');
    });

    it('keeps a deep link on Movements', async () => {
      await bootAt('/movements');
      expect(router.url).toBe('/movements');
    });

    it('keeps a deep link on Stats', async () => {
      await bootAt('/dashboard');
      expect(router.url).toBe('/dashboard');
    });

    it('keeps a deep link on Settings', async () => {
      await bootAt('/settings');
      expect(router.url).toBe('/settings');
    });

    it('lands on Movements when launched at the root', async () => {
      await bootAt('/');
      expect(router.url).toBe('/movements');
    });
  });

  describe('when onboarding is not completed', () => {
    it('lands on Onboarding when launched at the root', async () => {
      await bootAt('/');
      expect(router.url).toBe('/onboarding');
    });

    it('takes priority over a deep link to Movements', async () => {
      await bootAt('/movements');
      expect(router.url).toBe('/onboarding');
    });

    it('takes priority over a deep link to Stats', async () => {
      await bootAt('/dashboard');
      expect(router.url).toBe('/onboarding');
    });

    it('takes priority over a deep link to Settings', async () => {
      await bootAt('/settings');
      expect(router.url).toBe('/onboarding');
    });
  });
});
