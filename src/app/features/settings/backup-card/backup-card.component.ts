import { Component, computed, inject, signal } from '@angular/core';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { LanguageService } from '../../../core/services/language.service';
import { NoBackupFoundError } from '../../../backup/drive-backup-provider';
import { BackupSnapshot, createSnapshot, stringifySnapshot } from '../../../backup/backup-snapshot';

const BACKUP_FILE_NAME = 'open-expenses-backup.json';

@Component({
  selector: 'app-backup-card',
  templateUrl: './backup-card.component.html',
  styleUrl: './backup-card.component.scss',
})
export class BackupCardComponent {
  private backupService = inject(DriveBackupService);
  language = inject(LanguageService);

  method = this.backupService.method;
  pendingRestore = signal<BackupSnapshot | null>(null);
  isBusy = signal(false);
  message = signal('');
  errorMessage = signal('');

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
    this.errorMessage.set('');

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

    try {
      const snapshot = await this.backupService.parseBackupFile(file);
      this.pendingRestore.set(snapshot);
      this.errorMessage.set('');
      this.message.set('');
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
    this.errorMessage.set('');
    this.message.set('');
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
    this.errorMessage.set('');

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