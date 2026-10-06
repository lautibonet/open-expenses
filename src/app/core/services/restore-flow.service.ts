import { Injectable, inject, signal } from '@angular/core';
import { DriveBackupService } from './drive-backup.service';
import { BackupSnapshot } from '../../backup/backup-snapshot';
import { RestoreCancelled, RestoreFailed, restoreOutcomeOf } from '../../backup/restore-outcome';

export type FetchOutcome = { kind: 'pending' } | RestoreCancelled | RestoreFailed;

export type ConfirmOutcome = { kind: 'restored' } | RestoreFailed;

/**
 * The two-step Restore shared by the Settings backup card and the mobile
 * top-bar quick action: get a Backup from a source (a Backup Method or an
 * uploaded file), hold it as the one Pending Restore, then confirm or decline
 * it. Each entry point keeps its own copy and confirm view; the steps and the
 * outcome of every attempt live here.
 */
@Injectable({ providedIn: 'root' })
export class RestoreFlow {
  private backupService = inject(DriveBackupService);

  private readonly pendingRestore = signal<BackupSnapshot | null>(null);
  private readonly busy = signal(false);

  /** The one Pending Restore, presented by every entry point. */
  readonly pending = this.pendingRestore.asReadonly();

  readonly restoring = this.busy.asReadonly();

  async fetch(source: () => Promise<BackupSnapshot>): Promise<FetchOutcome> {
    this.busy.set(true);
    this.pendingRestore.set(null);
    try {
      this.pendingRestore.set(await source());
      return { kind: 'pending' };
    } catch (e: unknown) {
      return restoreOutcomeOf(e);
    } finally {
      this.busy.set(false);
    }
  }

  /** Overwrites local data with the Pending Restore; null when none is pending. */
  async confirm(): Promise<ConfirmOutcome | null> {
    const snapshot = this.pendingRestore();
    if (!snapshot) return null;

    this.busy.set(true);
    try {
      await this.backupService.restoreFromSnapshot(snapshot);
      this.pendingRestore.set(null);
      return { kind: 'restored' };
    } catch (e: unknown) {
      /* A confirm is never a cancel: the user already said yes. */
      const outcome = restoreOutcomeOf(e);
      return outcome.kind === 'failed' ? outcome : { kind: 'failed', key: 'backup.error.restoreFailed' };
    } finally {
      this.busy.set(false);
    }
  }

  /** Declining the Pending Restore is a Cancelled Restore with nothing to show. */
  decline(): void {
    this.pendingRestore.set(null);
  }
}
