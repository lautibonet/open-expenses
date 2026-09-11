import { describe, it, expect } from 'vitest';
import {
  cardPaymentTransfers,
  cashBasisTransactions,
  countsTowardCashBasis,
  isCardPayment,
} from './cash-basis';
import { Account } from '../models/account.model';
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
  const card = account({ id: 2, name: 'Visa', kind: 'credit-card', linkedAccountId: 1 });
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
