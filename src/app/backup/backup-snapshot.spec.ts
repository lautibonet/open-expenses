import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../core/db/database';
import {
  BackupSnapshot,
  createSnapshot,
  isBackupSnapshotShape,
  overwriteLocalDb,
  parseSnapshot,
  stringifySnapshot,
} from './backup-snapshot';

function sampleSnapshot(): BackupSnapshot {
  return {
    accounts: [{ id: 1, name: 'Cash', currency: 'EUR', initialBalance: 1000, active: true, createdAt: '2026-01-01T00:00:00.000Z' }],
    categories: [{ id: 1, name: 'Food', type: 'Expense', active: true, createdAt: '2026-01-01T00:00:00.000Z' }],
    transactions: [],
    transfers: [],
    profile: [{ id: 1, baseCurrency: 'EUR', onboardingCompleted: true, lastBackupAt: null }],
    exportedAt: '2026-08-27T00:00:00.000Z',
  };
}

describe('backup-snapshot', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('stringifySnapshot / parseSnapshot', () => {
    it('round-trips the snapshot shape', () => {
      const snapshot = sampleSnapshot();
      const json = stringifySnapshot(snapshot);
      const parsed = parseSnapshot(json);

      expect(parsed).toEqual(snapshot);
      expect(parsed.exportedAt).toBe(snapshot.exportedAt);
    });

    it('parseSnapshot throws on invalid JSON', () => {
      expect(() => parseSnapshot('not json')).toThrow();
    });
  });

  describe('isBackupSnapshotShape', () => {
    it('accepts a well-formed snapshot', () => {
      expect(isBackupSnapshotShape(sampleSnapshot())).toBe(true);
    });

    it('rejects objects missing required arrays', () => {
      expect(isBackupSnapshotShape({ foo: 'bar' })).toBe(false);
      expect(isBackupSnapshotShape({ ...sampleSnapshot(), accounts: 'nope' })).toBe(false);
    });

    it('rejects a missing exportedAt timestamp', () => {
      const { exportedAt, ...rest } = sampleSnapshot();
      expect(isBackupSnapshotShape(rest)).toBe(false);
      void exportedAt;
    });
  });

  describe('createSnapshot', () => {
    it('captures every table plus an exportedAt timestamp', async () => {
      await db.accounts.add({ name: 'Cash', currency: 'EUR', initialBalance: 0, active: true, createdAt: new Date() });
      await db.categories.add({ name: 'Food', type: 'Expense', active: true, createdAt: new Date() });
      await db.profile.add({ id: 1, baseCurrency: 'EUR', onboardingCompleted: true, lastBackupAt: null });

      const snapshot = await createSnapshot();

      expect(snapshot.accounts.length).toBe(1);
      expect(snapshot.categories.length).toBe(1);
      expect(snapshot.profile.length).toBe(1);
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transfers).toEqual([]);
      expect(snapshot.exportedAt).toBeTruthy();
    });
  });

  describe('overwriteLocalDb', () => {
    it('replaces all local data with the snapshot', async () => {
      await db.accounts.add({ name: 'Old', currency: 'EUR', initialBalance: 0, active: true, createdAt: new Date() });

      const snapshot: BackupSnapshot = {
        accounts: [{ name: 'New', currency: 'USD', initialBalance: 500, active: true, createdAt: '2026-01-01T00:00:00.000Z' }],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      await overwriteLocalDb(snapshot);

      const accounts = await db.accounts.toArray();
      expect(accounts.length).toBe(1);
      expect(accounts[0].name).toBe('New');
      expect(accounts[0].currency).toBe('USD');
    });

    it('clears tables when the snapshot has no data for them', async () => {
      await db.accounts.add({ name: 'Cash', currency: 'EUR', initialBalance: 0, active: true, createdAt: new Date() });

      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      await overwriteLocalDb(snapshot);

      expect(await db.accounts.toArray()).toEqual([]);
    });

    it('backfills the period year from the date for legacy movements without a stored year', async () => {
      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [
          {
            id: 1, accountId: 1, categoryId: 1, amount: 100,
            date: '2025-12-22T00:00:00.000Z', period: 'January',
            tags: [], exchangeRate: null, baseCurrencyAmount: null, createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        transfers: [
          {
            id: 1, sourceAccountId: 1, destinationAccountId: 2,
            sourceAmount: 100, destinationAmount: 100, exchangeRate: 1, baseCurrencyAmount: 100,
            date: '2025-12-22T00:00:00.000Z', period: 'January',
            note: '', createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        profile: [],
        exportedAt: '2026-01-01T00:00:00.000Z',
      };

      await overwriteLocalDb(snapshot);

      const transactions = await db.transactions.toArray();
      const transfers = await db.transfers.toArray();
      expect(transactions[0].year).toBe(2025);
      expect(transfers[0].year).toBe(2025);
    });

    it('keeps stored period years that differ from the date year', async () => {
      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [
          {
            id: 1, accountId: 1, categoryId: 1, amount: 100,
            date: '2025-12-22T00:00:00.000Z', period: 'January', year: 2026,
            tags: [], exchangeRate: null, baseCurrencyAmount: null, createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        transfers: [],
        profile: [],
        exportedAt: '2026-01-01T00:00:00.000Z',
      };

      await overwriteLocalDb(snapshot);

      const transactions = await db.transactions.toArray();
      expect(transactions[0].year).toBe(2026);
    });
  });
});
