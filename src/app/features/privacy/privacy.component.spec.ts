import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';
import { LanguageService } from '../../core/services/language.service';
import { db } from '../../core/db/database';

describe('PrivacyComponent (#132)', () => {
  let fixture: ComponentFixture<PrivacyComponent>;

  function text(el: HTMLElement): string {
    return el.textContent ?? '';
  }

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  async function configurePrivacy(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  }

  function createPrivacy(): ComponentFixture<PrivacyComponent> {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
    return fixture;
  }

  describe('in English (default)', () => {
    beforeEach(async () => {
      await configurePrivacy();
      fixture = createPrivacy();
    });

    it('defaults to English', () => {
      expect(fixture.componentInstance.lang()).toBe('en');
      expect(text(fixture.nativeElement)).toContain('Privacy');
    });

    it('names the one file and the scope the app accesses', () => {
      expect(text(fixture.nativeElement)).toContain('open-expenses-backup.json');
      expect(text(fixture.nativeElement)).toContain('drive.file');
    });

    it('says where data lives: the browser and the own Drive, with no backend, no accounts, no analytics', () => {
      const body = text(fixture.nativeElement);
      expect(body).toContain('your browser');
      expect(body).toContain('your own Google Drive');
      expect(body).toContain('no backend');
      expect(body).toContain('no accounts');
      expect(body).toContain('no analytics');
    });

    it('commits to never sharing, selling, or analyzing the data', () => {
      const body = text(fixture.nativeElement);
      expect(body).toContain('never shared');
      expect(body).toContain('never sold');
      expect(body).toContain('never analyzed');
    });

    it('says the token is revocable', () => {
      expect(text(fixture.nativeElement)).toContain('revocable');
    });

    it('renders the contact email as a mailto link', () => {
      const mail = fixture.nativeElement.querySelector(
        'a[href="mailto:contact@openexpenses.app"]',
      ) as HTMLAnchorElement | null;
      expect(mail).not.toBeNull();
      expect(mail?.textContent?.trim()).toBe('contact@openexpenses.app');
    });

    it('carries the Google Limited Use commitment', () => {
      const body = text(fixture.nativeElement);
      expect(body).toContain('Limited Use');
      expect(body).toContain('Google API Services User Data Policy');
    });
  });

  describe('language', () => {
    it('follows the app Language once the profile carries one', async () => {
      await configurePrivacy();
      await TestBed.inject(LanguageService).setLanguage('es');
      fixture = createPrivacy();
      expect(fixture.componentInstance.lang()).toBe('es');
      expect(text(fixture.nativeElement)).toContain('Privacidad');
    });

    it('toggles to Spanish and back from the page itself', async () => {
      await configurePrivacy();
      fixture = createPrivacy();

      const buttons = fixture.nativeElement.querySelectorAll('.lang-toggle button');
      buttons[1].click();
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).toContain('Privacidad');
      expect(document.documentElement.lang).toBe('es');
      expect(buttons[1].classList.contains('active')).toBe(true);

      buttons[0].click();
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).toContain('Privacy');
      expect(document.documentElement.lang).toBe('en');
    });
  });

  describe('standing copy rules', () => {
    beforeEach(async () => {
      await configurePrivacy();
      fixture = createPrivacy();
    });

    it('renders no em dashes in any language', async () => {
      const buttons = fixture.nativeElement.querySelectorAll('.lang-toggle button');
      buttons[1].click();
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).not.toContain('\u2014');

      buttons[0].click();
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).not.toContain('\u2014');
    });

    it('never translates the App Name', async () => {
      expect(text(fixture.nativeElement)).toContain('Open Expenses');

      const buttons = fixture.nativeElement.querySelectorAll('.lang-toggle button');
      buttons[1].click();
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).toContain('Open Expenses');
    });
  });
});

