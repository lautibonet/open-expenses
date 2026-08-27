import { BackupSnapshot } from './backup-snapshot';

export interface BackupProvider {
  /** The user-facing name of the backup method, e.g. "Google Drive". */
  readonly method: string;
  /** The folder on the provider this provider stores snapshots in. */
  readonly backupFolderName: string;

  /** Uploads a snapshot to the provider's backup folder (create or update). */
  saveSnapshot(snapshot: BackupSnapshot): Promise<void>;

  /**
   * Downloads the most recent snapshot from the provider's backup folder.
   * Throws if no snapshot exists.
   */
  downloadSnapshot(): Promise<BackupSnapshot>;
}
