import { describe, it, expect } from 'vitest';
import { categorySpending, spendingShare } from './category-spending';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { Transaction } from '../models/transaction.model';

function account(overrides: Partial<Account>): Account {
  return {
    id: 1,
    name: 'Cash',
    currency: 'EUR',
    initialBalance: 0,
    active: true,
    kind: 'cash',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function category(overrides: Partial<Category>): Category {
  return {
    id: 1,
    name: 'Groceries',
    type: 'expense',
    active: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    accountId: 1,
    categoryId: 1,
    amount: 100,
    date: new Date('2026-01-15'),
    period: 1,
    year: 2026,
    exchangeRate: null,
    baseCurrencyAmount: null,
    note: '',
    createdAt: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('category spending split (ADR 0022)', () => {
  const cash = account({ id: 1, name: 'Cash' });
  const card = account({ id: 2, name: 'Visa', kind: 'credit-card', linkedAccountId: 1 });
  const groceries = category({ id: 1, name: 'Groceries' });
  const accountsById = new Map([
    [cash.id!, cash],
    [card.id!, card],
  ]);

  it('splits a category into the cash-paid and credit-paid portions', () => {
    const transactions = [
      txn({ id: 1, accountId: 1, categoryId: 1, amount: 200 }),
      txn({ id: 2, accountId: 2, categoryId: 1, amount: 500 }),
    ];

    expect(
      categorySpending(transactions, new Map([[1, groceries]]), accountsById),
    ).toEqual([{ categoryId: 1, name: 'Groceries', cash: 200, credit: 500, total: 700 }]);
  });

  it('counts a card Transaction as credit under its real category', () => {
    const transactions = [txn({ accountId: 2, categoryId: 1, amount: 500 })];

    const rows = categorySpending(transactions, new Map([[1, groceries]]), accountsById);

    expect(rows).toEqual([{ categoryId: 1, name: 'Groceries', cash: 0, credit: 500, total: 500 }]);
  });

  it('treats a Transaction whose account is unknown as cash rather than dropping it', () => {
    const transactions = [txn({ accountId: 999, categoryId: 1, amount: 100 })];

    const rows = categorySpending(transactions, new Map([[1, groceries]]), accountsById);

    expect(rows).toEqual([{ categoryId: 1, name: 'Groceries', cash: 100, credit: 0, total: 100 }]);
  });

  it('excludes income categories from the spending graph', () => {
    const payroll = category({ id: 2, name: 'Payroll', type: 'income' });
    const transactions = [txn({ categoryId: 2, amount: 3000 })];

    expect(categorySpending(transactions, new Map([[2, payroll]]), accountsById)).toEqual([]);
  });

  it('excludes the Card Payment categories from the spending graph', () => {
    const payment = category({ id: 2, name: 'Visa payment' });
    const transactions = [txn({ categoryId: 2, amount: 500 })];

    expect(
      categorySpending(transactions, new Map([[2, payment]]), accountsById, new Set([2])),
    ).toEqual([]);
  });

  it('converts a foreign-currency Transaction through its stored rate', () => {
    const usd = account({ id: 3, name: 'USD', currency: 'USD' });
    const transactions = [txn({ accountId: 3, categoryId: 1, amount: 100, exchangeRate: 1.08 })];
    const withUsd = new Map(accountsById);
    withUsd.set(usd.id!, usd);

    const rows = categorySpending(transactions, new Map([[1, groceries]]), withUsd);

    expect(rows[0]).toEqual({ categoryId: 1, name: 'Groceries', cash: 108, credit: 0, total: 108 });
  });

  it('sorts categories by total spending, largest first', () => {
    const food = category({ id: 1, name: 'Food' });
    const rent = category({ id: 2, name: 'Rent' });
    const transactions = [
      txn({ id: 1, categoryId: 1, amount: 500 }),
      txn({ id: 2, categoryId: 2, amount: 1500 }),
    ];

    const rows = categorySpending(transactions, new Map([[1, food], [2, rent]]), accountsById);

    expect(rows.map(r => r.name)).toEqual(['Rent', 'Food']);
  });

  it('skips a Transaction whose category cannot be resolved', () => {
    const transactions = [txn({ categoryId: 999, amount: 100 })];

    expect(categorySpending(transactions, new Map([[1, groceries]]), accountsById)).toEqual([]);
  });
});

describe('spending share', () => {
  it('states a portion as its percentage of the total, rounded to two decimals', () => {
    expect(spendingShare(200, 800)).toBe(25);
    expect(spendingShare(600, 800)).toBe(75);
    expect(spendingShare(500, 1500)).toBeCloseTo(33.33, 2);
  });

  it('is zero for an empty portion or an empty category', () => {
    expect(spendingShare(0, 800)).toBe(0);
    expect(spendingShare(200, 0)).toBe(0);
  });
});
