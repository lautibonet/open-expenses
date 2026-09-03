import { describe, expect, it } from 'vitest';
import { MonthNumber, PeriodScope } from '../types/period.type';
import { Account } from '../models/account.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { periodEndBalance, periodEndBaseAmount, storedBaseAmount } from './period-end-balances';

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

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 1,
    sourceAccountId: 1,
    destinationAccountId: 2,
    sourceAmount: 500,
    destinationAmount: 500,
    exchangeRate: 1,
    baseCurrencyAmount: 500,
    date: new Date('2026-09-05'),
    period: 9,
    year: 2026,
    note: '',
    createdAt: new Date('2026-09-05'),
    ...overrides,
  } as Transfer;
}

const scope = (period: number, year: number): PeriodScope => ({ kind: 'month', period: period as MonthNumber, year });
const isIncome = (t: Transaction) => t.categoryId === 1;

describe('periodEndBalance', () => {
  it('should show the initial balance only when the scope ends before any movement', () => {
    const acc = account({ initialBalance: 100000 });
    const txns = [transaction({ period: 9, year: 2026 })];

    const balance = periodEndBalance(
      { account: acc, transactions: txns, transfers: [], isIncome },
      scope(1, 2026),
    );

    expect(balance).toBe(100000);
  });

  it('should add income and subtract expenses at or before the scope period', () => {
    const acc = account({ initialBalance: 1000 });
    const txns = [
      transaction({ id: 1, categoryId: 1, amount: 3000, period: 8, year: 2026 }),
      transaction({ id: 2, categoryId: 2, amount: 500, period: 9, year: 2026 }),
    ];

    const balance = periodEndBalance(
      { account: acc, transactions: txns, transfers: [], isIncome },
      scope(9, 2026),
    );

    expect(balance).toBe(3500);
  });

  it('should exclude movements after the scope period, same year', () => {
    const acc = account({ initialBalance: 1000 });
    const txns = [transaction({ categoryId: 1, amount: 3000, period: 10, year: 2026 })];

    const balance = periodEndBalance(
      { account: acc, transactions: txns, transfers: [], isIncome },
      scope(9, 2026),
    );

    expect(balance).toBe(1000);
  });

  it('should exclude movements from later years and include earlier ones', () => {
    const acc = account({ initialBalance: 1000 });
    const txns = [
      transaction({ id: 1, categoryId: 1, amount: 3000, period: 12, year: 2025 }),
      transaction({ id: 2, categoryId: 1, amount: 700, period: 1, year: 2027 }),
    ];

    const balance = periodEndBalance(
      { account: acc, transactions: txns, transfers: [], isIncome },
      scope(9, 2026),
    );

    expect(balance).toBe(4000);
  });

  it('should classify by the stored year for a Dec-dated January-period movement', () => {
    const acc = account({ initialBalance: 0 });
    const txns = [transaction({ categoryId: 1, amount: 3000, period: 1, year: 2026, date: new Date('2025-12-22') })];

    expect(
      periodEndBalance({ account: acc, transactions: txns, transfers: [], isIncome }, scope(1, 2026)),
    ).toBe(3000);
    expect(
      periodEndBalance({ account: acc, transactions: txns, transfers: [], isIncome }, scope(12, 2025)),
    ).toBe(0);
  });

  it('should apply transfers as source debit and destination credit within the scope', () => {
    const source = account({ id: 1, initialBalance: 1000 });
    const destination = account({ id: 2, initialBalance: 0 });
    const transfers = [transfer({ period: 3, year: 2026, sourceAmount: 400, destinationAmount: 400 })];

    const inputs = (acc: Account) => ({ account: acc, transactions: [], transfers, isIncome });

    expect(periodEndBalance(inputs(source), scope(3, 2026))).toBe(600);
    expect(periodEndBalance(inputs(destination), scope(3, 2026))).toBe(400);
    expect(periodEndBalance(inputs(source), scope(2, 2026))).toBe(1000);
  });

  it('should reproduce the all-time figure when the scope is the latest period with movements', () => {
    const acc = account({ initialBalance: 1000 });
    const txns = [
      transaction({ id: 1, categoryId: 1, amount: 3000, period: 1, year: 2025 }),
      transaction({ id: 2, categoryId: 2, amount: 500, period: 6, year: 2026 }),
      transaction({ id: 3, categoryId: 1, amount: 200, period: 9, year: 2026 }),
    ];
    const transfers = [transfer({ sourceAmount: 300, destinationAmount: 300, period: 2, year: 2026 })];

    const allTime = 1000 + 3000 - 500 + 200 - 300;
    const latest = periodEndBalance(
      { account: acc, transactions: txns, transfers, isIncome },
      scope(9, 2026),
    );

    expect(latest).toBe(allTime);
  });

  it('should keep an empty later period at the last non-empty balance', () => {
    const acc = account({ initialBalance: 1000 });
    const txns = [transaction({ categoryId: 1, amount: 3000, period: 1, year: 2026 })];

    const atSeptember = periodEndBalance(
      { account: acc, transactions: txns, transfers: [], isIncome },
      scope(9, 2026),
    );
    const atDecember = periodEndBalance(
      { account: acc, transactions: txns, transfers: [], isIncome },
      scope(12, 2026),
    );

    expect(atSeptember).toBe(4000);
    expect(atDecember).toBe(atSeptember);
  });
});

describe('storedBaseAmount', () => {
  it('should use the stored base currency amount when present', () => {
    const t = transaction({ amount: 100, exchangeRate: 1.2, baseCurrencyAmount: 120 });
    expect(storedBaseAmount(t)).toBe(120);
  });

  it('should fall back to the stored exchange rate when no base amount is stored', () => {
    const t = transaction({ amount: 100, exchangeRate: 1.08, baseCurrencyAmount: null });
    expect(storedBaseAmount(t)).toBe(108);
  });

  it('should count the face amount when no conversion is stored', () => {
    const t = transaction({ amount: 100, exchangeRate: null, baseCurrencyAmount: null });
    expect(storedBaseAmount(t)).toBe(100);
  });
});

describe('periodEndBaseAmount', () => {
  it('should combine the converted initial balance with stored movement conversions', () => {
    const acc = account({ initialBalance: 1000 });
    const txns = [
      transaction({ id: 1, categoryId: 1, amount: 100, exchangeRate: 1.08, baseCurrencyAmount: 108, period: 8, year: 2026 }),
      transaction({ id: 2, categoryId: 2, amount: 50, exchangeRate: null, baseCurrencyAmount: null, period: 9, year: 2026 }),
    ];

    const baseAmount = periodEndBaseAmount(
      { account: acc, transactions: txns, transfers: [], isIncome },
      scope(9, 2026),
      909.09,
    );

    expect(baseAmount).toBe(909.09 + 108 - 50);
  });

  it('should apply stored transfer conversions, not re-converted amounts', () => {
    const source = account({ id: 1 });
    const destination = account({ id: 2, currency: 'USD' });
    const transfers = [
      transfer({ sourceAccountId: 2, destinationAccountId: 1, sourceAmount: 100, destinationAmount: 85, baseCurrencyAmount: 85, period: 5, year: 2026 }),
    ];

    const inputs = (acc: Account) => ({ account: acc, transactions: [], transfers, isIncome });

    expect(periodEndBaseAmount(inputs(destination), scope(9, 2026), 0)).toBe(-85);
    expect(periodEndBaseAmount(inputs(source), scope(9, 2026), 0)).toBe(85);
  });

  it('should ignore movements after the scope period', () => {
    const acc = account({ initialBalance: 0 });
    const txns = [transaction({ categoryId: 1, amount: 100, baseCurrencyAmount: 108, period: 10, year: 2026 })];

    const baseAmount = periodEndBaseAmount(
      { account: acc, transactions: txns, transfers: [], isIncome },
      scope(9, 2026),
      0,
    );

    expect(baseAmount).toBe(0);
  });
});
