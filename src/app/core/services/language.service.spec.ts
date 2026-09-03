import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LanguageService } from './language.service';
import { db } from '../db/database';

function seedProfile(language?: string): Promise<unknown> {
  const profile: Record<string, unknown> = {
    id: 1,
    baseCurrency: 'EUR',
    onboardingCompleted: true,
    lastBackupAt: null,
  };
  if (language) profile['language'] = language;
  return db.profile.add(profile as never);
}

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
  });

  describe('init', () => {
    it('defaults existing profiles without a stored language to English', async () => {
      await seedProfile();
      await service.init();
      expect(service.activeLanguage()).toBe('en');
    });

    it('uses the stored language of existing profiles', async () => {
      await seedProfile('es');
      await service.init();
      expect(service.activeLanguage()).toBe('es');
    });

    it('prefers the stored language over the browser language', async () => {
      vi.stubGlobal('navigator', { language: 'es-ES', languages: ['es-ES'] });
      await seedProfile('en');
      await service.init();
      expect(service.activeLanguage()).toBe('en');
    });

    it('preselects Spanish from the browser language on a fresh load', async () => {
      vi.stubGlobal('navigator', { language: 'es-ES', languages: ['es-ES'] });
      await service.init();
      expect(service.activeLanguage()).toBe('es');
    });

    it('preselects English from the browser language on a fresh load', async () => {
      vi.stubGlobal('navigator', { language: 'en-GB', languages: ['en-GB'] });
      await service.init();
      expect(service.activeLanguage()).toBe('en');
    });

    it('does not persist the fresh-load preselect', async () => {
      vi.stubGlobal('navigator', { language: 'es-ES', languages: ['es-ES'] });
      await service.init();
      expect(await db.profile.toArray()).toEqual([]);
    });
  });

  describe('setLanguage', () => {
    it('updates the signal and persists the choice', async () => {
      await seedProfile('en');
      await service.init();

      await service.setLanguage('es');

      expect(service.activeLanguage()).toBe('es');
      expect((await db.profile.get(1))!.language).toBe('es');
    });

    it('keeps the document language attribute in sync', async () => {
      await seedProfile('en');
      await service.init();

      await service.setLanguage('es');
      expect(document.documentElement.getAttribute('lang')).toBe('es');

      await service.setLanguage('en');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('keeps the document title in sync', async () => {
      await seedProfile('en');
      await service.init();
      expect(document.title).toBe('Open Expenses');

      await service.setLanguage('es');
      expect(document.title).toBe('Open Expenses');
    });
  });

  describe('applyFromProfile', () => {
    it('re-applies the language stored on the profile after a restore', async () => {
      await seedProfile('en');
      await service.init();
      expect(service.activeLanguage()).toBe('en');

      await db.profile.clear();
      await db.profile.add({
        id: 1,
        baseCurrency: 'EUR',
        language: 'es',
        onboardingCompleted: true,
        lastBackupAt: null,
      });

      await service.applyFromProfile();

      expect(service.activeLanguage()).toBe('es');
    });

    it('keeps the current language when the profile has none', async () => {
      await seedProfile('es');
      await service.init();

      await db.profile.clear();
      await db.profile.add({
        id: 1,
        baseCurrency: 'EUR',
        onboardingCompleted: true,
        lastBackupAt: null,
      } as never);

      await service.applyFromProfile();

      expect(service.activeLanguage()).toBe('es');
    });
  });

  describe('t', () => {
    it('translates with the active language and re-renders on change', async () => {
      await seedProfile('en');
      await service.init();
      expect(service.t('settings.title')).toBe('Settings');

      await service.setLanguage('es');
      expect(service.t('settings.title')).toBe('Ajustes');
    });
  });

  describe('formatters', () => {
    it('format money with the active language', async () => {
      await seedProfile('en');
      await service.init();
      expect(service.formatMoney(12345.5, 'EUR')).toBe('€12,345.50');

      await service.setLanguage('es');
      expect(service.formatMoney(12345.5, 'EUR')).toBe('12.345,50\u00A0€');
    });

    it('format dates with the active language', async () => {
      await seedProfile('es');
      await service.init();
      expect(service.formatDate('2026-08-15T12:00:00Z')).toBe('15 ago 2026');
    });

    it('format numbers with the active language', async () => {
      await seedProfile('es');
      await service.init();
      expect(service.formatNumber(1234567.89)).toBe('1.234.567,89');
    });
  });

  describe('locale-neutral value labels', () => {
    it('renders month numbers in the active language', async () => {
      await seedProfile('en');
      await service.init();
      expect(service.monthName(1)).toBe('January');
      expect(service.monthName(12)).toBe('December');

      await service.setLanguage('es');
      expect(service.monthName(1)).toBe('Enero');
      expect(service.monthName(12)).toBe('Diciembre');
    });

    it('renders month initials in the active language', async () => {
      await seedProfile('en');
      await service.init();
      expect(service.monthInitial(1)).toBe('J');
      expect(service.monthInitial(9)).toBe('S');
      expect(service.monthInitial(12)).toBe('D');

      await service.setLanguage('es');
      expect(service.monthInitial(1)).toBe('E');
      expect(service.monthInitial(9)).toBe('S');
      expect(service.monthInitial(12)).toBe('D');
    });

    it('renders stored locale-neutral periods in the active language', async () => {
      await seedProfile('es');
      await service.init();
      expect(service.periodLabel(3)).toBe('Marzo');

      await service.setLanguage('en');
      expect(service.periodLabel(3)).toBe('March');
    });

    it('leaves unrecognized stored periods visible as raw values', async () => {
      await seedProfile('en');
      await service.init();
      expect(service.periodLabel('Enero')).toBe('Enero');
    });

    it('renders category type codes in the active language', async () => {
      await seedProfile('en');
      await service.init();
      expect(service.categoryTypeLabel('income')).toBe('Income');
      expect(service.categoryTypeLabel('expense')).toBe('Expense');

      await service.setLanguage('es');
      expect(service.categoryTypeLabel('income')).toBe('Ingreso');
      expect(service.categoryTypeLabel('expense')).toBe('Gasto');
    });

    it('guards against unknown category type values by showing them raw', async () => {
      await seedProfile('en');
      await service.init();
      expect(service.categoryTypeLabel('checking')).toBe('checking');
    });
  });
});
