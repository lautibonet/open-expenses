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
import { FetchOutcome, RestoreFlow } from '../../../core/services/restore-flow.service';
import { downloadBackupFile } from '../../../backup/backup-file-download';
import { DismissibleAlertComponent } from '../../../shared/components/dismissible-alert/dismissible-alert.component';
import { formatLastBackupStatus } from '../../../backup/last-backup-status';
import { describeBackupError } from '../../../backup/backup-errors';
import { TranslationError, errorCopy } from '../../../core/models/translation-error';


@Component({
  selector: 'app-backup-card',
  imports: [DismissibleAlertComponent],
  templateUrl: './backup-card.component.html',
  styleUrl: './backup-card.component.scss',
})
export class BackupCardComponent {
  private backupService = inject(DriveBackupService);
  private networkService = inject(NetworkService);
  private restoreFlow = inject(RestoreFlow);
  language = inject(LanguageService);

  method = this.backupService.method;
  pendingRestore = this.restoreFlow.pending;

  /** The card's own Backup and download work; a Restore's comes from the shared flow. */
  private working = signal(false);

  isBusy = computed(() => this.working() || this.restoreFlow.restoring());
  message = signal('');
  infoMessage = signal('');
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
    const err = this.backupService.error();
    if (!err) return null;
    if (err instanceof TranslationError) {
      return { text: this.language.t(err.key, err.params), code: null };
    }
    const raw = err instanceof Error ? err.message : String(err);
    return describeBackupError(raw, this.language.activeLanguage());
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

  /* A Restore starts a fresh status cycle for the whole card: a stale Backup
     error must not sit beside the Restore's own outcome. */
  private newRestoreCycle(): void {
    this.backupService.clearError();
    this.newStatusCycle();
  }

  private newStatusCycle(): void {
    this.statusEpoch.update((n) => n + 1);
    this.message.set('');
    this.infoMessage.set('');
    this.errorMessage.set('');
  }

  async backUp(): Promise<void> {
    if (this.isBusy() || !this.isOnline()) {
      return;
    }
    this.working.set(true);
    this.newStatusCycle();

    try {
      await this.backupService.backupNow();
    } catch {
      // Cloud backup errors surface via the service-error alert.
    } finally {
      this.working.set(false);
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
    this.working.set(true);
    this.newStatusCycle();

    try {
      await downloadBackupFile();
      this.message.set(this.language.t('backup.fileDownloaded'));
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(e, this.language.translateFn, 'backup.card.downloadFailed'),
      );
    } finally {
      this.working.set(false);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    this.newRestoreCycle();
    input.value = '';
    this.showFetchOutcome(await this.restoreFlow.fetch(() => this.backupService.parseBackupFile(file)));
  }

  async restoreFromCloud(): Promise<void> {
    this.newRestoreCycle();
    this.showFetchOutcome(await this.restoreFlow.fetch(() => this.backupService.getCloudSnapshot()));
  }

  async confirmRestore(): Promise<void> {
    if (!this.pendingRestore()) return;

    this.newRestoreCycle();
    const outcome = await this.restoreFlow.confirm();
    if (outcome?.kind === 'restored') {
      this.message.set(this.language.t('backup.restoredOk'));
    } else if (outcome?.kind === 'failed') {
      this.errorMessage.set(this.language.t(outcome.key, outcome.params));
    }
  }

  cancelRestore(): void {
    this.restoreFlow.decline();
  }

  private showFetchOutcome(outcome: FetchOutcome): void {
    if (outcome.kind === 'cancelled') {
      this.infoMessage.set(this.language.t(outcome.key));
    } else if (outcome.kind === 'failed') {
      this.errorMessage.set(this.language.t(outcome.key, outcome.params));
    }
  }
}
