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
      'shell.storageStatus',
      'shell.quickAdd',
      'shell.backup',
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

  it('covers the scope keys', () => {
    for (const key of ['scope.allTime', 'scope.yearAria', 'scope.monthAria']) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the movements keys', () => {
    for (const key of [
      'movements.addTransfer',
      'movements.transferShortcut',
      'movements.sortNewest',
      'movements.sortOldest',
      'movements.editTransferTitle',
      'movements.newTransferTitle',
      'movements.transferNeedsTwoAccounts',
      'movements.from',
      'movements.to',
      'movements.amountWithCurrency',
      'movements.date',
      'movements.period',
      'movements.year',
      'movements.note',
      'movements.exchangeRate',
      'movements.fetchingRate',
      'movements.exchangeRatePair',
      'movements.destAmount',
      'movements.suggestedRate',
      'movements.cancel',
      'movements.save',
      'movements.search',
      'movements.searchPlaceholder',
      'movements.category',
      'movements.allCategories',
      'movements.account',
      'movements.allAccounts',
      'movements.filtersActive',
      'movements.clearFilters',
      'movements.tableCaption',
      'movements.colType',
      'movements.colDate',
      'movements.colCategoryTransfer',
      'movements.colAmount',
      'movements.colAccount',
      'movements.colActions',
      'movements.edit',
      'movements.delete',
      'movements.confirmTransactionDeletionAria',
      'movements.confirmTransferDeletionAria',
      'movements.deleteTransactionConfirm',
      'movements.deleteTransferConfirm',
      'movements.deletedTransaction',
      'movements.deletedTransfer',
      'movements.undo',
      'movements.noMatchFilters',
      'movements.noneForScope',
      'movements.useQuickAdd',
      'movements.unknown',
      'movements.error.offlineRate',
      'movements.error.rateFetch',
      'movements.announcement.transferUpdated',
      'movements.announcement.transferSaved',
      'movements.error.differentAccounts',
      'movements.error.amountPositive',
      'movements.error.ratePositive',
      'movements.error.accountMissing',
      'movements.error.saveFailed',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the quick add keys', () => {
    for (const key of [
      'quickAdd.noAccounts',
      'quickAdd.noCategories',
      'quickAdd.amount',
      'quickAdd.account',
      'quickAdd.category',
      'quickAdd.record',
      'quickAdd.moreOptions',
      'quickAdd.fetchingRate',
      'quickAdd.editTransactionTitle',
      'quickAdd.newTransactionTitle',
      'quickAdd.note',
      'quickAdd.date',
      'quickAdd.period',
      'quickAdd.year',
      'quickAdd.exchangeRate',
      'quickAdd.exchangeRatePair',
      'quickAdd.exchangeRateAria',
      'quickAdd.equivalent',
      'quickAdd.equivalentAria',
      'quickAdd.suggestedRate',
      'quickAdd.cancel',
      'quickAdd.save',
      'quickAdd.announcement.saved',
      'quickAdd.announcement.updated',
      'quickAdd.error.offlineRate',
      'quickAdd.error.rateFetch',
      'quickAdd.error.failedToSave',
      'quickAdd.error.categoryMissing',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the stats keys', () => {
    for (const key of [
      'stats.title',
      'stats.totals',
      'stats.expensesByCategory',
      'stats.colCategory',
      'stats.colAmount',
      'stats.totalBalance',
      'stats.allAccounts',
      'stats.conversionWarning',
      'stats.accountBalances',
      'stats.colAccount',
      'stats.colCurrency',
      'stats.colBalance',
      'stats.monthlyAverages',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the onboarding keys', () => {
    for (const key of [
      'onboarding.setup',
      'onboarding.steps.language',
      'onboarding.steps.restore',
      'onboarding.steps.currency',
      'onboarding.steps.accounts',
      'onboarding.steps.categories',
      'onboarding.language.title',
      'onboarding.language.description',
      'onboarding.language.aria',
      'onboarding.next',
      'onboarding.back',
      'onboarding.startTracking',
      'onboarding.restore.title',
      'onboarding.restore.description',
      'onboarding.restore.startFresh',
      'onboarding.restore.restoring',
      'onboarding.restore.noBackupFound',
      'onboarding.currency.title',
      'onboarding.currency.description',
      'onboarding.currency.aria',
      'onboarding.currency.searchLabel',
      'onboarding.currency.searchAria',
      'onboarding.currency.searchPlaceholder',
      'onboarding.currency.symbol',
      'onboarding.accounts.title',
      'onboarding.accounts.description',
      'onboarding.accounts.namePlaceholder',
      'onboarding.accounts.currencyAria',
      'onboarding.accounts.balancePlaceholder',
      'onboarding.accounts.add',
      'onboarding.accounts.remove',
      'onboarding.accounts.nameRequired',
      'onboarding.accounts.nameExists',
      'onboarding.categories.title',
      'onboarding.categories.description',
      'onboarding.categories.nameHeader',
      'onboarding.categories.typeHeader',
      'onboarding.categories.actionsHeader',
      'onboarding.categories.namePlaceholder',
      'onboarding.categories.typeAria',
      'onboarding.categories.addCategory',
      'onboarding.categories.delete',
      'onboarding.categories.minRequired',
      'onboarding.categories.namesRequired',
      'onboarding.completionFailed',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });
});
