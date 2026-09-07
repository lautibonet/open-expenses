import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { db } from './database';

const LEGACY_STORES = {
  accounts: '++id, name, currency, active',
  categories: '++id, name, type, active',
  transactions: '++id, accountId, categoryId, date, period, year',
  transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
  profile: 'id',
};

class LegacyDatabaseV4 extends Dexie {
  constructor() {
    super('open-expenses-v2');
    this.version(4).stores(LEGACY_STORES);
  }
}

describe('database v5 upgrade (locale-neutral storage)', () => {
  let legacy: LegacyDatabaseV4;

  beforeEach(async () => {
    await db.delete();
    legacy = new LegacyDatabaseV4();
    await legacy.open();
  });

  afterEach(async () => {
    legacy.close();
    await db.delete();
  });

  async function seedLegacyData(): Promise<void> {
    await legacy.table('categories').bulkAdd([
      { name: 'Food', type: 'Expense', active: true, createdAt: new Date() },
      { name: 'Payroll', type: 'Income', active: true, createdAt: new Date() },
      { name: 'Weird', type: 'checking', active: true, createdAt: new Date() },
    ]);
    await legacy.table('transactions').bulkAdd([
      {
        accountId: 1, categoryId: 1, amount: 10, date: new Date('2026-01-15'),
        period: 'January', year: 2026, exchangeRate: null, baseCurrencyAmount: null,
        note: '', createdAt: new Date(),
      },
      {
        accountId: 1, categoryId: 1, amount: 20, date: new Date('2026-01-20'),
        period: 'Enero', year: 2026, exchangeRate: null, baseCurrencyAmount: null,
        note: '', createdAt: new Date(),
      },
      {
        accountId: 1, categoryId: 1, amount: 30, date: new Date('2026-03-20'),
        period: 3, year: 2026, exchangeRate: null, baseCurrencyAmount: null,
        note: '', createdAt: new Date(),
      },
      {
        accountId: 1, categoryId: 1, amount: 40, date: new Date('2026-05-20'),
        period: 13, year: 2026, exchangeRate: null, baseCurrencyAmount: null,
        note: '', createdAt: new Date(),
      },
    ]);
    await legacy.table('transfers').bulkAdd([
      {
        sourceAccountId: 1, destinationAccountId: 2, sourceAmount: 100,
        destinationAmount: 100, exchangeRate: 1, baseCurrencyAmount: 100,
        date: new Date('2026-02-01'), period: 'February', year: 2026,
        note: '', createdAt: new Date(),
      },
      {
        sourceAccountId: 1, destinationAccountId: 2, sourceAmount: 200,
        destinationAmount: 200, exchangeRate: 1, baseCurrencyAmount: 200,
        date: new Date('2026-02-02'), period: 'Febrero', year: 2026,
        note: '', createdAt: new Date(),
      },
    ]);
  }

  it('converts category types to the lowercase income/expense codes', async () => {
    await seedLegacyData();
    legacy.close();

    await db.open();

    const categories = await db.categories.toArray();
    expect(categories.map((c) => c.type)).toEqual(['expense', 'income', 'checking']);
  });

  it('converts English month-name periods to month numbers', async () => {
    await seedLegacyData();
    legacy.close();

    await db.open();

    const transactions = await db.transactions.toArray();
    const transfers = await db.transfers.toArray();
    expect(transactions.map((t) => t.period)).toEqual([1, 'Enero', 3, 13]);
    expect(transfers.map((t) => t.period)).toEqual([2, 'Febrero']);
  });

  it('leaves unrecognized period strings untouched so they stay out of Scope filters', async () => {
    await seedLegacyData();
    legacy.close();

    await db.open();

    const transactions = await db.transactions.toArray();
    const unrecognized = transactions.filter((t) => typeof t.period === 'string');
    expect(unrecognized.map((t) => t.period)).toEqual(['Enero']);

    // Out-of-range numbers are also left untouched; monthsFromData excludes
    // them from Scope filters (covered in period.type.spec).
    const numeric = transactions.map((t) => t.period).filter((p) => typeof p === 'number');
    expect(numeric).toEqual([1, 3, 13]);
  });

  it('is idempotent: reopening an already-migrated database changes nothing', async () => {
    await seedLegacyData();
    legacy.close();

    await db.open();
    const afterFirstOpen = await db.transactions.toArray();
    db.close();
    await db.open();
    const afterSecondOpen = await db.transactions.toArray();

    expect(afterSecondOpen).toEqual(afterFirstOpen);
  });
});

describe('database v6 upgrade (local-midnight dates)', () => {
  let legacy: LegacyDatabaseV4;

  beforeEach(async () => {
    await db.delete();
    legacy = new LegacyDatabaseV4();
    await legacy.open();
  });

  afterEach(async () => {
    legacy.close();
    await db.delete();
  });

  it('shifts UTC-midnight dates to local midnight of the same calendar day', async () => {
    await legacy.table('transactions').bulkAdd([
      {
        accountId: 1, categoryId: 1, amount: 10, date: new Date('2026-09-01'),
        period: 9, year: 2026, exchangeRate: null, baseCurrencyAmount: null,
        note: '', createdAt: new Date(),
      },
    ]);
    await legacy.table('transfers').bulkAdd([
      {
        sourceAccountId: 1, destinationAccountId: 2, sourceAmount: 100,
        destinationAmount: 100, exchangeRate: 1, baseCurrencyAmount: 100,
        date: new Date('2026-09-02'), period: 9, year: 2026,
        note: '', createdAt: new Date(),
      },
    ]);
    legacy.close();

    await db.open();

    const [txn] = await db.transactions.toArray();
    expect([txn.date.getFullYear(), txn.date.getMonth() + 1, txn.date.getDate()]).toEqual([
      2026, 9, 1,
    ]);
    const [transfer] = await db.transfers.toArray();
    expect([
      transfer.date.getFullYear(),
      transfer.date.getMonth() + 1,
      transfer.date.getDate(),
    ]).toEqual([2026, 9, 2]);
  });

  it('leaves dates that are not UTC midnight untouched', async () => {
    const withTime = new Date(2026, 8, 1, 10, 30);
    await legacy.table('transactions').bulkAdd([
      {
        accountId: 1, categoryId: 1, amount: 10, date: withTime,
        period: 9, year: 2026, exchangeRate: null, baseCurrencyAmount: null,
        note: '', createdAt: new Date(),
      },
    ]);
    legacy.close();

    await db.open();

    const [txn] = await db.transactions.toArray();
    expect(txn.date.getTime()).toBe(withTime.getTime());
  });
});
