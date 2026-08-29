import { db } from '../core/db/database';
import { categoryTypeFromLegacy } from '../core/models/category.model';
import { getPeriodYear, monthNumberFromName } from '../core/types/period.type';

/**
 * Schema version of Backup snapshots. Version 1 snapshots predate the field
 * and store locale-sensitive values (English month names, `Income`/`Expense`
 * category types); version 2 stores locale-neutral values (month numbers
 * 1-12, `income`/`expense` codes). See ADR 0009.
 */
export const BACKUP_SCHEMA_VERSION = 2;

export interface BackupSnapshot {
  schemaVersion?: number;
  accounts: any[];
  categories: any[];
  transactions: any[];
  transfers: any[];
  profile: any[];
  exportedAt: string;
}

export class NewerBackupVersionError extends Error {
  constructor() {
    super('Backup snapshot schema version is newer than this app supports');
    this.name = 'NewerBackupVersionError';
  }
}

export async function createSnapshot(): Promise<BackupSnapshot> {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    transfers: await db.transfers.toArray(),
    profile: await db.profile.toArray(),
    exportedAt: new Date().toISOString(),
  };
}

export function stringifySnapshot(snapshot: BackupSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseSnapshot(json: string): BackupSnapshot {
  return JSON.parse(json) as BackupSnapshot;
}

export function isBackupSnapshotShape(value: unknown): value is BackupSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const snapshot = value as Partial<BackupSnapshot>;
  return (
    typeof snapshot.exportedAt === 'string' &&
    Array.isArray(snapshot.accounts) &&
    Array.isArray(snapshot.categories) &&
    Array.isArray(snapshot.transactions) &&
    Array.isArray(snapshot.transfers) &&
    Array.isArray(snapshot.profile)
  );
}

/** Snapshots without a schemaVersion field are legacy version 1. */
export function snapshotSchemaVersion(snapshot: BackupSnapshot): number {
  const version = snapshot.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return 1;
  }
  return version;
}

function legacyPeriodToMonthNumber(period: unknown): unknown {
  // Mirrors the migration in database.ts's v5 upgrade, but for in-memory
  // snapshot migration: unknown values are passed through unchanged so they
  // keep the "invisible to Scope filters" behavior instead of being dropped.
  if (typeof period === 'number') {
    return period;
  }
  if (typeof period === 'string') {
    const month = monthNumberFromName(period);
    return month ?? period;
  }
  return period;
}

function migrateLegacyMovement(movement: any): any {
  return {
    ...movement,
    period: legacyPeriodToMonthNumber(movement?.period),
  };
}

function migrateLegacyCategory(category: any): any {
  return {
    ...category,
    type: categoryTypeFromLegacy(category?.type) ?? category?.type,
  };
}

/**
 * Migrates a snapshot to the current schema version. Legacy snapshots are
 * converted in memory (never rejected); snapshots from a newer schema version
 * are rejected with NewerBackupVersionError so the user is told to update the
 * app first.
 */
export function migrateSnapshotToCurrent(snapshot: BackupSnapshot): BackupSnapshot {
  const version = snapshotSchemaVersion(snapshot);
  if (version > BACKUP_SCHEMA_VERSION) {
    throw new NewerBackupVersionError();
  }
  if (version === BACKUP_SCHEMA_VERSION) {
    return snapshot;
  }
  return {
    ...snapshot,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    categories: snapshot.categories.map(migrateLegacyCategory),
    transactions: snapshot.transactions.map(migrateLegacyMovement),
    transfers: snapshot.transfers.map(migrateLegacyMovement),
  };
}

export async function overwriteLocalDb(snapshot: BackupSnapshot): Promise<void> {
  const migrated = migrateSnapshotToCurrent(snapshot);

  const tables = [
    { table: db.accounts as any, data: migrated.accounts },
    { table: db.categories as any, data: migrated.categories },
    {
      table: db.transactions as any,
      data: migrated.transactions.map(({ tags, ...t }: any) => ({
        ...t,
        year: getPeriodYear(t),
      })),
    },
    {
      table: db.transfers as any,
      data: migrated.transfers.map((t: any) => ({
        ...t,
        year: getPeriodYear(t),
      })),
    },
    { table: db.profile as any, data: migrated.profile },
  ];

  await db.transaction(
    'rw',
    tables.map((t) => t.table),
    async () => {
      for (const { table, data } of tables) {
        await table.clear();
        if (data?.length) await table.bulkAdd(data);
      }
    },
  );
}
