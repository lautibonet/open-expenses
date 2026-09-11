import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../core/db/database';
import {
  BACKUP_SCHEMA_VERSION,
  BackupSnapshot,
  NewerBackupVersionError,
  createSnapshot,
  isBackupSnapshotShape,
  migrateSnapshotToCurrent,
  overwriteLocalDb,
  parseSnapshot,
  snapshotSchemaVersion,
  stringifySnapshot,
} from './backup-snapshot';

function legacySnapshot(): BackupSnapshot {
  return {
    accounts: [{ id: 1, name: 'Cash', currency: 'EUR', initialBalance: 1000, active: true, createdAt: '2026-01-01T00:00:00.000Z' }],
    categories: [
      { id: 1, name: 'Food', type: 'Expense', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, name: 'Payroll', type: 'Income', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 3, name: 'Weird', type: 'checking', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    transactions: [
      {
        id: 1, accountId: 1, categoryId: 1, amount: 100,
        date: '2026-01-15T00:00:00.000Z', period: 'January', year: 2026,
        exchangeRate: null, baseCurrencyAmount: null, note: '',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2, accountId: 1, categoryId: 1, amount: 200,
        date: '2026-01-20T00:00:00.000Z', period: 'Enero', year: 2026,
        exchangeRate: null, baseCurrencyAmount: null, note: '',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    transfers: [
      {
        id: 1, sourceAccountId: 1, destinationAccountId: 1,
        sourceAmount: 100, destinationAmount: 100, exchangeRate: 1, baseCurrencyAmount: 100,
        date: '2026-02-01T00:00:00.000Z', period: 'February', year: 2026,
        note: '', createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    profile: [{ id: 1, baseCurrency: 'EUR', onboardingCompleted: true, lastBackupAt: null }],
    exportedAt: '2026-08-27T00:00:00.000Z',
  };
}

function sampleSnapshot(): BackupSnapshot {
  return {
    accounts: [{ id: 1, name: 'Cash', currency: 'EUR', initialBalance: 1000, active: true, createdAt: '2026-01-01T00:00:00.000Z' }],
    categories: [{ id: 1, name: 'Food', type: 'expense', active: true, createdAt: '2026-01-01T00:00:00.000Z' }],
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
      await db.accounts.add({ name: 'Cash', currency: 'EUR', initialBalance: 0, active: true, kind: 'cash', createdAt: new Date() });
      await db.categories.add({ name: 'Food', type: 'expense', active: true, createdAt: new Date() });
      await db.profile.add({ id: 1, baseCurrency: 'EUR', language: 'en', onboardingCompleted: true, lastBackupAt: null });

      const snapshot = await createSnapshot();

      expect(snapshot.accounts.length).toBe(1);
      expect(snapshot.categories.length).toBe(1);
      expect(snapshot.profile.length).toBe(1);
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transfers).toEqual([]);
      expect(snapshot.exportedAt).toBeTruthy();
    });

    it('round-trips the profile language through backup and restore', async () => {
      await db.profile.add({ id: 1, baseCurrency: 'EUR', language: 'es', onboardingCompleted: true, lastBackupAt: null });

      const snapshot = await createSnapshot();
      const restored = parseSnapshot(stringifySnapshot(snapshot));
      await overwriteLocalDb(restored);

      const profile = await db.profile.get(1);
      expect(profile?.language).toBe('es');
    });
  });

  describe('overwriteLocalDb', () => {
    it('replaces all local data with the snapshot', async () => {
      await db.accounts.add({ name: 'Old', currency: 'EUR', initialBalance: 0, active: true, kind: 'cash', createdAt: new Date() });

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
      await db.accounts.add({ name: 'Cash', currency: 'EUR', initialBalance: 0, active: true, kind: 'cash', createdAt: new Date() });

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
            date: '2025-12-22T00:00:00.000Z', period: 1,
            exchangeRate: null, baseCurrencyAmount: null, createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        transfers: [
          {
            id: 1, sourceAccountId: 1, destinationAccountId: 2,
            sourceAmount: 100, destinationAmount: 100, exchangeRate: 1, baseCurrencyAmount: 100,
            date: '2025-12-22T00:00:00.000Z', period: 1,
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
            date: '2025-12-22T00:00:00.000Z', period: 1, year: 2026,
            exchangeRate: null, baseCurrencyAmount: null, createdAt: '2026-01-01T00:00:00.000Z',
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

    it('restores legacy backups whose transactions still carry a tags property', async () => {
      const legacy = {
        ...sampleSnapshot(),
        transactions: [
          {
            id: 1, accountId: 1, categoryId: 1, amount: 100,
            date: '2026-01-15T00:00:00.000Z', period: 1, year: 2026,
            tags: ['food'],
            exchangeRate: null, baseCurrencyAmount: null, note: 'Legacy',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      await overwriteLocalDb(legacy);

      const transactions = await db.transactions.toArray();
      expect(transactions.length).toBe(1);
      expect(transactions[0].amount).toBe(100);
      expect(transactions[0].note).toBe('Legacy');
      expect(transactions[0].year).toBe(2026);
      expect('tags' in transactions[0]).toBe(false);
    });

    it('round-trips a transaction note through backup and restore', async () => {
      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [
          {
            id: 1, accountId: 1, categoryId: 1, amount: 100,
            date: '2026-01-15T00:00:00.000Z', period: 1, year: 2026,
            exchangeRate: null, baseCurrencyAmount: null,
            note: 'Dinner with friends', createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        transfers: [],
        profile: [],
        exportedAt: '2026-01-01T00:00:00.000Z',
      };

      await overwriteLocalDb(snapshot);

      const transactions = await db.transactions.toArray();
      expect(transactions[0].note).toBe('Dinner with friends');
    });
  });

  describe('schema version', () => {
    it('stamps new snapshots with the current schema version', async () => {
      const snapshot = await createSnapshot();
      expect(snapshot.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
      expect(BACKUP_SCHEMA_VERSION).toBe(2);
    });

    it('treats snapshots without a schemaVersion field as legacy version 1', () => {
      expect(snapshotSchemaVersion(sampleSnapshot())).toBe(1);
      expect(snapshotSchemaVersion({ ...sampleSnapshot(), schemaVersion: 2 })).toBe(2);
      expect(snapshotSchemaVersion({ ...sampleSnapshot(), schemaVersion: 1.5 })).toBe(1);
    });

    it('migrates a legacy snapshot in memory to locale-neutral values', () => {
      const migrated = migrateSnapshotToCurrent(legacySnapshot());

      expect(migrated.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
      expect(migrated.categories.map((c: any) => c.type)).toEqual([
        'expense', 'income', 'checking',
      ]);
      expect(migrated.transactions.map((t: any) => t.period)).toEqual([1, 'Enero']);
      expect(migrated.transfers.map((t: any) => t.period)).toEqual([2]);
    });

    it('leaves the original legacy snapshot untouched', () => {
      const legacy = legacySnapshot();
      migrateSnapshotToCurrent(legacy);
      expect(legacy.schemaVersion).toBeUndefined();
      expect(legacy.transactions[0].period).toBe('January');
    });

    it('rejects snapshots from a newer schema version', () => {
      const newer = { ...legacySnapshot(), schemaVersion: BACKUP_SCHEMA_VERSION + 1 };
      expect(() => migrateSnapshotToCurrent(newer)).toThrow(NewerBackupVersionError);
      expect(() => migrateSnapshotToCurrent(newer)).toThrow(
        /newer than this app supports/i,
      );
    });

    it('restores a legacy backup and migrates its rows into the database', async () => {
      await overwriteLocalDb(legacySnapshot());

      const categories = await db.categories.toArray();
      const transactions = await db.transactions.toArray();
      const transfers = await db.transfers.toArray();

      expect(categories.map((c) => c.type)).toEqual(['expense', 'income', 'checking']);
      expect(transactions.map((t) => t.period)).toEqual([1, 'Enero']);
      expect(transactions.map((t) => t.year)).toEqual([2026, 2026]);
      expect(transfers.map((t) => t.period)).toEqual([2]);
    });

    it('rejects a restore of a newer-version snapshot with NewerBackupVersionError', async () => {
      const newer = { ...legacySnapshot(), schemaVersion: BACKUP_SCHEMA_VERSION + 99 };
      await expect(overwriteLocalDb(newer)).rejects.toThrow(NewerBackupVersionError);
      // Local data must not have been touched by the rejected restore.
      expect(await db.accounts.toArray()).toEqual([]);
    });
  });
});
