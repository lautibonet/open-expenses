import { describe, it, expect } from 'vitest';
import { netByPeriod } from './year-nets';
import { Transaction } from '../models/transaction.model';

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

describe('netByPeriod', () => {
  it('returns one entry for every Period of the year, in calendar order', () => {
    const nets = netByPeriod([], () => true, 2026);

    expect(nets.map(n => n.period)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('keeps months without movements at Net 0', () => {
    const nets = netByPeriod([txn({ period: 3 })], () => true, 2026);

    expect(nets.find(n => n.period === 3)!.net).toBe(100);
    expect(nets.find(n => n.period === 1)!.net).toBe(0);
    expect(nets.find(n => n.period === 12)!.net).toBe(0);
  });

  it('nets Income minus Expenses within each Period', () => {
    const transactions = [
      txn({ id: 1, period: 1, amount: 3000 }),
      txn({ id: 2, period: 1, amount: 500 }),
      txn({ id: 3, period: 2, amount: 700 }),
    ];
    const isIncome = (t: Transaction) => t.id !== 2 && t.id !== 3;

    const nets = netByPeriod(transactions, isIncome, 2026);

    expect(nets.find(n => n.period === 1)!.net).toBe(2500);
    expect(nets.find(n => n.period === 2)!.net).toBe(-700);
  });

  it('aggregates by the stored Period year, never the movement date', () => {
    const december = txn({ period: 1, date: new Date('2025-12-22'), year: 2026, amount: 3000 });

    const nets = netByPeriod([december], () => true, 2026);
    expect(nets.find(n => n.period === 1)!.net).toBe(3000);

    const excluded = netByPeriod([december], () => true, 2025);
    expect(excluded.every(n => n.net === 0)).toBe(true);
  });

  it('counts cross-currency movements at their stored conversion', () => {
    const stored = txn({ period: 4, amount: 100, exchangeRate: 1.08, baseCurrencyAmount: 108 });

    const nets = netByPeriod([stored], () => true, 2026);

    expect(nets.find(n => n.period === 4)!.net).toBe(108);
  });

  it('completes the stored base amount from the exchange rate when only the rate persisted', () => {
    const rateOnly = txn({ period: 4, amount: 100, exchangeRate: 1.08, baseCurrencyAmount: null });

    const nets = netByPeriod([rateOnly], () => true, 2026);

    expect(nets.find(n => n.period === 4)!.net).toBe(108);
  });

  it('rounds each Period Net to cents', () => {
    const messy = [
      txn({ id: 1, period: 6, amount: 10.1 }),
      txn({ id: 2, period: 6, amount: 20.2 }),
      txn({ id: 3, period: 6, amount: 30.3 }),
    ];

    const nets = netByPeriod(messy, () => true, 2026);

    expect(nets.find(n => n.period === 6)!.net).toBe(60.6);
  });
});
