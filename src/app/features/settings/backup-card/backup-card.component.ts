import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { NetworkService } from '../../../core/services/network.service';
import { LanguageService } from '../../../core/services/language.service';
import { NoBackupFoundError } from '../../../backup/drive-backup-provider';
import { BackupSnapshot, createSnapshot, stringifySnapshot } from '../../../backup/backup-snapshot';
import { DismissibleAlertComponent } from '../../../shared/components/dismissible-alert/dismissible-alert.component';
import { formatLastBackupStatus } from '../../../backup/last-backup-status';
import { describeBackupError } from '../../../backup/backup-errors';

const BACKUP_FILE_NAME = 'open-expenses-backup.json';

@Component({
  selector: 'app-backup-card',
  imports: [DismissibleAlertComponent],
  templateUrl: './backup-card.component.html',
  styleUrl: './backup-card.component.scss',
})
export class BackupCardComponent {
  private backupService = inject(DriveBackupService);
  private networkService = inject(NetworkService);
  language = inject(LanguageService);

  method = this.backupService.method;
  pendingRestore = signal<BackupSnapshot | null>(null);
  isBusy = signal(false);
  message = signal('');
  errorMessage = signal('');
  statusEpoch = signal(0);

  private minuteTick = signal(0);

  isOnline = this.networkService.isOnline;

  lastBackupDisplay = computed(() => {
    this.minuteTick();
    return formatLastBackupStatus(
      this.language.activeLanguage(),
      this.backupService.lastBackupAt(),
      this.backupService.method,
    );
  });

  serviceErrorCopy = computed(() => {
    this.language.activeLanguage();
    const raw = this.backupService.error();
    return raw ? describeBackupError(raw, this.language.activeLanguage()) : null;
  });

  constructor() {
    const intervalId = setInterval(() => this.minuteTick.update((t) => t + 1), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));

    effect(() => {
      if (!this.networkService.isOnline()) {
        this.backupService.clearError();
      }
    });
  }

  private newStatusCycle(): void {
    this.statusEpoch.update((n) => n + 1);
    this.message.set('');
    this.errorMessage.set('');
  }

  async backUp(): Promise<void> {
    if (this.isBusy() || !this.isOnline()) {
      return;
    }
    this.isBusy.set(true);
    this.newStatusCycle();

    try {
      await this.backupService.backupNow();
    } catch {
      // Cloud backup errors surface via the service-error alert.
    } finally {
      this.isBusy.set(false);
    }
  }

  backupDate = computed(() => {
    const pending = this.pendingRestore();
    if (!pending) return '';
    return this.language.formatDate(new Date(pending.exportedAt), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  async downloadBackup(): Promise<void> {
    this.isBusy.set(true);
    this.newStatusCycle();

    try {
      const snapshot = await createSnapshot();
      const blob = new Blob([stringifySnapshot(snapshot)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = BACKUP_FILE_NAME;
      anchor.click();
      URL.revokeObjectURL(url);
      this.message.set(this.language.t('backup.fileDownloaded'));
    } catch (e: unknown) {
      this.errorMessage.set(
        e instanceof Error ? e.message : this.language.t('backup.card.downloadFailed'),
      );
    } finally {
      this.isBusy.set(false);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    this.newStatusCycle();

    try {
      const snapshot = await this.backupService.parseBackupFile(file);
      this.pendingRestore.set(snapshot);
    } catch (e: unknown) {
      this.pendingRestore.set(null);
      this.errorMessage.set(
        e instanceof Error ? e.message : this.language.t('backup.error.invalidFile'),
      );
    } finally {
      input.value = '';
    }
  }

  async restoreFromCloud(): Promise<void> {
    this.isBusy.set(true);
    this.newStatusCycle();
    this.pendingRestore.set(null);

    try {
      const snapshot = await this.backupService.getCloudSnapshot();
      this.pendingRestore.set(snapshot);
    } catch (e: unknown) {
      if (e instanceof NoBackupFoundError) {
        this.errorMessage.set(this.language.t('backup.noCloudBackup'));
      } else {
        this.errorMessage.set(
          e instanceof Error ? e.message : this.language.t('backup.error.restoreFailed'),
        );
      }
    } finally {
      this.isBusy.set(false);
    }
  }

  async confirmRestore(): Promise<void> {
    const snapshot = this.pendingRestore();
    if (!snapshot) return;

    this.isBusy.set(true);
    this.newStatusCycle();

    try {
      await this.backupService.restoreFromSnapshot(snapshot);
      this.pendingRestore.set(null);
      this.message.set(this.language.t('backup.restoredOk'));
    } catch (e: unknown) {
      this.errorMessage.set(
        e instanceof Error ? e.message : this.language.t('backup.error.restoreFailed'),
      );
    } finally {
      this.isBusy.set(false);
    }
  }

  cancelRestore(): void {
    this.pendingRestore.set(null);
  }
}