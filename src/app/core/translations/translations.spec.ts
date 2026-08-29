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

  it('covers the shell navigation keys', () => {
    for (const key of [
      'shell.skipToContent',
      'shell.primaryNavAria',
      'shell.movements',
      'shell.stats',
      'shell.settings',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the backup card keys', () => {
    for (const key of [
      'backup.card.title',
      'backup.card.description',
      'backup.card.download',
      'backup.card.restoreFromFile',
      'backup.card.restoreFrom',
      'backup.card.working',
      'backup.card.backupFromLabel',
      'backup.card.replacesAllData',
      'backup.card.restoreData',
      'backup.card.cancel',
      'backup.fileDownloaded',
      'backup.card.downloadFailed',
      'backup.noCloudBackup',
      'backup.restoredOk',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the backup banner keys', () => {
    for (const key of [
      'backup.banner.ariaLabel',
      'backup.banner.methodBackup',
      'backup.banner.lastBackup',
      'backup.banner.backUp',
      'backup.banner.backingUp',
      'backup.banner.offline',
      'backup.banner.dismiss',
      'backup.banner.never',
      'backup.relative.justNow',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the install prompt keys', () => {
    for (const key of ['install.prompt', 'install.action', 'install.dismiss']) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the app metadata keys', () => {
    expect(TRANSLATIONS.en['app.title']).toBeTruthy();
    expect(TRANSLATIONS.es['app.title']).toBeTruthy();
  });

  it('covers the backup service error keys', () => {
    for (const key of [
      'backup.error.offlineConnect',
      'backup.error.offlineBackup',
      'backup.error.offlineRestore',
      'backup.error.notConnected',
      'backup.error.alreadyInProgress',
      'backup.error.backupFailed',
      'backup.error.restoreFailed',
      'backup.error.invalidFile',
      'backup.error.noBackupFound',
      'backup.error.createFolder',
      'backup.error.download',
      'backup.error.createFile',
      'backup.error.updateFile',
      'backup.error.searchDrive',
      'backup.error.loadIdentity',
      'backup.error.driveUnreachable',
      'backup.error.unexpected',
      'backup.error.oauth.cancelled',
      'backup.error.oauth.denied',
      'backup.error.oauth.popupBlocked',
      'backup.error.oauth.loadFailed',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });
});
