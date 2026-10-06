import Dexie, { type Table } from 'dexie';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Profile } from '../models/profile.model';
import { cleanDataset, Dataset, DATASET_TABLES } from './clean-dataset';

class AppDatabase extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;
  transactions!: Table<Transaction>;
  transfers!: Table<Transfer>;
  profile!: Table<Profile>;

  constructor() {
    super('open-expenses-v2');
    /* ADR 0026: the schema history stays declared, but its row repairs no
       longer live per version. Every upgrade runs the one row cleanup over
       the whole database; a rule change bumps the version so it reruns. */
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
    });
    this.version(3).stores({
      accounts: '++id, name, currency, active',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year, *tags',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
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
    });
    this.version(6).stores({
      accounts: '++id, name, currency, active',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
    });
    this.version(7).stores({
      accounts: '++id, name, currency, active, kind',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
    });
    this.version(8).stores({
      accounts: '++id, name, currency, active, kind',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
    });
    this.version(9).stores({
      accounts: '++id, name, currency, active, kind',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
    });
    /* ADR 0028: reruns the cleanup to repair every Transfer's base amount. */
    this.version(10).stores({
      accounts: '++id, name, currency, active, kind',
      categories: '++id, name, type, active',
      transactions: '++id, accountId, categoryId, date, period, year',
      transfers: '++id, sourceAccountId, destinationAccountId, date, period, year',
      profile: 'id',
    }).upgrade(async tx => {
      const dataset = {} as Dataset;
      for (const name of DATASET_TABLES) {
        dataset[name] = await tx.table(name).toArray();
      }
      const cleaned = cleanDataset(dataset);
      for (const name of DATASET_TABLES) {
        await tx.table(name).bulkPut(cleaned[name]);
      }
    });
  }
}

export const db = new AppDatabase();

/** Erase (GLOSSARY.md): a permanent wipe of all local data. Atomic, irreversible. */
export async function eraseAllLocalData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.accounts, db.categories, db.transactions, db.transfers, db.profile],
    async () => {
      await db.accounts.clear();
      await db.categories.clear();
      await db.transactions.clear();
      await db.transfers.clear();
      await db.profile.clear();
    },
  );
}
