import { Category, categoryTypeFromLegacy } from '../models/category.model';
import { needsBaseExchangeRate, transferBaseAmount } from '../models/transfer.model';
import { monthNumberFromName } from '../types/period.type';
import { DEFAULT_LANGUAGE, isLanguage, Language } from '../types/language.type';
import {
  newPaymentCategory,
  paymentCategoryRenames,
  resolvePaymentCategory,
} from '../payment-category/payment-category-rules';

/* ADR 0026: every row rule lives here, applied the same way by the Dexie
   upgrade and by Restore. Pure — no database — and idempotent: cleaning an
   already-clean dataset changes nothing. Rows are untyped because they may
   come from any older schema or Backup. */

/* The five tables of the local dataset. */
export interface Dataset {
  accounts: any[];
  categories: any[];
  transactions: any[];
  transfers: any[];
  profile: any[];
}

/* The Dataset's tables by name, for callers that read or write them all. */
export const DATASET_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'transfers',
  'profile',
] as const satisfies readonly (keyof Dataset)[];

const MS_PER_DAY = 86_400_000;

/* Restored rows carry dates as JSON text; text that is not a date stays. */
function toDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}

/* ADR 0020: a UTC-midnight Movement Date predates local-midnight storage and
   moves to local midnight of the same UTC calendar day. Any other date is
   left as is. */
function toLocalMidnight(value: unknown): unknown {
  if (!(value instanceof Date)) return value;
  const t = value.getTime();
  const utcRemainder = ((t % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
  if (utcRemainder !== 0) return value;
  return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/* ADR 0009: an English month name becomes its month number. Anything else
   stays as is, so an unrecognized period remains invisible to Scope filters
   instead of being destroyed. */
function toMonthNumber(period: unknown): unknown {
  return typeof period === 'string' ? (monthNumberFromName(period) ?? period) : period;
}

/* The row with the named field turned back into a date, leaving an absent
   field absent. */
function withDate(row: any, field: string): any {
  return field in row ? { ...row, [field]: toDate(row[field]) } : { ...row };
}

/* Dates first, so a missing Period year comes from the picked day: a
   pre-ADR-0020 January 1st read west of UTC would otherwise land in the
   previous year. A stored year is never rewritten. */
function cleanMovement(movement: any): any {
  const result = withDate(movement, 'createdAt');
  result.date = toLocalMidnight(toDate(movement.date));
  if (result.year == null && result.date instanceof Date) {
    result.year = result.date.getFullYear();
  }
  result.period = toMonthNumber(movement.period);
  return result;
}

function cleanTransaction(transaction: any): any {
  const { tags: _retired, ...rest } = transaction;
  return cleanMovement(rest);
}

/* Transfers stored before currency-aware amounts (ADR 0005) carry a single
   `amount`: the same figure on both sides, at rate 1. Its base amount is
   re-derived from the accounts afterwards (ADR 0028); where they cannot be
   resolved it stays unconverted. */
function cleanTransfer(transfer: any): any {
  const { amount, ...rest } = transfer;
  const cleaned = cleanMovement(rest);
  if (amount != null && cleaned.sourceAmount == null) {
    cleaned.sourceAmount = amount;
    cleaned.destinationAmount = amount;
    cleaned.exchangeRate = 1;
    cleaned.baseCurrencyAmount = null;
  }
  return cleaned;
}

/* ADR 0028: a Transfer's base amount is its source side in the dataset's Base
   Currency. A transfer with an account in base is re-derived and loses any
   base rate; one between two foreign accounts keeps a captured base rate's
   figure, or becomes unconverted (null) without one. A transfer whose
   accounts or Base Currency cannot be resolved is left as is. */
function repairTransferBaseAmounts(
  transfers: any[],
  accounts: any[],
  baseCurrency: unknown,
): any[] {
  if (typeof baseCurrency !== 'string') return transfers;
  const currencyOf = new Map(accounts.map(account => [account.id, account.currency]));
  return transfers.map(transfer => {
    const source = currencyOf.get(transfer.sourceAccountId);
    const destination = currencyOf.get(transfer.destinationAccountId);
    if (typeof source !== 'string' || typeof destination !== 'string') return transfer;
    const { baseExchangeRate, ...rest } = transfer;
    const keepsRate = needsBaseExchangeRate(source, destination, baseCurrency) && baseExchangeRate != null;
    const repaired = keepsRate ? { ...rest, baseExchangeRate } : rest;
    return {
      ...repaired,
      baseCurrencyAmount: transferBaseAmount(repaired, source, destination, baseCurrency),
    };
  });
}

/* ADR 0022: an account without a kind is a Cash Account. The Linked Account
   was dropped; its orphan field goes with it. */
function cleanAccount(account: any): any {
  const { linkedAccountId: _dropped, ...rest } = account;
  return { ...withDate(rest, 'createdAt'), kind: rest.kind ?? 'cash' };
}

function cleanCategory(category: any): any {
  return {
    ...withDate(category, 'createdAt'),
    type: categoryTypeFromLegacy(category.type) ?? category.type,
  };
}

function cleanProfile(profile: any): any {
  return withDate(profile, 'lastBackupAt');
}

/* Amended ADR 0022: every Credit Card owns its Payment Category. A card
   without a usable link is resolved by the Payment Category module's rule in
   the dataset's own Language: an Expense category holding the payment name is
   linked, or one is created under the next free id. A name held by an Income
   category leaves the card unlinked, clearing any link that no longer points
   at a usable category. */
function linkPaymentCategories(
  accounts: any[],
  categories: any[],
  language: Language,
): { accounts: any[]; categories: any[] } {
  const linkedCategories = [...categories];
  const linkedAccounts = accounts.map(account => {
    if (account.kind !== 'credit-card') return account;
    const resolution = resolvePaymentCategory(account, linkedCategories as Category[], language);
    switch (resolution.kind) {
      case 'stored':
        return account;
      case 'taken': {
        const { paymentCategoryId: _unusable, ...unlinked } = account;
        return unlinked;
      }
      case 'linkable':
        return { ...account, paymentCategoryId: resolution.category.id };
      case 'new': {
        const id = Math.max(0, ...linkedCategories.map(c => Number(c.id) || 0)) + 1;
        linkedCategories.push({ ...newPaymentCategory(resolution.name), id });
        return { ...account, paymentCategoryId: id };
      }
    }
  });
  return { accounts: linkedAccounts, categories: linkedCategories };
}

/* Issue #196: every linked Payment Category is named in the dataset's own
   Language, so a Restore ends in the restored Language and an upgrade catches
   up with Language switches made before the rule existed. A category whose
   translated name another category would hold keeps its name, silently: the
   cleanup cannot refuse. */
function namePaymentCategories(accounts: any[], categories: any[], language: Language): any[] {
  const { renamed } = paymentCategoryRenames(accounts, categories as Category[], language);
  const names = new Map(renamed.map(({ id, name }) => [id, name]));
  return categories.map(category =>
    names.has(category.id) ? { ...category, name: names.get(category.id) } : category,
  );
}

function datasetLanguage(profile: any[]): Language {
  const language = profile[0]?.language;
  return isLanguage(language) ? language : DEFAULT_LANGUAGE;
}

export function cleanDataset(dataset: Dataset): Dataset {
  const language = datasetLanguage(dataset.profile);
  const { accounts, categories } = linkPaymentCategories(
    dataset.accounts.map(cleanAccount),
    dataset.categories.map(cleanCategory),
    language,
  );
  return {
    accounts,
    categories: namePaymentCategories(accounts, categories, language),
    transactions: dataset.transactions.map(cleanTransaction),
    transfers: repairTransferBaseAmounts(
      dataset.transfers.map(cleanTransfer),
      accounts,
      dataset.profile[0]?.baseCurrency,
    ),
    profile: dataset.profile.map(cleanProfile),
  };
}
