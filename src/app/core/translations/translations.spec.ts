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
    expect(translate('en', 'backup.card.backUpTo', { method: 'Google Drive' })).toBe(
      'Back up to Google Drive',
    );
    expect(translate('es', 'backup.card.backUpTo', { method: 'Google Drive' })).toBe(
      'Hacer copia en Google Drive',
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
      'shell.quickAdd',
      'shell.quickAddShortcut',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the settings restyle keys', () => {
    for (const key of [
      'settings.subtitle',
      'settings.addAccount',
      'settings.deactivateAccountAria',
      'settings.deactivateCategoryAria',
      'settings.confirmDeactivationAria',
      'settings.cancelDeactivationAria',
      'settings.editAccountAria',
      'settings.editCategoryAria',
      'settings.editBaseCurrencyAria',
      'settings.editLanguageAria',
      'settings.confirmEditAria',
      'settings.cancelEditAria',
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
      'backup.card.backUpTo',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the backup status and action keys', () => {
    for (const key of [
      'backup.sidebar.ariaLabel',
      'backup.status.lastBackup',
      'backup.status.never',
      'backup.action.backUp',
      'backup.action.backingUp',
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
    for (const key of ['scope.yearAria', 'scope.monthAria', 'scope.groupAria', 'scope.label']) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('drops the abandoned visible-sort strings', () => {
    expect(TRANSLATIONS.en['movements.sortNewest']).toBeUndefined();
    expect(TRANSLATIONS.en['movements.sortOldest']).toBeUndefined();
    expect(TRANSLATIONS.es['movements.sortNewest']).toBeUndefined();
    expect(TRANSLATIONS.es['movements.sortOldest']).toBeUndefined();
  });

  it('covers the movements keys', () => {
    for (const key of [
      'movements.title',
      'movements.subtitle',
      'movements.netFlow',
      'movements.loading',
      'movements.flowIn',
      'movements.flowOut',
      'movements.addTransfer',
      'movements.newTransaction',
      'movements.transferShortcut',
      'movements.newTransactionShortcut',
      'movements.saveDisabled.accounts',
      'movements.saveDisabled.distinct',
      'movements.saveDisabled.amount',
      'movements.saveDisabled.rate',
      'movements.shortcutsHint',
      'movements.sortByDateAria',
      'movements.editTransferTitle',
      'movements.newTransferTitle',
      'movements.transferSheetAria',
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
      'movements.showFilters',
      'movements.hideFilters',
      'movements.removeFilterAria',
      'movements.clearFilters',
      'movements.tableCaption',
      'movements.colDate',
      'movements.colCategoryTransfer',
      'movements.colAmount',
      'movements.colAccount',
      'movements.colActions',
      'movements.editMovementAria',
      'movements.deleteMovementAria',
      'movements.cancelDeletionAria',
      'movements.confirmTransactionDeletionAria',
      'movements.confirmTransferDeletionAria',
      'movements.deleteTransactionConfirm',
      'movements.deleteTransferConfirm',
      'movements.deletedTransaction',
      'movements.deletedTransfer',
      'movements.undo',
      'movements.noMatchFilters',
      'movements.noneForScope',
      'movements.emptyStateCta',
      'movements.unknown',
      'movements.error.offlineRate',
      'movements.error.rateFetch',
      'movements.announcement.transferUpdated',
      'movements.announcement.transferSaved',
      'movements.announcement.transactionUpdated',
      'movements.announcement.transactionSaved',
      'movements.error.saveFailed',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the movement row kind keys', () => {
    for (const key of ['type.income', 'type.expense', 'type.transfer']) {
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
      'quickAdd.saveDisabled.account',
      'quickAdd.saveDisabled.category',
      'quickAdd.saveDisabled.amount',
      'quickAdd.saveDisabled.rate',
      'quickAdd.announcement.saved',
      'quickAdd.announcement.updated',
      'quickAdd.error.offlineRate',
      'quickAdd.error.rateFetch',
      'quickAdd.error.failedToSave',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the stats keys', () => {
    for (const key of [
      'stats.title',
      'stats.subtitle',
      'stats.expensesByCategory',
      'stats.totalBalance',
      'stats.allAccounts',
      'stats.conversionWarning',
      'stats.accountBalances',
      'stats.income',
      'stats.expenses',
      'stats.net',
      'stats.netStripZero',
      'stats.kpiZero',
      'stats.categoryZero',
      'stats.noAccounts',
      'stats.avgCaption',
      'stats.savingsRate',
      'stats.kpiScope',
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
      'onboarding.accounts.title',
      'onboarding.accounts.description',
      'onboarding.accounts.namePlaceholder',
      'onboarding.accounts.currencyAria',
      'onboarding.accounts.balancePlaceholder',
      'onboarding.accounts.add',
      'onboarding.accounts.remove',
      'onboarding.categories.title',
      'onboarding.categories.description',
      'onboarding.categories.nameHeader',
      'onboarding.categories.typeHeader',
      'onboarding.categories.actionsHeader',
      'onboarding.categories.namePlaceholder',
      'onboarding.categories.typeAria',
      'onboarding.categories.addCategory',
      'onboarding.categories.minRequired',
      'onboarding.completionFailed',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });

  it('covers the shared validation error keys', () => {
    for (const key of [
      'errors.accountNameRequired',
      'errors.accountNameTaken',
      'errors.initialBalanceNegative',
      'errors.accountNotFound',
      'errors.categoryNameRequired',
      'errors.categoryNameTaken',
      'errors.categoryNotFound',
      'errors.categoryTypeInvalid',
      'errors.amountPositive',
      'errors.sourceAmountPositive',
      'errors.periodInvalid',
      'errors.yearInvalid',
      'errors.accountsMustDiffer',
      'errors.exchangeRatePositive',
      'errors.sourceAccountNotFound',
      'errors.destinationAccountNotFound',
      'errors.transactionNotFound',
      'errors.transactionIdRequired',
      'errors.transactionExists',
      'errors.transferNotFound',
      'errors.transferIdRequired',
      'errors.transferExists',
      'errors.rateApiFailed',
      'errors.rateNotAvailable',
      'errors.quoteCurrenciesRequired',
      'errors.noRatesReturned',
    ]) {
      expect(TRANSLATIONS.en[key]).toBeTruthy();
      expect(TRANSLATIONS.es[key]).toBeTruthy();
    }
  });
});
