import { describe, it, expect } from 'vitest';
import { yearOverview, accumulatedByPeriod, lastMovementPeriod } from './year-overview';
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
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('yearOverview', () => {
  it('returns one entry for every Period of the year, in calendar order', () => {
    const overview = yearOverview([], () => true, 2026);

    expect(overview.map(o => o.period)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('keeps months without movements at zero', () => {
    const overview = yearOverview([txn({ period: 3 })], () => true, 2026);

    expect(overview.find(o => o.period === 3)).toEqual({ period: 3, income: 100, expenses: 0, net: 100 });
    expect(overview.find(o => o.period === 1)!.net).toBe(0);
    expect(overview.find(o => o.period === 12)!.net).toBe(0);
  });

  it('splits Income and Expenses per Period and nets them', () => {
    const transactions = [
      txn({ id: 1, period: 1, amount: 3000 }),
      txn({ id: 2, period: 1, amount: 500 }),
      txn({ id: 3, period: 2, amount: 700 }),
    ];
    const isIncome = (t: Transaction) => t.id !== 2 && t.id !== 3;

    const overview = yearOverview(transactions, isIncome, 2026);

    expect(overview.find(o => o.period === 1)).toEqual({
      period: 1,
      income: 3000,
      expenses: 500,
      net: 2500,
    });
    expect(overview.find(o => o.period === 2)!.net).toBe(-700);
  });

  it('aggregates by the stored Period year, never the movement date', () => {
    const december = txn({ period: 1, date: new Date('2025-12-22'), year: 2026, amount: 3000 });

    const overview = yearOverview([december], () => true, 2026);
    expect(overview.find(o => o.period === 1)!.income).toBe(3000);

    const excluded = yearOverview([december], () => true, 2025);
    expect(excluded.every(o => o.net === 0)).toBe(true);
  });

  it('counts cross-currency movements at their stored conversion', () => {
    const stored = txn({ period: 4, amount: 100, exchangeRate: 1.08, baseCurrencyAmount: 108 });

    const overview = yearOverview([stored], () => true, 2026);

    expect(overview.find(o => o.period === 4)!.income).toBe(108);
  });

  it('completes the stored base amount from the exchange rate when only the rate persisted', () => {
    const rateOnly = txn({ period: 4, amount: 100, exchangeRate: 1.08, baseCurrencyAmount: null });

    const overview = yearOverview([rateOnly], () => true, 2026);

    expect(overview.find(o => o.period === 4)!.income).toBe(108);
  });

  it('rounds each Period figure to cents', () => {
    const messy = [
      txn({ id: 1, period: 6, amount: 10.1 }),
      txn({ id: 2, period: 6, amount: 20.2 }),
      txn({ id: 3, period: 6, amount: 30.3 }),
    ];

    const overview = yearOverview(messy, () => true, 2026);

    expect(overview.find(o => o.period === 6)!.income).toBe(60.6);
  });
});

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
