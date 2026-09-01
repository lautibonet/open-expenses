import { describe, expect, it } from 'vitest';
import { MonthNumber, PeriodScope } from '../types/period.type';
import { Account } from '../models/account.model';
import { Transaction } from '../models/transaction.model';
import { unconvertedTransactionsAffecting } from './conversion-degradation';

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'Cash',
    currency: 'EUR',
    initialBalance: 0,
    ...overrides,
  } as Account;
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    accountId: 1,
    categoryId: 1,
    amount: 1000,
    date: new Date('2026-09-05'),
    period: 9,
    year: 2026,
    exchangeRate: null,
    baseCurrencyAmount: null,
    note: '',
    createdAt: new Date('2026-09-05'),
    ...overrides,
  } as Transaction;
}

const scope = (period: number, year: number): PeriodScope => ({
  kind: 'month',
  period: period as MonthNumber,
  year,
});

describe('unconvertedTransactionsAffecting', () => {
  it('flags an offline-captured transaction on a foreign account with no stored conversion', () => {
    const accounts = new Map([[1, account({ currency: 'USD' })]]);
    const txns = [transaction({ accountId: 1 })];

    const flagged = unconvertedTransactionsAffecting(txns, accounts, 'EUR', scope(9, 2026));

    expect(flagged).toEqual(txns);
  });

  it('ignores unconverted transactions on base-currency accounts', () => {
    const accounts = new Map([[1, account({ currency: 'EUR' })]]);
    const txns = [transaction({ accountId: 1 })];

    const flagged = unconvertedTransactionsAffecting(txns, accounts, 'EUR', scope(9, 2026));

    expect(flagged).toEqual([]);
  });

  it('accepts a stored base amount as complete even on a foreign account', () => {
    const accounts = new Map([[1, account({ currency: 'USD' })]]);
    const txns = [transaction({ accountId: 1, exchangeRate: 1.08, baseCurrencyAmount: 108 })];

    const flagged = unconvertedTransactionsAffecting(txns, accounts, 'EUR', scope(9, 2026));

    expect(flagged).toEqual([]);
  });

  it('accepts an exchange rate as enough to complete the figure', () => {
    const accounts = new Map([[1, account({ currency: 'USD' })]]);
    const txns = [transaction({ accountId: 1, exchangeRate: 1.08, baseCurrencyAmount: null })];

    const flagged = unconvertedTransactionsAffecting(txns, accounts, 'EUR', scope(9, 2026));

    expect(flagged).toEqual([]);
  });

  it('flags foreign-account transactions at or before the scope period (Period-end path)', () => {
    const accounts = new Map([[1, account({ currency: 'USD' })]]);
    const txns = [transaction({ accountId: 1, period: 3, year: 2024 })];

    const flagged = unconvertedTransactionsAffecting(txns, accounts, 'EUR', scope(9, 2026));

    expect(flagged).toEqual(txns);
  });

  it('flags foreign-account transactions in the scope year even after the scope period (yearly totals path)', () => {
    const accounts = new Map([[1, account({ currency: 'USD' })]]);
    const txns = [transaction({ accountId: 1, period: 12, year: 2026 })];

    const flagged = unconvertedTransactionsAffecting(txns, accounts, 'EUR', scope(9, 2026));

    expect(flagged).toEqual(txns);
  });

  it('ignores foreign-account transactions after the scope period in another year', () => {
    const accounts = new Map([[1, account({ currency: 'USD' })]]);
    const txns = [transaction({ accountId: 1, period: 1, year: 2027 })];

    const flagged = unconvertedTransactionsAffecting(txns, accounts, 'EUR', scope(9, 2026));

    expect(flagged).toEqual([]);
  });

  it('ignores transactions whose account no longer exists', () => {
    const accounts = new Map<number, Account>();
    const txns = [transaction({ accountId: 42 })];

    const flagged = unconvertedTransactionsAffecting(txns, accounts, 'EUR', scope(9, 2026));

    expect(flagged).toEqual([]);
  });
});
