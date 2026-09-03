import { describe, it, expect } from 'vitest';
import { translate } from '../translations/translations';
import { TranslationError, errorCopy } from './translation-error';

const tFor =
  (lang: 'en' | 'es') =>
  (key: string, params?: Record<string, string | number>): string =>
    translate(lang, key, params);

describe('TranslationError', () => {
  it('is an Error carrying a translation key and params', () => {
    const e = new TranslationError('errors.accountNameTaken', { name: 'Cash' });
    expect(e).toBeInstanceOf(Error);
    expect(e.key).toBe('errors.accountNameTaken');
    expect(e.params).toEqual({ name: 'Cash' });
  });

  it('resolves to the English message in English', () => {
    const e = new TranslationError('errors.accountNameRequired');
    expect(errorCopy(e, tFor('en'), 'settings.failedAddAccount')).toBe('Account name is required');
  });

  it('resolves to the Spanish message in Spanish', () => {
    const e = new TranslationError('errors.accountNameRequired');
    expect(errorCopy(e, tFor('es'), 'settings.failedAddAccount')).toBe(
      'El nombre de la cuenta es obligatorio',
    );
  });

  it('interpolates parameters into the resolved message in both languages', () => {
    const e = new TranslationError('errors.accountNameTaken', { name: 'Cash' });
    expect(errorCopy(e, tFor('en'), 'settings.failedAddAccount')).toBe(
      'An account named "Cash" already exists',
    );
    expect(errorCopy(e, tFor('es'), 'settings.failedAddAccount')).toBe(
      'Ya hay una cuenta llamada "Cash"',
    );
  });

  it('falls back to the fallback key for non-translation errors', () => {
    expect(errorCopy(new Error('boom'), tFor('en'), 'settings.failedAddAccount')).toBe(
      'Failed to add account',
    );
    expect(errorCopy(undefined, tFor('es'), 'settings.failedAddAccount')).toBe(
      'Error al añadir cuenta',
    );
  });
});
