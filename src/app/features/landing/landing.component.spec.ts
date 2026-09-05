import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LandingComponent } from './landing.component';
import { routes } from '../../app.routes';
import { ProfileService } from '../../core/services/profile.service';
import { db } from '../../core/db/database';

describe('LandingComponent (#131: The Poster)', () => {
  let fixture: ComponentFixture<LandingComponent>;

  function createLanding(): ComponentFixture<LandingComponent> {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    return fixture;
  }

  function text(el: HTMLElement): string {
    return el.textContent ?? '';
  }

  describe('with an English browser', () => {
    beforeEach(async () => {
      vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
      await TestBed.configureTestingModule({
        imports: [LandingComponent],
        providers: [provideRouter([])],
      }).compileComponents();
      fixture = createLanding();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('detects the browser language (English default)', () => {
      expect(text(fixture.nativeElement)).toContain('YOUR LEDGER.');
      expect(text(fixture.nativeElement)).toContain('NO TRACKING.');
    });

    it('renders the CTA row: Open the app in-app, View source to the repo', () => {
      const ctas = fixture.nativeElement.querySelectorAll('.cta-row a');
      expect(ctas.length).toBe(2);
      expect(ctas[0].getAttribute('routerLink')).toBe('/movements');
      expect(ctas[0].textContent?.trim()).toBe('Open the app');
      expect(ctas[1].getAttribute('href')).toBe('https://github.com/lautibonet/open-expenses');
      expect(ctas[1].textContent?.trim()).toBe('View source');
    });

    it('renders the self-host footnote and the AGPL-3.0 footer', () => {
      expect(text(fixture.nativeElement)).toContain('It is a static site');
      expect(text(fixture.nativeElement)).toContain('Open Expenses is free software under AGPL-3.0.');
    });

    it('links the Privacy page from the footer (#132)', () => {
      const link = fixture.nativeElement.querySelector(
        'footer a[routerLink="/privacy"]',
      ) as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      expect(link?.textContent?.trim()).toBe('Privacy');
    });
  });

  describe('with a Spanish browser', () => {
    beforeEach(async () => {
      vi.stubGlobal('navigator', { language: 'es-ES', languages: ['es-ES'] });
      await TestBed.configureTestingModule({
        imports: [LandingComponent],
        providers: [provideRouter([])],
      }).compileComponents();
      fixture = createLanding();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('detects Spanish and locks the Spanish poster copy', () => {
      expect(text(fixture.nativeElement)).toContain('TU DINERO.');
      expect(text(fixture.nativeElement)).toContain('TU NAVEGADOR.');
      expect(text(fixture.nativeElement)).toContain('TU REGISTRO.');
      expect(text(fixture.nativeElement)).toContain('SIN CUENTA.');
      expect(text(fixture.nativeElement)).toContain('SIN SERVIDOR.');
      expect(text(fixture.nativeElement)).toContain('SIN RASTREO.');
    });

    it('never translates the App Name', () => {
      expect(text(fixture.nativeElement)).toContain('Open Expenses');
    });
  });

  describe('language toggle', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [LandingComponent],
        providers: [provideRouter([])],
      }).compileComponents();
      fixture = createLanding();
    });

    it('shows a visible EN | ES group with the detected language active', () => {
      const buttons = fixture.nativeElement.querySelectorAll('.lang-toggle button');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent?.trim()).toBe('EN');
      expect(buttons[1].textContent?.trim()).toBe('ES');
      expect(buttons[0].classList.contains('active')).toBe(true);
    });

    it('switches the copy to Spanish and back', () => {
      const buttons = fixture.nativeElement.querySelectorAll('.lang-toggle button');
      buttons[1].click();
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).toContain('TU REGISTRO.');
      expect(document.documentElement.lang).toBe('es');
      expect(buttons[1].classList.contains('active')).toBe(true);

      buttons[0].click();
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).toContain('YOUR LEDGER.');
      expect(document.documentElement.lang).toBe('en');
    });

    it('labels the toggle group for assistive tech in the active language', () => {
      const group = fixture.nativeElement.querySelector('.lang-toggle');
      expect(group.getAttribute('aria-label')).toBe('Language');
    });
  });

  describe('CTA click-through (onboarding guard)', () => {
    let router: Router;

    beforeEach(async () => {
      vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
      await TestBed.configureTestingModule({
        imports: [LandingComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();
      router = TestBed.inject(Router);
      await db.delete();
      await db.open();
      await router.navigateByUrl('/');
      fixture = createLanding();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sends an un-onboarded user to Onboarding, not Movements', async () => {
      const cta = fixture.nativeElement.querySelector('.cta-row a[routerLink="/movements"]');
      cta.click();
      await fixture.whenStable();
      expect(router.url).toBe('/onboarding');
    });

    it('sends an onboarded user to Movements', async () => {
      await TestBed.inject(ProfileService).completeOnboarding('EUR');
      fixture = createLanding();
      const cta = fixture.nativeElement.querySelector('.cta-row a[routerLink="/movements"]');
      cta.click();
      await fixture.whenStable();
      expect(router.url).toBe('/movements');
    });
  });

  describe('standing copy rules', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [LandingComponent],
        providers: [provideRouter([])],
      }).compileComponents();
      fixture = createLanding();
    });

    it('renders no em dashes in any language', () => {
      const buttons = fixture.nativeElement.querySelectorAll('.lang-toggle button');
      for (const lang of ['es', 'en']) {
        if (lang === 'es') {
          buttons[1].click();
          fixture.detectChanges();
        }
        expect(text(fixture.nativeElement)).not.toContain('\u2014');
      }
    });

    it('renders the mark exactly once in the page', () => {
      const marks = fixture.nativeElement.querySelectorAll('svg rect[fill="#0052ff"]');
      expect(marks.length).toBe(1);
    });

    it('keeps the top bar to the language toggle alone', () => {
      const topBar = fixture.nativeElement.querySelector('.top-bar');
      expect(topBar.querySelectorAll('a, svg').length).toBe(0);
      expect(topBar.querySelector('.lang-toggle')).not.toBeNull();
    });
  });
});
