import { describe, it, expect } from 'vitest';
import { MovementListInput, MovementRow, movementList } from './movement-list';
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
    createdAt: new Date(2026, 0, 1),
    ...overrides,
  };
}

function category(overrides: Partial<Category>): Category {
  return {
    id: 1,
    name: 'Food',
    type: 'expense',
    active: true,
    createdAt: new Date(2026, 0, 1),
    ...overrides,
  };
}

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    accountId: 1,
    categoryId: 1,
    amount: 100,
    date: new Date(2026, 0, 15),
    period: 1,
    year: 2026,
    exchangeRate: null,
    baseCurrencyAmount: null,
    note: '',
    createdAt: new Date(2026, 0, 15),
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
    date: new Date(2026, 0, 15),
    period: 1,
    year: 2026,
    note: '',
    createdAt: new Date(2026, 0, 15),
    ...overrides,
  };
}

const cash = account({ id: 1, name: 'Cash' });
const savings = account({ id: 2, name: 'Savings' });
const food = category({ id: 1, name: 'Food', type: 'expense' });
const salary = category({ id: 2, name: 'Salary', type: 'income' });

function input(overrides: Partial<MovementListInput>): MovementListInput {
  return {
    transactions: [],
    transfers: [],
    accounts: [cash, savings],
    categories: [food, salary],
    baseCurrency: 'EUR',
    scope: { kind: 'month', period: 1, year: 2026 },
    filters: { categoryId: null, accountId: null, search: '', sortDir: 'desc' },
    ...overrides,
  };
}

/* "t3" for Transaction 3, "x2" for Transfer 2, in rendered order. */
function ids(rows: MovementRow[]): string[] {
  return rows.map(row =>
    row.kind === 'transaction' ? `t${row.transaction.id}` : `x${row.transfer.id}`,
  );
}

function rowsOf(list: ReturnType<typeof movementList>): MovementRow[] {
  return list.sections.flatMap(section => section.rows);
}

describe('movementList - Scope and order', () => {
  it('keeps only the movements whose stored Period falls in the Scope', () => {
    const list = movementList(
      input({
        transactions: [
          txn({ id: 1, period: 1, year: 2026 }),
          txn({ id: 2, period: 2, year: 2026, date: new Date(2026, 1, 3) }),
          /* Dated in 2025 but stored in January 2026: the stored Period wins. */
          txn({ id: 3, period: 1, year: 2026, date: new Date(2025, 11, 30) }),
        ],
        transfers: [
          transfer({ id: 1, period: 1, year: 2025 }),
          transfer({ id: 2, period: 1, year: 2026 }),
        ],
      }),
    );

    expect(ids(rowsOf(list)).sort()).toEqual(['t1', 't3', 'x2']);
    expect(list.rowCount).toBe(3);
  });

  it('a year Scope keeps every Period of that year', () => {
    const list = movementList(
      input({
        scope: { kind: 'year', year: 2026 },
        transactions: [
          txn({ id: 1, period: 1, year: 2026 }),
          txn({ id: 2, period: 7, year: 2026, date: new Date(2026, 6, 1) }),
          txn({ id: 3, period: 7, year: 2025, date: new Date(2025, 6, 1) }),
        ],
      }),
    );

    expect(ids(rowsOf(list)).sort()).toEqual(['t1', 't2']);
  });

  it('leaves a movement with an unrecognizable period out of every Scope', () => {
    const list = movementList(
      input({
        scope: { kind: 'year', year: 2026 },
        transactions: [txn({ id: 1 }), txn({ id: 2, period: 'Enero' as never })],
        transfers: [transfer({ id: 1, period: 'Enero' as never })],
      }),
    );

    expect(ids(rowsOf(list))).toEqual(['t1']);
  });

  it('merges Transactions and Transfers newest date first', () => {
    const list = movementList(
      input({
        transactions: [
          txn({ id: 1, date: new Date(2026, 0, 5) }),
          txn({ id: 2, date: new Date(2026, 0, 20) }),
        ],
        transfers: [transfer({ id: 1, date: new Date(2026, 0, 10) })],
      }),
    );

    expect(ids(rowsOf(list))).toEqual(['t2', 'x1', 't1']);
  });

  it('breaks same-day ties by id, newest creation first (#172)', () => {
    const day = new Date(2026, 0, 15);
    const list = movementList(
      input({
        transactions: [txn({ id: 3, date: day }), txn({ id: 7, date: day })],
        transfers: [transfer({ id: 5, date: day })],
      }),
    );

    expect(ids(rowsOf(list))).toEqual(['t7', 'x5', 't3']);
  });

  it('ascending is the exact reverse of descending, ties included', () => {
    const day = new Date(2026, 0, 15);
    const list = movementList(
      input({
        transactions: [
          txn({ id: 3, date: day }),
          txn({ id: 7, date: day }),
          txn({ id: 1, date: new Date(2026, 0, 2) }),
        ],
        filters: { categoryId: null, accountId: null, search: '', sortDir: 'asc' },
      }),
    );

    expect(ids(rowsOf(list))).toEqual(['t1', 't3', 't7']);
  });
});

const noFilters = { categoryId: null, accountId: null, search: '', sortDir: 'desc' as const };

describe('movementList - filters', () => {
  it('the category filter keeps that category\'s Transactions and hides every Transfer', () => {
    const list = movementList(
      input({
        transactions: [txn({ id: 1, categoryId: 1 }), txn({ id: 2, categoryId: 2 })],
        /* A Card Payment wears a category as a label, never as a classification. */
        transfers: [transfer({ id: 1, categoryId: 1 })],
        filters: { ...noFilters, categoryId: 1 },
      }),
    );

    expect(ids(rowsOf(list))).toEqual(['t1']);
  });

  it('the account filter keeps Transactions on it and Transfers from or to it', () => {
    const wallet = account({ id: 3, name: 'Wallet' });
    const list = movementList(
      input({
        accounts: [cash, savings, wallet],
        transactions: [txn({ id: 1, accountId: 1 }), txn({ id: 2, accountId: 2 })],
        transfers: [
          transfer({ id: 1, sourceAccountId: 1, destinationAccountId: 2 }),
          transfer({ id: 2, sourceAccountId: 3, destinationAccountId: 1 }),
          transfer({ id: 3, sourceAccountId: 2, destinationAccountId: 3 }),
        ],
        filters: { ...noFilters, accountId: 1 },
      }),
    );

    expect(ids(rowsOf(list)).sort()).toEqual(['t1', 'x1', 'x2']);
  });

  it('category and account filters combine', () => {
    const list = movementList(
      input({
        transactions: [
          txn({ id: 1, accountId: 1, categoryId: 1 }),
          txn({ id: 2, accountId: 2, categoryId: 1 }),
          txn({ id: 3, accountId: 1, categoryId: 2 }),
        ],
        filters: { ...noFilters, categoryId: 1, accountId: 1 },
      }),
    );

    expect(ids(rowsOf(list))).toEqual(['t1']);
    expect(list.rowCount).toBe(1);
  });
});

describe('movementList - search', () => {
  const groceries = txn({ id: 1, accountId: 1, categoryId: 1, note: 'Weekly groceries' });
  const pay = txn({ id: 2, accountId: 2, categoryId: 2, note: '' });
  const move = transfer({ id: 1, sourceAccountId: 1, destinationAccountId: 2, note: 'Rainy day' });

  function search(query: string): string[] {
    return ids(
      rowsOf(
        movementList(
          input({
            transactions: [groceries, pay],
            transfers: [move],
            filters: { ...noFilters, search: query },
          }),
        ),
      ),
    ).sort();
  }

  it('matches a Transaction by category name, account name, or note, ignoring case', () => {
    expect(search('salary')).toEqual(['t2']);
    expect(search('GROCER')).toEqual(['t1']);
  });

  it('matches a Transfer by either account name or its note', () => {
    expect(search('rainy')).toEqual(['x1']);
    expect(search('savings')).toEqual(['t2', 'x1']);
  });

  it('ignores surrounding whitespace, and a blank query matches everything', () => {
    expect(search('  food  ')).toEqual(['t1']);
    expect(search('   ')).toEqual(['t1', 't2', 'x1']);
  });

  it('never matches a Card Payment by its Payment Category', () => {
    const visa = account({ id: 3, name: 'Visa', kind: 'credit-card' });
    const visaPayment = category({ id: 9, name: 'Visa payment', type: 'expense' });
    const list = movementList(
      input({
        accounts: [cash, visa],
        categories: [food, visaPayment],
        transfers: [transfer({ id: 1, sourceAccountId: 1, destinationAccountId: 3, categoryId: 9 })],
        filters: { ...noFilters, search: 'payment' },
      }),
    );

    expect(list.rowCount).toBe(0);
  });

  it('a missing Account or Category has no name to match', () => {
    const list = movementList(
      input({
        accounts: [],
        categories: [],
        transactions: [txn({ id: 1 })],
        filters: { ...noFilters, search: 'unknown' },
      }),
    );

    expect(list.rowCount).toBe(0);
  });
});

describe('movementList - row facts', () => {
  it('a Transaction row carries its category and account names', () => {
    const [row] = rowsOf(movementList(input({ transactions: [txn({ accountId: 2, categoryId: 2 })] })));

    expect(row).toMatchObject({ kind: 'transaction', categoryName: 'Salary', accountName: 'Savings' });
  });

  it('a Transfer row carries both account names', () => {
    const [row] = rowsOf(movementList(input({ transfers: [transfer({})] })));

    expect(row).toMatchObject({ kind: 'transfer', sourceName: 'Cash', destinationName: 'Savings' });
  });

  it('a name that cannot be resolved is null', () => {
    const [t, x] = rowsOf(
      movementList(
        input({
          accounts: [],
          categories: [],
          transactions: [txn({ date: new Date(2026, 0, 20) })],
          transfers: [transfer({})],
        }),
      ),
    );

    expect(t).toMatchObject({ categoryName: null, accountName: null });
    expect(x).toMatchObject({ sourceName: null, destinationName: null });
  });

  it('resolves Deactivated Accounts and Categories', () => {
    const [row] = rowsOf(
      movementList(
        input({
          accounts: [account({ id: 1, name: 'Old cash', active: false })],
          categories: [category({ id: 1, name: 'Old food', active: false })],
          transactions: [txn({})],
        }),
      ),
    );

    expect(row).toMatchObject({ categoryName: 'Old food', accountName: 'Old cash' });
  });
});

describe('movementList - classification', () => {
  const visa = account({ id: 3, name: 'Visa', kind: 'credit-card' });
  const amex = account({ id: 4, name: 'Amex', kind: 'credit-card' });
  const visaPayment = category({ id: 9, name: 'Visa payment', type: 'expense' });

  function only(overrides: Partial<MovementListInput>): MovementRow {
    return rowsOf(
      movementList(
        input({ accounts: [cash, savings, visa, amex], categories: [food, salary, visaPayment], ...overrides }),
      ),
    )[0];
  }

  it('a Transaction flows as Income or Expense by its Category', () => {
    expect(only({ transactions: [txn({ categoryId: 2 })] })).toMatchObject({ flow: 'income', onCard: false });
    expect(only({ transactions: [txn({ categoryId: 1 })] })).toMatchObject({ flow: 'expense', onCard: false });
  });

  it('a Transaction on a Credit Card is on card', () => {
    expect(only({ transactions: [txn({ accountId: 3 })] })).toMatchObject({ onCard: true });
  });

  it('a Card Payment carries its Payment Category name', () => {
    const row = only({
      transfers: [transfer({ sourceAccountId: 1, destinationAccountId: 3, categoryId: 9 })],
    });

    expect(row).toMatchObject({ cardPaymentCategoryName: 'Visa payment' });
  });

  it('any other Transfer carries no category name, even wearing one', () => {
    expect(only({ transfers: [transfer({})] })).toMatchObject({ cardPaymentCategoryName: null });
    /* Card to Card is not a Card Payment. */
    expect(
      only({ transfers: [transfer({ sourceAccountId: 4, destinationAccountId: 3, categoryId: 9 })] }),
    ).toMatchObject({ cardPaymentCategoryName: null });
  });

  it('a Card Payment whose category cannot be resolved carries no name', () => {
    const row = only({
      transfers: [transfer({ sourceAccountId: 1, destinationAccountId: 3, categoryId: 99 })],
    });

    expect(row).toMatchObject({ cardPaymentCategoryName: null });
  });
});

describe('movementList - display amounts', () => {
  const usd = account({ id: 5, name: 'Dollars', currency: 'USD' });
  const usd2 = account({ id: 6, name: 'More dollars', currency: 'USD' });

  function only(overrides: Partial<MovementListInput>): MovementRow {
    return rowsOf(movementList(input({ accounts: [cash, savings, usd, usd2], ...overrides })))[0];
  }

  it('a Transaction on a Base Currency Account shows its amount in Base Currency', () => {
    expect(only({ transactions: [txn({ amount: 42 })] }).amount).toEqual({
      kind: 'single',
      amount: 42,
      currency: 'EUR',
    });
  });

  it('a foreign Transaction with a stored conversion shows both amounts', () => {
    const row = only({ transactions: [txn({ accountId: 5, amount: 10, baseCurrencyAmount: 8.57 })] });

    expect(row.amount).toEqual({
      kind: 'converted',
      from: { amount: 10, currency: 'USD' },
      to: { amount: 8.57, currency: 'EUR' },
    });
  });

  it('a foreign Transaction without a stored conversion shows its own currency only', () => {
    const row = only({ transactions: [txn({ accountId: 5, amount: 10, exchangeRate: 0.9 })] });

    expect(row.amount).toEqual({ kind: 'single', amount: 10, currency: 'USD' });
  });

  it('a Transaction whose Account cannot be resolved shows its amount in Base Currency', () => {
    const row = only({ transactions: [txn({ accountId: 99, amount: 7 })] });

    expect(row.amount).toEqual({ kind: 'single', amount: 7, currency: 'EUR' });
  });

  it('a cross-currency Transfer shows the source and destination amounts', () => {
    const row = only({
      transfers: [
        transfer({ sourceAccountId: 5, destinationAccountId: 1, sourceAmount: 10, destinationAmount: 8.5 }),
      ],
    });

    expect(row.amount).toEqual({
      kind: 'converted',
      from: { amount: 10, currency: 'USD' },
      to: { amount: 8.5, currency: 'EUR' },
    });
  });

  it('a same-currency Transfer shows its source amount in Base Currency, even between foreign Accounts', () => {
    const row = only({
      transfers: [transfer({ sourceAccountId: 5, destinationAccountId: 6, sourceAmount: 30, destinationAmount: 30 })],
    });

    expect(row.amount).toEqual({ kind: 'single', amount: 30, currency: 'EUR' });
  });
});

describe('movementList - day sections', () => {
  it('groups rows under one section per local day, in display order', () => {
    const list = movementList(
      input({
        transactions: [
          txn({ id: 1, date: new Date(2026, 0, 5) }),
          txn({ id: 2, date: new Date(2026, 0, 20) }),
          txn({ id: 3, date: new Date(2026, 0, 5) }),
        ],
        transfers: [transfer({ id: 1, date: new Date(2026, 0, 20) })],
      }),
    );

    expect(list.sections.map(s => s.key)).toEqual(['2026-01-20', '2026-01-05']);
    expect(list.sections.map(s => ids(s.rows))).toEqual([
      ['t2', 'x1'],
      ['t3', 't1'],
    ]);
    expect(list.sections[0].date).toEqual(new Date(2026, 0, 20));
  });

  it('ascending order carries through to the sections', () => {
    const list = movementList(
      input({
        transactions: [
          txn({ id: 1, date: new Date(2026, 0, 5) }),
          txn({ id: 2, date: new Date(2026, 0, 20) }),
        ],
        filters: { ...noFilters, sortDir: 'asc' },
      }),
    );

    expect(list.sections.map(s => s.key)).toEqual(['2026-01-05', '2026-01-20']);
  });

  it('an empty list has no sections', () => {
    expect(movementList(input({})).sections).toEqual([]);
  });
});
