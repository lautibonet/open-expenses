import { describe, it, expect } from 'vitest';
import { RateOutcome, currenciesNeedingRates, statsReport } from './stats-report';
import { CashBasisSnapshot } from './cash-basis';
import { MonthScope } from '../scope/scope';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';

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
    name: 'Food',
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

const food = category({ id: 1, name: 'Food', type: 'expense' });
const rent = category({ id: 3, name: 'Rent', type: 'expense' });
const salary = category({ id: 2, name: 'Salary', type: 'income' });

function snapshot(overrides: Partial<CashBasisSnapshot>): CashBasisSnapshot {
  return {
    accounts: [],
    categories: [food, rent, salary],
    transactions: [],
    transfers: [],
    baseCurrency: 'EUR',
    ...overrides,
  };
}

function scope(period: MonthScope['period'], year = 2026): MonthScope {
  return { kind: 'month', period, year };
}

const noRatesNeeded: RateOutcome = { kind: 'rates', rates: new Map() };
const unavailable: RateOutcome = { kind: 'unavailable' };

/* Rates are quoted per unit of Base Currency: 1 EUR buys 1.25 USD. */
const usdRates: RateOutcome = { kind: 'rates', rates: new Map([['USD', 1.25]]) };

describe('currenciesNeedingRates', () => {
  it('names each foreign Account currency once, and never the Base Currency', () => {
    const ledger = snapshot({
      accounts: [
        account({ id: 1, currency: 'EUR' }),
        account({ id: 2, currency: 'USD' }),
        account({ id: 3, currency: 'USD' }),
        account({ id: 4, currency: 'GBP' }),
      ],
    });

    expect(currenciesNeedingRates(ledger)).toEqual(['USD', 'GBP']);
  });

  it('needs no rates when every Account is in the Base Currency', () => {
    expect(currenciesNeedingRates(snapshot({ accounts: [account({ currency: 'EUR' })] }))).toEqual([]);
  });
});

describe('statsReport balances (ADR 0013)', () => {
  it('reports each Account at the end of the Scope Period, and their total', () => {
    const cash = account({ id: 1, name: 'Cash', initialBalance: 1000 });
    const savings = account({ id: 2, name: 'Savings', initialBalance: 500 });
    const ledger = snapshot({
      accounts: [cash, savings],
      transactions: [
        txn({ id: 1, accountId: 1, categoryId: 2, amount: 300, period: 1 }),
        txn({ id: 2, accountId: 1, categoryId: 1, amount: 50.1, period: 2 }),
        txn({ id: 3, accountId: 2, categoryId: 1, amount: 999, period: 3 }),
      ],
    });

    const report = statsReport(ledger, scope(2), noRatesNeeded);

    expect(report.balances.accounts.map(b => [b.account.name, b.balance])).toEqual([
      ['Cash', 1249.9],
      ['Savings', 500],
    ]);
    expect(report.balances.total).toBe(1749.9);
    expect(report.balances.debt).toBeNull();
    expect(report.balances.totalWithoutDebt).toBe(1749.9);
  });

  it('states the negative card balances as a positive Debt, and the total without it', () => {
    const cash = account({ id: 1, name: 'Cash', initialBalance: 1000 });
    const visa = account({ id: 2, name: 'Visa', kind: 'credit-card' });
    const master = account({ id: 3, name: 'Master', kind: 'credit-card', initialBalance: 40 });
    const ledger = snapshot({
      accounts: [visa, cash, master],
      transactions: [txn({ id: 1, accountId: 2, categoryId: 1, amount: 250.5, period: 1 })],
    });

    const report = statsReport(ledger, scope(1), noRatesNeeded);

    expect(report.balances.accounts.map(b => b.account.name)).toEqual(['Cash', 'Visa', 'Master']);
    expect(report.balances.total).toBe(789.5);
    /* An overpaid card's positive balance lands in the total, never in the Debt. */
    expect(report.balances.debt).toBe(250.5);
    expect(report.balances.totalWithoutDebt).toBe(1040);
  });

  it('clears the Debt once a Card Payment settles the card', () => {
    const cash = account({ id: 1, name: 'Cash', initialBalance: 1000 });
    const visa = account({ id: 2, name: 'Visa', kind: 'credit-card' });
    const ledger = snapshot({
      accounts: [cash, visa],
      transactions: [txn({ id: 1, accountId: 2, categoryId: 1, amount: 300, period: 1 })],
      transfers: [transfer({ sourceAccountId: 1, destinationAccountId: 2, sourceAmount: 300, destinationAmount: 300, baseCurrencyAmount: 300, period: 2 })],
    });

    expect(statsReport(ledger, scope(1), noRatesNeeded).balances.debt).toBe(300);
    expect(statsReport(ledger, scope(2), noRatesNeeded).balances.debt).toBeNull();
  });

  it('reports a card row as used of its Limit, and an overpaid card as zero used', () => {
    const visa = account({ id: 1, name: 'Visa', kind: 'credit-card', limit: 1000 });
    const amex = account({ id: 2, name: 'Amex', kind: 'credit-card', limit: 500, initialBalance: 20 });
    const master = account({ id: 3, name: 'Master', kind: 'credit-card' });
    const cash = account({ id: 4, name: 'Cash' });
    const ledger = snapshot({
      accounts: [visa, amex, master, cash],
      transactions: [txn({ id: 1, accountId: 1, categoryId: 1, amount: 300, period: 1 })],
    });

    const report = statsReport(ledger, scope(1), noRatesNeeded);

    expect(report.balances.accounts.map(b => [b.account.name, b.usedOfLimit])).toEqual([
      ['Cash', null],
      ['Visa', { used: 300, limit: 1000 }],
      ['Amex', { used: 0, limit: 500 }],
      ['Master', null],
    ]);
  });
});

describe('statsReport Exchange Rate paths', () => {
  const eur = account({ id: 1, name: 'Cash EUR', currency: 'EUR', initialBalance: 100 });
  const usd = account({ id: 2, name: 'Cash USD', currency: 'USD', initialBalance: 125 });
  const usdCard = account({ id: 3, name: 'Visa USD', currency: 'USD', kind: 'credit-card' });
  const eurCard = account({ id: 4, name: 'Visa EUR', currency: 'EUR', kind: 'credit-card' });
  const ledger = snapshot({
    accounts: [eur, usd, usdCard, eurCard],
    transactions: [
      /* A USD expense stored at its conversion: 50 USD were 40 EUR. */
      txn({ id: 1, accountId: 2, categoryId: 1, amount: 50, baseCurrencyAmount: 40, period: 1 }),
      txn({ id: 2, accountId: 3, categoryId: 1, amount: 100, baseCurrencyAmount: 80, period: 1 }),
      txn({ id: 3, accountId: 4, categoryId: 1, amount: 30, period: 1 }),
    ],
  });

  it('converts initial balances at the fetched rate and movements at their stored conversions', () => {
    const report = statsReport(ledger, scope(1), usdRates);

    /* 100 EUR + (125 / 1.25 − 40) EUR − 80 EUR − 30 EUR */
    expect(report.balances.total).toBe(50);
    expect(report.balances.debt).toBe(110);
    expect(report.balances.totalWithoutDebt).toBe(160);
    expect(report.degradation).toEqual({ accountsExcluded: false, unconvertedTransactions: false });
  });

  it('keeps each Account row in its own currency whatever the rates', () => {
    const report = statsReport(ledger, scope(1), usdRates);

    expect(report.balances.accounts.map(b => [b.account.name, b.balance])).toEqual([
      ['Cash EUR', 100],
      ['Cash USD', 75],
      ['Visa USD', -100],
      ['Visa EUR', -30],
    ]);
  });

  it('leaves foreign Accounts out of the total and the Debt when rates are unavailable', () => {
    const report = statsReport(ledger, scope(1), unavailable);

    expect(report.balances.total).toBe(70);
    expect(report.balances.debt).toBe(30);
    expect(report.balances.totalWithoutDebt).toBe(100);
    expect(report.degradation.accountsExcluded).toBe(true);
    expect(report.balances.accounts).toHaveLength(4);
  });

  it('treats a missing rate for any foreign currency like unavailable rates', () => {
    const gbp = account({ id: 5, name: 'Cash GBP', currency: 'GBP', initialBalance: 10 });

    const report = statsReport(
      { ...ledger, accounts: [...ledger.accounts, gbp] },
      scope(1),
      usdRates,
    );

    expect(report.balances.total).toBe(70);
    expect(report.degradation.accountsExcluded).toBe(true);
  });

  it('rounds the degraded total to cents', () => {
    const report = statsReport(
      snapshot({
        accounts: [
          account({ id: 1, initialBalance: 0.1 }),
          account({ id: 2, initialBalance: 0.2 }),
          account({ id: 3, currency: 'USD' }),
        ],
      }),
      scope(1),
      unavailable,
    );

    expect(report.balances.total).toBe(0.3);
  });

  it('warns about a foreign Transaction with no stored conversion at or before the Scope Period', () => {
    const unconverted = { ...ledger, transactions: [txn({ id: 9, accountId: 2, amount: 5, period: 1 })] };

    expect(statsReport(unconverted, scope(1), usdRates).degradation.unconvertedTransactions).toBe(true);
    expect(statsReport(ledger, scope(1), usdRates).degradation.unconvertedTransactions).toBe(false);
  });

  it('warns about an unconverted Transaction later in the Scope year, which the year figures count', () => {
    const later = { ...ledger, transactions: [txn({ id: 9, accountId: 2, amount: 5, period: 6 })] };

    expect(statsReport(later, scope(1), usdRates).degradation.unconvertedTransactions).toBe(true);
    expect(statsReport(later, scope(1, 2027), usdRates).degradation.unconvertedTransactions).toBe(true);
    expect(statsReport(later, scope(1, 2025), usdRates).degradation.unconvertedTransactions).toBe(false);
  });
});

describe('statsReport year figures', () => {
  const cash = account({ id: 1, name: 'Cash', initialBalance: 1000 });
  const visa = account({ id: 2, name: 'Visa', kind: 'credit-card', paymentCategoryId: 4 });
  const visaPayment = category({ id: 4, name: 'Visa payment', type: 'expense' });
  const ledger = snapshot({
    accounts: [cash, visa],
    categories: [food, rent, salary, visaPayment],
    transactions: [
      txn({ id: 1, accountId: 1, categoryId: 2, amount: 3000, period: 1 }),
      txn({ id: 2, accountId: 1, categoryId: 3, amount: 1000, period: 1 }),
      txn({ id: 3, accountId: 1, categoryId: 1, amount: 500, period: 2 }),
      /* A Card Purchase: spending on Stats, but never cash-basis Expenses. */
      txn({ id: 4, accountId: 2, categoryId: 1, amount: 200, period: 2 }),
      txn({ id: 5, accountId: 1, categoryId: 2, amount: 100, period: 3 }),
    ],
  });

  it('sums the KPIs January through the Scope Period, with monthly averages and the savings rate', () => {
    const { kpis } = statsReport(ledger, scope(2), noRatesNeeded);

    expect(kpis.totals).toEqual({ income: 3000, expenses: 1500, net: 1500, periodsWithMovements: 2 });
    expect(kpis.averages).toEqual({ income: 1500, expenses: 750, net: 750 });
    expect(kpis.savingsRate).toBe(50);
    expect(kpis.hasData).toBe(true);
  });

  it('has no savings rate without Income, and no KPI data in a year without cash-basis movements', () => {
    const cardOnly = { ...ledger, transactions: [txn({ id: 1, accountId: 2, amount: 50, period: 1 })] };

    const { kpis } = statsReport(cardOnly, scope(1), noRatesNeeded);

    expect(kpis.savingsRate).toBeNull();
    expect(kpis.hasData).toBe(false);
  });

  it('reports the twelve Periods of the Scope year and the Scope Period Net', () => {
    const { yearOverview } = statsReport(ledger, scope(2), noRatesNeeded);

    expect(yearOverview.periods).toHaveLength(12);
    expect(yearOverview.periods[0]).toMatchObject({ period: 1, income: 3000, expenses: 1000, net: 2000 });
    expect(yearOverview.selectedPeriodNet).toBe(-500);
  });

  it('accumulates the total balance at every Period of the Scope year', () => {
    const { balanceStrip, balances } = statsReport(ledger, scope(2), noRatesNeeded);

    expect(balanceStrip.accumulated).toEqual([3000, 2300, 2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400]);
    expect(balanceStrip.scopePeriodBalance).toBe(2300);
    expect(balanceStrip.scopePeriodBalance).toBe(balances.total);
    expect(balanceStrip.frozenFromPeriod).toBe(3);
    expect(balanceStrip.hasMovements).toBe(true);
  });

  it('shows the strip for a year whose only movement is a Card Purchase', () => {
    const cardOnly = { ...ledger, transactions: [txn({ id: 1, accountId: 2, amount: 50, period: 4 })] };

    const { balanceStrip } = statsReport(cardOnly, scope(4), noRatesNeeded);

    expect(balanceStrip.hasMovements).toBe(true);
    expect(balanceStrip.frozenFromPeriod).toBe(4);
  });

  it('has no strip movements in a year with none, holding the carried-over balance', () => {
    const { balanceStrip } = statsReport(ledger, scope(1, 2027), noRatesNeeded);

    expect(balanceStrip.hasMovements).toBe(false);
    expect(balanceStrip.frozenFromPeriod).toBe(0);
    expect(balanceStrip.accumulated[0]).toBe(2400);
  });

  it('breaks the Scope Period spending down by category, cash and credit, without Payment Categories', () => {
    const withPayment = {
      ...ledger,
      transactions: [
        ...ledger.transactions,
        txn({ id: 6, accountId: 1, categoryId: 4, amount: 80, period: 2 }),
      ],
    };

    const { categorySpending } = statsReport(withPayment, scope(2), noRatesNeeded);

    expect(categorySpending).toEqual([{ categoryId: 1, name: 'Food', cash: 500, credit: 200, total: 700 }]);
  });
});

describe('statsReport balance strip Exchange Rate paths', () => {
  const eur = account({ id: 1, name: 'Cash EUR', currency: 'EUR', initialBalance: 100 });
  const usd = account({ id: 2, name: 'Cash USD', currency: 'USD', initialBalance: 125 });
  const ledger = snapshot({
    accounts: [eur, usd],
    transactions: [txn({ id: 1, accountId: 2, categoryId: 1, amount: 50, baseCurrencyAmount: 40, period: 1 })],
    transfers: [transfer({ sourceAccountId: 1, destinationAccountId: 2, sourceAmount: 10, destinationAmount: 12.5, baseCurrencyAmount: 10, period: 2 })],
  });

  it('accumulates converted Accounts so the Scope Period equals the total balance', () => {
    const report = statsReport(ledger, scope(2), usdRates);

    expect(report.balanceStrip.accumulated.slice(0, 2)).toEqual([160, 160]);
    expect(report.balanceStrip.scopePeriodBalance).toBe(report.balances.total);
  });

  it('accumulates only the Base Currency Accounts at face amounts when rates are unavailable', () => {
    const report = statsReport(ledger, scope(2), unavailable);

    expect(report.balanceStrip.accumulated.slice(0, 2)).toEqual([100, 90]);
    expect(report.balanceStrip.scopePeriodBalance).toBe(report.balances.total);
  });
});
