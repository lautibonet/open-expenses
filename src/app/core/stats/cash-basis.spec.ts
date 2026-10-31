import { describe, it, expect } from 'vitest';
import {
  buildAccountsById,
  cardPaymentTransfers,
  cashBasisTransactions,
  countsTowardCashBasis,
  isCardPayment,
  cashBasis,
  CashBasisSnapshot,
  monthlyAverages,
} from './cash-basis';
import { Account } from '../models/account.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Category } from '../models/category.model';
import { MonthNumber, scopePeriods } from '../types/period.type';
import { Scope } from '../scope/scope';

const scope = (fromYear: number, fromMonth: number, toYear: number, toMonth: number): Scope => ({
  from: { year: fromYear, month: fromMonth as MonthNumber },
  to: { year: toYear, month: toMonth as MonthNumber },
});
const month = (year: number, m: number): Scope => scope(year, m, year, m);
const wholeYear = (year: number): Scope => scope(year, 1, year, 12);

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
  const card = account({ id: 2, name: 'Visa', kind: 'credit-card' });
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

describe('card-payment classification (ADR 0022)', () => {
  const cash = account({ id: 1, name: 'Cash' });
  const cash2 = account({ id: 3, name: 'Savings' });
  const card = account({ id: 2, name: 'Visa', kind: 'credit-card' });
  const accountsById = new Map([
    [cash.id!, cash],
    [cash2.id!, cash2],
    [card.id!, card],
  ]);

  it('counts a Transfer from a Cash Account into a Credit Card as a Card Payment', () => {
    expect(isCardPayment(transfer({ sourceAccountId: 1, destinationAccountId: 2 }), accountsById)).toBe(true);
  });

  it('does not count Cash to Cash', () => {
    expect(isCardPayment(transfer({ sourceAccountId: 1, destinationAccountId: 3 }), accountsById)).toBe(false);
  });

  it('does not count Card to Cash', () => {
    expect(isCardPayment(transfer({ sourceAccountId: 2, destinationAccountId: 1 }), accountsById)).toBe(false);
  });

  it('does not count Card to Card', () => {
    expect(isCardPayment(transfer({ sourceAccountId: 2, destinationAccountId: 2 }), accountsById)).toBe(false);
  });

  it('does not count a Transfer whose accounts are unknown', () => {
    expect(isCardPayment(transfer({ sourceAccountId: 999, destinationAccountId: 2 }), accountsById)).toBe(false);
    expect(isCardPayment(transfer({ sourceAccountId: 1, destinationAccountId: 999 }), accountsById)).toBe(false);
  });

  it('keeps only the Card Payments of a mixed Transfer list', () => {
    const transfers = [
      transfer({ id: 1, sourceAccountId: 1, destinationAccountId: 2 }),
      transfer({ id: 2, sourceAccountId: 1, destinationAccountId: 3 }),
      transfer({ id: 3, sourceAccountId: 2, destinationAccountId: 1 }),
    ];

    expect(cardPaymentTransfers(transfers, accountsById).map(t => t.id)).toEqual([1]);
  });
});

describe('buildAccountsById', () => {
  it('keys accounts by id and skips accounts without one', () => {
    const withId = account({ id: 7, name: 'Checking' });
    const withoutId = account({ id: undefined, name: 'Draft' });

    const map = buildAccountsById([withId, withoutId]);

    expect(map.get(7)).toBe(withId);
    expect(map.size).toBe(1);
  });
});

function category(overrides: Partial<Category>): Category {
  return {
    id: 1,
    name: 'Food',
    type: 'expense',
    active: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('cashBasis totals (ADR 0022)', () => {
  const eur = account({ id: 1, name: 'Cash EUR', currency: 'EUR' });
  const usd = account({ id: 2, name: 'Cash USD', currency: 'USD' });
  const food = category({ id: 1, name: 'Food', type: 'expense' });
  const salary = category({ id: 2, name: 'Salary', type: 'income' });

  function snapshot(overrides: Partial<CashBasisSnapshot>): CashBasisSnapshot {
    return {
      accounts: [eur, usd],
      categories: [food, salary],
      transactions: [],
      transfers: [],
      baseCurrency: 'EUR',
      ...overrides,
    };
  }

  it('converts a foreign Transaction with an Exchange Rate but no stored base amount', () => {
    const figures = cashBasis(snapshot({
      transactions: [txn({ accountId: 2, categoryId: 1, amount: 10, exchangeRate: 0.9, baseCurrencyAmount: null })],
    }));

    expect(figures.scopeTotals(month(2026, 1))).toEqual({
      income: 0,
      expenses: 9,
      net: -9,
      periodsWithMovements: 1,
    });
  });

  it('counts a Transaction on a Base Currency Account at its face amount, ignoring a stale stored base amount', () => {
    /* Recorded while the Base Currency was USD: its stored base amount is in USD. */
    const figures = cashBasis(snapshot({
      transactions: [txn({ accountId: 1, categoryId: 1, amount: 50, exchangeRate: 1.1, baseCurrencyAmount: 55 })],
    }));

    expect(figures.scopeTotals(month(2026, 1)).expenses).toBe(50);
  });

  it('counts a foreign Transaction at its stored base amount', () => {
    const figures = cashBasis(snapshot({
      transactions: [txn({ accountId: 2, categoryId: 2, amount: 100, exchangeRate: 1.08, baseCurrencyAmount: 108 })],
    }));

    expect(figures.scopeTotals(month(2026, 1)).income).toBe(108);
  });

  it('counts a foreign Transaction without any stored conversion at its face amount and reports it', () => {
    const unconverted = txn({ id: 9, accountId: 2, categoryId: 1, amount: 10 });
    const figures = cashBasis(snapshot({ transactions: [unconverted] }));
    const scope = month(2026, 1);

    expect(figures.scopeTotals(scope).expenses).toBe(10);
    expect(figures.unconvertedTransactions(scope).map(t => t.id)).toEqual([9]);
  });

  it('never reports a converted or Base Currency Transaction as unconverted', () => {
    const figures = cashBasis(snapshot({
      transactions: [
        txn({ id: 1, accountId: 1, amount: 10 }),
        txn({ id: 2, accountId: 2, amount: 10, exchangeRate: 0.9 }),
        txn({ id: 3, accountId: 2, amount: 10, period: 2 }),
      ],
    }));

    expect(figures.unconvertedTransactions(month(2026, 1))).toEqual([]);
    expect(figures.unconvertedTransactions(wholeYear(2026)).map(t => t.id)).toEqual([3]);
  });

  it('leaves Card Purchases out and counts Card Payments as Expenses', () => {
    const card = account({ id: 3, name: 'Visa', kind: 'credit-card', active: false });
    const figures = cashBasis(snapshot({
      accounts: [eur, usd, card],
      transactions: [
        txn({ id: 1, accountId: 1, categoryId: 2, amount: 3000 }),
        txn({ id: 2, accountId: 3, categoryId: 1, amount: 800 }),
        txn({ id: 3, accountId: 3, categoryId: 2, amount: 40 }),
      ],
      transfers: [
        transfer({ id: 1, sourceAccountId: 1, destinationAccountId: 3, baseCurrencyAmount: 500 }),
        transfer({ id: 2, sourceAccountId: 1, destinationAccountId: 2, baseCurrencyAmount: 200 }),
        transfer({ id: 3, sourceAccountId: 3, destinationAccountId: 1, baseCurrencyAmount: 100 }),
      ],
    }));

    expect(figures.scopeTotals(month(2026, 1))).toEqual({
      income: 3000,
      expenses: 500,
      net: 2500,
      periodsWithMovements: 1,
    });
  });

  it('counts a Card Payment without a stored conversion at its face source amount and reports it (ADR 0028)', () => {
    const card = account({ id: 3, name: 'Visa', kind: 'credit-card', currency: 'GBP' });
    const figures = cashBasis(snapshot({
      accounts: [eur, usd, card],
      baseCurrency: 'CHF',
      transfers: [
        transfer({ id: 7, sourceAccountId: 2, destinationAccountId: 3, sourceAmount: 120, baseCurrencyAmount: null }),
        transfer({ id: 8, sourceAccountId: 1, destinationAccountId: 3, sourceAmount: 50, baseCurrencyAmount: 48 }),
        transfer({ id: 9, sourceAccountId: 1, destinationAccountId: 2, sourceAmount: 10, baseCurrencyAmount: null }),
      ],
    }));
    const scope = month(2026, 1);

    expect(figures.scopeTotals(scope).expenses).toBe(168);
    expect(figures.unconvertedCardPayments(scope).map(t => t.id)).toEqual([7]);
    expect(figures.unconvertedCardPayments(month(2026, 2))).toEqual([]);
  });

  it('splits each requested Period in order, by the stored Period year, across a year boundary', () => {
    const december = txn({ id: 1, accountId: 1, categoryId: 2, period: 1, date: new Date('2025-12-22'), year: 2026, amount: 3000 });
    const figures = cashBasis(snapshot({
      transactions: [
        december,
        txn({ id: 2, accountId: 1, categoryId: 1, period: 3, amount: 700 }),
        txn({ id: 3, accountId: 1, categoryId: 1, period: 12, year: 2025, amount: 40 }),
      ],
    }));

    const periods = figures.periodFlows(scopePeriods(scope(2025, 11, 2026, 3)));

    expect(periods.map(p => [p.year, p.month])).toEqual([
      [2025, 11], [2025, 12], [2026, 1], [2026, 2], [2026, 3],
    ]);
    expect(periods[0]).toEqual({ year: 2025, month: 11, income: 0, expenses: 0, net: 0, hasMovements: false });
    expect(periods[1]).toEqual({ year: 2025, month: 12, income: 0, expenses: 40, net: -40, hasMovements: true });
    expect(periods[2]).toEqual({ year: 2026, month: 1, income: 3000, expenses: 0, net: 3000, hasMovements: true });
    expect(periods[4].net).toBe(-700);
  });

  it('rounds each Period figure to cents', () => {
    const figures = cashBasis(snapshot({
      transactions: [
        txn({ id: 1, accountId: 1, categoryId: 2, amount: 10.1 }),
        txn({ id: 2, accountId: 1, categoryId: 2, amount: 20.2 }),
        txn({ id: 3, accountId: 1, categoryId: 2, amount: 30.3 }),
      ],
    }));

    expect(figures.periodFlows([{ year: 2026, month: 1 }])[0].income).toBe(60.6);
  });

  it('sums the whole year for a January to December Scope', () => {
    const figures = cashBasis(snapshot({
      transactions: [
        txn({ id: 1, accountId: 1, categoryId: 2, period: 1, amount: 1000 }),
        txn({ id: 2, accountId: 1, categoryId: 1, period: 12, amount: 300 }),
        txn({ id: 3, accountId: 1, categoryId: 2, period: 5, year: 2025, amount: 999 }),
      ],
    }));

    expect(figures.scopeTotals(wholeYear(2026))).toEqual({
      income: 1000,
      expenses: 300,
      net: 700,
      periodsWithMovements: 2,
    });
  });

  it('sums exactly the Periods of a Scope that crosses a year boundary, and averages over its Periods with movements', () => {
    const figures = cashBasis(snapshot({
      transactions: [
        txn({ id: 1, accountId: 1, categoryId: 2, period: 10, year: 2025, amount: 9999 }),
        txn({ id: 2, accountId: 1, categoryId: 2, period: 11, year: 2025, amount: 3000 }),
        txn({ id: 3, accountId: 1, categoryId: 1, period: 1, year: 2026, amount: 1000 }),
        txn({ id: 4, accountId: 1, categoryId: 1, period: 2, year: 2026, amount: 8888 }),
        txn({ id: 5, accountId: 1, categoryId: 1, period: 11, year: 2026, amount: 7777 }),
      ],
    }));

    const totals = figures.scopeTotals(scope(2025, 11, 2026, 1));

    expect(totals).toEqual({ income: 3000, expenses: 1000, net: 2000, periodsWithMovements: 2 });
    expect(monthlyAverages(totals)).toEqual({ income: 1500, expenses: 500, net: 1000 });
  });

  it('makes the Scope totals equal the sum of the Period figures the twelve-Period chart shows', () => {
    const figures = cashBasis(snapshot({
      transactions: [
        txn({ id: 1, accountId: 1, categoryId: 2, period: 12, year: 2025, amount: 10.1 }),
        txn({ id: 2, accountId: 1, categoryId: 2, period: 2, amount: 20.2 }),
        txn({ id: 3, accountId: 2, categoryId: 1, period: 2, amount: 7, exchangeRate: 0.95 }),
        txn({ id: 4, accountId: 1, categoryId: 1, period: 5, amount: 1 }),
      ],
    }));
    const covered = scope(2025, 12, 2026, 4);

    const shown = figures.periodFlows(scopePeriods(covered));

    expect(figures.scopeTotals(covered)).toEqual({
      income: 30.3,
      expenses: 6.65,
      net: 23.65,
      periodsWithMovements: 2,
    });
    expect(shown.reduce((sum, p) => sum + p.income, 0)).toBeCloseTo(30.3, 2);
    expect(shown.reduce((sum, p) => sum + p.expenses, 0)).toBeCloseTo(6.65, 2);
  });

  it('averages to zero when no Period carries movements', () => {
    const totals = cashBasis(snapshot({})).scopeTotals(scope(2026, 1, 2026, 6));

    expect(monthlyAverages(totals)).toEqual({ income: 0, expenses: 0, net: 0 });
  });

  it('classifies income by the Transaction Category, and an unknown Category as an Expense', () => {
    const figures = cashBasis(snapshot({}));

    expect(figures.isIncome(txn({ categoryId: 2 }))).toBe(true);
    expect(figures.isIncome(txn({ categoryId: 1 }))).toBe(false);
    expect(figures.isIncome(txn({ categoryId: 999 }))).toBe(false);
  });
});
