import { createSnapshot, stringifySnapshot } from './backup-snapshot';

const BACKUP_FILE_NAME = 'open-expenses-backup.json';

/** Snapshots the full dataset now and saves it as a downloaded file. */
export async function downloadBackupFile(): Promise<void> {
  const snapshot = await createSnapshot();
  const blob = new Blob([stringifySnapshot(snapshot)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = BACKUP_FILE_NAME;
  anchor.click();
  URL.revokeObjectURL(url);
}
