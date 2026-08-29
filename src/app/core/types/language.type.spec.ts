import { describe, it, expect, vi, afterEach } from 'vitest';
import { LANGUAGES, detectBrowserLanguage, isLanguage, localeFor } from './language.type';

describe('language.type', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('detectBrowserLanguage', () => {
    it('preselects Spanish for a Spanish browser language', () => {
      vi.stubGlobal('navigator', { language: 'es-ES', languages: ['es-ES', 'en'] });
      expect(detectBrowserLanguage()).toBe('es');
    });

    it('preselects Spanish for any Spanish variant', () => {
      vi.stubGlobal('navigator', { language: 'es-MX', languages: ['es-MX'] });
      expect(detectBrowserLanguage()).toBe('es');
    });

    it('preselects English for a non-Spanish browser language', () => {
      vi.stubGlobal('navigator', { language: 'en-GB', languages: ['en-GB'] });
      expect(detectBrowserLanguage()).toBe('en');
    });

    it('falls back to English when the browser reports nothing', () => {
      vi.stubGlobal('navigator', {});
      expect(detectBrowserLanguage()).toBe('en');
    });
  });

  describe('isLanguage', () => {
    it('accepts the supported language codes', () => {
      expect(isLanguage('en')).toBe(true);
      expect(isLanguage('es')).toBe(true);
    });

    it('rejects unknown values', () => {
      expect(isLanguage('fr')).toBe(false);
      expect(isLanguage('')).toBe(false);
      expect(isLanguage(null)).toBe(false);
      expect(isLanguage(undefined)).toBe(false);
    });
  });

  describe('localeFor', () => {
    it('maps English to en-GB', () => {
      expect(localeFor('en')).toBe('en-GB');
    });

    it('maps Spanish to es-ES', () => {
      expect(localeFor('es')).toBe('es-ES');
    });
  });

  it('labels each language in its own language', () => {
    expect(LANGUAGES).toEqual([
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
    ]);
  });
});
