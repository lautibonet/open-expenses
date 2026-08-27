import Dexie, { type Table } from 'dexie';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Profile } from '../models/profile.model';

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

import { getPeriodYear } from '../types/period.type';

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
  }
}

export const db = new AppDatabase();
