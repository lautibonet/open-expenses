import { describe, it, expect } from 'vitest';
import { TRANSLATIONS, translate } from './translations';

describe('translations', () => {
  it('translates known keys into English and Spanish', () => {
    expect(translate('en', 'settings.title')).toBe('Settings');
    expect(translate('es', 'settings.title')).toBe('Ajustes');
    expect(translate('es', 'settings.language')).toBe('Idioma');
  });

  it('falls back to English when a key is missing in the active language', () => {
    const original = TRANSLATIONS.es['settings.title'];
    delete TRANSLATIONS.es['settings.title'];
    try {
      expect(translate('es', 'settings.title')).toBe('Settings');
    } finally {
      TRANSLATIONS.es['settings.title'] = original;
    }
  });

  it('returns the key itself when no translation exists', () => {
    expect(translate('en', 'settings.doesNotExist')).toBe('settings.doesNotExist');
  });

  it('interpolates parameters into the translated text', () => {
    expect(translate('en', 'settings.deactivateAccountConfirm', { name: 'Cash' })).toBe(
      'Deactivate Cash?',
    );
    expect(translate('es', 'settings.deactivateAccountConfirm', { name: 'Cash' })).toBe(
      '¿Desactivar Cash?',
    );
  });

  it('keeps both dictionaries in sync', () => {
    expect(Object.keys(TRANSLATIONS.es).sort()).toEqual(Object.keys(TRANSLATIONS.en).sort());
  });
});
