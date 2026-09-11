import { describe, it, expect } from 'vitest';
import { cashBasisTransactions, countsTowardCashBasis } from './cash-basis';
import { Account } from '../models/account.model';
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

describe('cash-basis KPI filter (ADR 0022)', () => {
  const cash = account({ id: 1, name: 'Cash' });
  const card = account({ id: 2, name: 'Visa', kind: 'credit-card', linkedAccountId: 1 });
  const accountsById = new Map([
    [cash.id!, cash],
    [card.id!, card],
  ]);

  it('counts a Transaction on a Cash Account', () => {
    expect(countsTowardCashBasis(txn({ accountId: 1 }), accountsById)).toBe(true);
  });

  it('excludes a Transaction on a Credit Card', () => {
    expect(countsTowardCashBasis(txn({ accountId: 2 }), accountsById)).toBe(false);
  });

  it('counts a Transaction whose account is unknown rather than dropping it', () => {
    expect(countsTowardCashBasis(txn({ accountId: 999 }), accountsById)).toBe(true);
  });

  it('keeps only the cash-account Transactions', () => {
    const transactions = [
      txn({ id: 1, accountId: 1 }),
      txn({ id: 2, accountId: 2 }),
      txn({ id: 3, accountId: 1 }),
    ];

    expect(cashBasisTransactions(transactions, accountsById).map(t => t.id)).toEqual([1, 3]);
  });
});
