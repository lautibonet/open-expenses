import { describe, it, expect } from 'vitest';
import { accumulatedByPeriod, lastMovementPeriod } from './year-overview';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Account } from '../models/account.model';

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

function transfer(overrides: Partial<Transfer>): Transfer {
  return {
    id: 1,
    sourceAccountId: 1,
    destinationAccountId: 2,
    sourceAmount: 100,
    destinationAmount: 100,
    exchangeRate: 1,
    baseCurrencyAmount: 100,
    date: new Date('2026-01-15'),
    period: 1,
    year: 2026,
    note: '',
    createdAt: new Date('2026-01-15'),
    ...overrides,
  };
}

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

describe('accumulatedByPeriod', () => {
  it('returns one entry for every Period of the year', () => {
    const series = accumulatedByPeriod({
      accounts: [],
      transactions: [],
      transfers: [],
      isIncome: () => true,
      year: 2026,
      initialInBase: new Map(),
    });

    expect(series).toHaveLength(12);
    expect(series.every(v => v === 0)).toBe(true);
  });

  it('adds movements cumulatively: each Period carries every earlier one', () => {
    const series = accumulatedByPeriod({
      accounts: [account({ id: 1, initialBalance: 1000 })],
      transactions: [
        txn({ id: 1, period: 1, amount: 3000 }),
        txn({ id: 2, period: 2, amount: 700 }),
        txn({ id: 3, period: 3, amount: 500 }),
      ],
      transfers: [],
      isIncome: (t: Transaction) => t.id === 1,
      year: 2026,
      initialInBase: new Map([[1, 1000]]),
    });

    expect(series[0]).toBe(4000);
    expect(series[1]).toBe(3300);
    expect(series[2]).toBe(2800);
    expect(series[11]).toBe(2800);
  });

  it('includes prior years entirely and the year Period by Period', () => {
    const prior = txn({ id: 1, period: 6, year: 2025, amount: 2000 });

    const series = accumulatedByPeriod({
      accounts: [account({ id: 1, initialBalance: 1000 })],
      transactions: [prior, txn({ id: 2, period: 2, amount: 500 })],
      transfers: [],
      isIncome: () => true,
      year: 2026,
      initialInBase: new Map([[1, 1000]]),
    });

    expect(series[0]).toBe(3000);
    expect(series[1]).toBe(3500);
  });

  it('nets Transfers to zero across all accounts', () => {
    const series = accumulatedByPeriod({
      accounts: [account({ id: 1 }), account({ id: 2 })],
      transactions: [],
      transfers: [transfer({ period: 2 })],
      isIncome: () => true,
      year: 2026,
      initialInBase: new Map([
        [1, 100],
        [2, 100],
      ]),
    });

    expect(series.every(v => v === 200)).toBe(true);
  });

  it('counts cross-currency movements at their stored conversion', () => {
    const stored = txn({ period: 1, amount: 100, exchangeRate: 1.08, baseCurrencyAmount: 108 });

    const series = accumulatedByPeriod({
      accounts: [account({ id: 1, initialBalance: 1000 })],
      transactions: [stored],
      transfers: [],
      isIncome: () => true,
      year: 2026,
      initialInBase: new Map([[1, 1000]]),
    });

    expect(series[0]).toBe(1108);
  });

  it('leaves out accounts whose initial balance could not be converted', () => {
    const series = accumulatedByPeriod({
      accounts: [account({ id: 1, initialBalance: 1000 }), account({ id: 2, currency: 'USD' })],
      transactions: [txn({ id: 1, accountId: 2, period: 1, amount: 500 })],
      transfers: [],
      isIncome: () => true,
      year: 2026,
      initialInBase: new Map([[1, 1000]]),
    });

    expect(series[0]).toBe(1000);
  });

  it('counts movements at face amounts in native mode', () => {
    const stored = txn({ period: 1, amount: 100, exchangeRate: 2, baseCurrencyAmount: 200 });

    const series = accumulatedByPeriod({
      accounts: [account({ id: 1, initialBalance: 1000 })],
      transactions: [stored],
      transfers: [],
      isIncome: () => true,
      year: 2026,
      initialInBase: new Map([[1, 1000]]),
      nativeAmounts: true,
    });

    expect(series[0]).toBe(1100);
  });

  it('equals the period-end balance at the Scope Period', () => {
    const accounts = [account({ id: 1, initialBalance: 1000 })];
    const transactions = [
      txn({ id: 1, period: 2, amount: 3000 }),
      txn({ id: 2, period: 2, amount: 700 }),
    ];

    const series = accumulatedByPeriod({
      accounts,
      transactions,
      transfers: [],
      isIncome: (t: Transaction) => t.id === 1,
      year: 2026,
      initialInBase: new Map([[1, 1000]]),
    });

    expect(series[1]).toBe(3300);
  });
});

describe('lastMovementPeriod', () => {
  it('returns 0 when the year carries no movements', () => {
    expect(lastMovementPeriod([], [], 2026)).toBe(0);
  });

  it('returns the latest Period carrying a Transaction', () => {
    const transactions = [
      txn({ id: 1, period: 2 }),
      txn({ id: 2, period: 5 }),
    ];
    expect(lastMovementPeriod(transactions, [], 2026)).toBe(5);
  });

  it('counts Transfers as movements', () => {
    expect(lastMovementPeriod([], [transfer({ period: 7 })], 2026)).toBe(7);
  });

  it('takes the latest across Transactions and Transfers', () => {
    expect(lastMovementPeriod([txn({ period: 3 })], [transfer({ period: 9 })], 2026)).toBe(9);
  });

  it('ignores movements of other years', () => {
    const transactions = [
      txn({ id: 1, period: 12, year: 2025 }),
      txn({ id: 2, period: 4 }),
    ];
    expect(lastMovementPeriod(transactions, [transfer({ period: 8, year: 2025 })], 2026)).toBe(4);
  });

  it('returns 12 when December carries a movement', () => {
    expect(lastMovementPeriod([txn({ period: 12 })], [], 2026)).toBe(12);
  });
});
