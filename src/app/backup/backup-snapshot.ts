import { db } from '../core/db/database';
import { cleanDataset, Dataset, DATASET_TABLES } from '../core/db/clean-dataset';

/**
 * Schema version of Backup snapshots. Version 1 snapshots predate the field
 * and store locale-sensitive values (English month names, `Income`/`Expense`
 * category types); version 2 stores locale-neutral values (month numbers
 * 1-12, `income`/`expense` codes). Version 3 carries the account kind and the
 * Credit Card fields (Limit, payment category), plus the Card Payment
 * category on a Transfer. See ADR 0009 and ADR 0022.
 */
export const BACKUP_SCHEMA_VERSION = 3;

export interface BackupSnapshot extends Dataset {
  schemaVersion?: number;
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

/**
 * Brings a snapshot of any older schema version up to the current rules (ADR
 * 0026): every snapshot runs the same row cleanup as a database upgrade,
 * whatever its version, so a Restore ends with the data a device that kept it
 * all along would hold. Only snapshots from a newer schema version are
 * rejected, with NewerBackupVersionError, so the user is told to update the
 * app first.
 */
export function migrateSnapshotToCurrent(snapshot: BackupSnapshot): BackupSnapshot {
  if (snapshotSchemaVersion(snapshot) > BACKUP_SCHEMA_VERSION) {
    throw new NewerBackupVersionError();
  }
  return {
    ...snapshot,
    ...cleanDataset(snapshot),
    schemaVersion: BACKUP_SCHEMA_VERSION,
  };
}

export async function overwriteLocalDb(snapshot: BackupSnapshot): Promise<void> {
  const migrated = migrateSnapshotToCurrent(snapshot);

  const tables = DATASET_TABLES.map((name) => ({
    table: db.table(name),
    data: migrated[name],
  }));

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
