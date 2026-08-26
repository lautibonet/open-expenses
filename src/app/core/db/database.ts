import Dexie, { type Table } from 'dexie';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Profile } from '../models/profile.model';

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
  }
}

export const db = new AppDatabase();
