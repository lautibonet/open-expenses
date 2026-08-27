import { db } from '../core/db/database';

export interface BackupSnapshot {
  accounts: any[];
  categories: any[];
  transactions: any[];
  transfers: any[];
  profile: any[];
  exportedAt: string;
}

export async function createSnapshot(): Promise<BackupSnapshot> {
  return {
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

export async function overwriteLocalDb(snapshot: BackupSnapshot): Promise<void> {
  const tables = [
    { table: db.accounts as any, data: snapshot.accounts },
    { table: db.categories as any, data: snapshot.categories },
    { table: db.transactions as any, data: snapshot.transactions },
    { table: db.transfers as any, data: snapshot.transfers },
    { table: db.profile as any, data: snapshot.profile },
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
