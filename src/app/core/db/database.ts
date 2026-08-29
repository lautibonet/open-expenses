import Dexie, { type Table } from 'dexie';
import { Account } from '../models/account.model';
import { Category, categoryTypeFromLegacy } from '../models/category.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Profile } from '../models/profile.model';
import { getPeriodYear, monthNumberFromName } from '../types/period.type';

interface LegacyTransfer {
  id?: number;
  sourceAccountId: number;
  destinationAccountId: number;
  amount: number;
  date: Date;
  period: string;
  note: string;
  createdAt: Date;
}

/**
 * Locale-neutral storage (ADR 0009): Period becomes an integer month 1-12 and
 * category type becomes the lowercase code `income`/`expense`. Values that
 * cannot be recognized are left untouched so nothing is destroyed by the
 * migration; unrecognized periods simply stay invisible to Scope filters.
 *
 * Returns the month number for a stored period, or null when the value is
 * already locale-neutral-unknown and must be left untouched.
 */
function toMonthNumber(period: unknown): number | null {
  if (typeof period === 'number') {
    return Number.isInteger(period) && period >= 1 && period <= 12 ? period : null;
  }
  if (typeof period === 'string') {
    return monthNumberFromName(period);
  }
  return null;
}

export class AppDatabase extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;
  transactions!: Table<Transaction>;
  transfers!: Table<Transfer>;
  profile!: Table<Profile>;

  constructor() {
    super('open-expenses-v2');
    this.version(1).stores({
      accounts: '++id, name, currency, active',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, *tags',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period',
      profile: 'id',
    });
    this.version(2).stores({
      accounts: '++id, name, currency, active',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, *tags',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period',
      profile: 'id',
    }).upgrade(async tx => {
      const transfers = await tx.table('transfers').toArray();
      for (const t of transfers) {
        const legacy = t as unknown as LegacyTransfer;
        await tx.table('transfers').update(legacy.id!, {
          sourceAmount: legacy.amount,
          destinationAmount: legacy.amount,
          exchangeRate: 1,
          baseCurrencyAmount: legacy.amount,
        });
      }
    });
    this.version(3).stores({
      accounts: '++id, name, currency, active',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year, *tags',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
    }).upgrade(async tx => {
      const transactions = await tx.table('transactions').toArray();
      for (const t of transactions) {
        if (t.year == null) {
          await tx.table('transactions').update(t.id!, {
            year: getPeriodYear(t),
          });
        }
      }
      const transfers = await tx.table('transfers').toArray();
      for (const t of transfers) {
        if (t.year == null) {
          await tx.table('transfers').update(t.id!, {
            year: getPeriodYear(t),
          });
        }
      }
    });
    this.version(4).stores({
      accounts: '++id, name, currency, active',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
    });
    this.version(5).stores({
      accounts: '++id, name, currency, active',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
    }).upgrade(async tx => {
      const categories = await tx.table('categories').toArray();
      for (const c of categories) {
        const type = categoryTypeFromLegacy((c as Category).type);
        if (type !== null && type !== c.type) {
          await tx.table('categories').update(c.id!, { type });
        }
      }
      for (const tableName of ['transactions', 'transfers'] as const) {
        const movements = await tx.table(tableName).toArray();
        for (const m of movements) {
          const period = toMonthNumber(m.period);
          if (period !== null && period !== m.period) {
            await tx.table(tableName).update(m.id!, { period });
          }
        }
      }
    });
  }
}

export const db = new AppDatabase();
