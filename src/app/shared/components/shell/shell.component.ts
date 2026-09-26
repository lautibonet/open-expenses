import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { version } from '../../../../../package.json';
import { InstallPromptComponent } from '../install-prompt/install-prompt.component';
import { UpdatePromptComponent } from '../update-prompt/update-prompt.component';
import { BottomSheetComponent } from '../bottom-sheet/bottom-sheet.component';
import { LanguageService } from '../../../core/services/language.service';
import { CaptureFormService } from '../../../core/services/capture-form.service';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { NetworkService } from '../../../core/services/network.service';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';
import { NoBackupFoundError } from '../../../backup/drive-backup-provider';
import { formatRelativeTimeIn } from '../../../core/format/relative-time';
import { formatLastBackupStatus } from '../../../backup/last-backup-status';
import { downloadBackupFile } from '../../../backup/backup-file-download';
import { TranslationError, errorCopy } from '../../../core/models/translation-error';
import { BackupSnapshot } from '../../../backup/backup-snapshot';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, InstallPromptComponent, UpdatePromptComponent, BottomSheetComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  host: { '(document:keydown)': 'onDocKeydown($event)' },
})
export class ShellComponent {
  language = inject(LanguageService);

  /** The released version, cut with the package.json field at each tag. */
  readonly appVersion = version;

  private router = inject(Router);
  private captureFormService = inject(CaptureFormService);
  private backupService = inject(DriveBackupService);
  private networkService = inject(NetworkService);
  private pwaUpdate = inject(PwaUpdateService);

  private minuteTick = signal(0);

  isBackingUp = this.backupService.isBackingUp;

  backupMethod = this.backupService.method;

  isDownloading = signal(false);

  downloadError = signal('');

  /** The install suggestion yields the strip to the urgent update banner. */
  showInstallPrompt = computed(() => !this.pwaUpdate.updateReady());

  backupCaption = computed(() => {
    const error = this.downloadError();
    if (error) return error;
    this.minuteTick();
    return formatLastBackupStatus(
      this.language.activeLanguage(),
      this.backupService.lastBackupAt(),
      this.backupService.method,
    );
  });

  /* Mobile top-bar quick actions: busy/offline semantics mirror the Settings
     backup card so behavior never contradicts itself between entry points. */
  isOnline = this.networkService.isOnline;

  isBusy = this.backupService.isBackingUp;

  pendingRestore = this.backupService.pendingRestore;

  /** The whole mobile regime (top bar, strips, sheets) lives below 768px. */
  private mobileMediaQuery: MediaQueryList | null =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)')
      : null;

  readonly isMobileLayout = signal<boolean>(this.mobileMediaQuery?.matches ?? false);

  /** Which quick action is driving the shared busy state, for the spinner. */
  private actingAction = signal<'backup' | 'restore' | null>(null);

  backupInFlight = computed(() => this.isBusy() && this.actingAction() === 'backup');

  restoreInFlight = computed(() => this.isBusy() && this.actingAction() === 'restore');

  quickActionsDisabled = computed(() => this.isBusy() || !this.isOnline());

  /** The sheet is shell-owned: it only opens for a top-bar-initiated Restore. */
  restoreSheetOpen = signal(false);

  /** Which action the strip feedback is about: none, success, or failure. */
  private feedbackKind = signal<'none' | 'success' | 'error'>('none');

  private feedbackMessage = signal('');

  feedbackCopy = computed(() => {
    this.language.activeLanguage();
    if (this.feedbackKind() === 'none') return null;
    return { kind: this.feedbackKind(), text: this.feedbackMessage() };
  });

  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  restoreDate = computed(() => {
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

  constructor() {
    const intervalId = setInterval(() => this.minuteTick.update((t) => t + 1), 60_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(intervalId);
      if (this.feedbackTimer !== null) {
        clearTimeout(this.feedbackTimer);
      }
      this.mobileMediaQuery?.removeEventListener('change', this.onMediaChange);
    });

    this.mobileMediaQuery?.addEventListener('change', this.onMediaChange);

    /* The pending Restore is shared: if the Settings card confirms or cancels
       it, the shell's sheet must not linger over a null snapshot. */
    effect(() => {
      if (!this.pendingRestore()) {
        this.restoreSheetOpen.set(false);
      }
    });
  }

  private onMediaChange = (event: MediaQueryListEvent): void => {
    this.isMobileLayout.set(event.matches);
  };

  skipToContent(event: MouseEvent): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }

  async goToTransactionForm(): Promise<void> {
    await this.navigateToMovementsIfNeeded();
    this.captureFormService.requestTransactionForm();
  }

  async goToTransferForm(): Promise<void> {
    await this.navigateToMovementsIfNeeded();
    this.captureFormService.requestTransfer();
  }

  async backUp(): Promise<void> {
    if (this.isBackingUp() || this.isDownloading()) {
      return;
    }
    try {
      await this.backupService.backupNow();
      this.showSuccessFeedback('backup.feedback.backedUp');
    } catch {
      /* Cloud backup errors surface via the service error in the strip. */
      this.showFailureFeedback();
    }
  }

  /** Quick-action Backup from the mobile top bar: same busy gates, strip feedback. */
  async quickBackUp(): Promise<void> {
    if (this.quickActionsDisabled()) {
      return;
    }
    this.actingAction.set('backup');
    try {
      await this.backUp();
    } finally {
      this.actingAction.set(null);
    }
  }

  async downloadBackup(): Promise<void> {
    if (this.isBackingUp() || this.isDownloading()) {
      return;
    }
    this.isDownloading.set(true);
    this.downloadError.set('');

    try {
      await downloadBackupFile();
    } catch (e: unknown) {
      this.downloadError.set(
        errorCopy(e, this.language.translateFn, 'backup.card.downloadFailed'),
      );
      setTimeout(() => this.downloadError.set(''), 5000);
    } finally {
      this.isDownloading.set(false);
    }
  }

  async onDocKeydown(e: KeyboardEvent): Promise<void> {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (this.router.url.startsWith('/movements')) return;
    if (e.key === 'n' || e.key === 'N') {
      await this.goToTransactionForm();
    } else if (e.key === 't' || e.key === 'T') {
      await this.goToTransferForm();
    }
  }

  /**
   * Quick-action Restore from the mobile top bar: fetch the cloud snapshot
   * into the shared pending state, then open the confirm bottom sheet. The
   * two-step confirm mirrors the Settings backup card exactly.
   */
  async quickRestore(): Promise<void> {
    if (this.quickActionsDisabled()) {
      return;
    }
    this.actingAction.set('restore');
    this.backupService.pendingRestore.set(null);

    try {
      const snapshot = await this.backupService.getCloudSnapshot();
      this.backupService.pendingRestore.set(snapshot);
      this.restoreSheetOpen.set(true);
    } catch (e: unknown) {
      if (e instanceof NoBackupFoundError) {
        this.showFailureFeedback(this.language.t('backup.noCloudBackup'));
      } else {
        this.showFailureFeedback(
          errorCopy(e, this.language.translateFn, 'backup.error.restoreFailed'),
        );
      }
    } finally {
      this.actingAction.set(null);
    }
  }

  async confirmRestore(): Promise<void> {
    const snapshot = this.backupService.pendingRestore();
    if (!snapshot) return;

    this.actingAction.set('restore');
    try {
      await this.backupService.restoreFromSnapshot(snapshot);
      this.backupService.pendingRestore.set(null);
      this.showSuccessFeedback('restore.feedback.restored');
    } catch (e: unknown) {
      this.showFailureFeedback(
        errorCopy(e, this.language.translateFn, 'backup.error.restoreFailed'),
      );
    } finally {
      this.actingAction.set(null);
    }
  }

  cancelRestore(): void {
    this.backupService.cancelPendingRestore();
  }

  dismissFeedback(): void {
    if (this.feedbackTimer !== null) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.feedbackKind.set('none');
    this.feedbackMessage.set('');
  }

  private showSuccessFeedback(key: string): void {
    /* The strip answers "did my action just succeed", not "how fresh is the
       data": the relative moment is the action's own, which for a Restore is
       now even when the restored snapshot was taken days ago (Last Backup
       answers freshness; the strip does not). */
    const when = formatRelativeTimeIn(this.language.activeLanguage(), new Date());
    this.setFeedback('success', this.language.t(key, { when }), 4000);
  }

  private showFailureFeedback(text?: string): void {
    const err = this.backupService.error();
    const message =
      text ??
      (err instanceof TranslationError
        ? this.language.t(err.key, err.params)
        : err instanceof Error
          ? err.message
          : this.language.t('backup.feedback.actionFailed'));
    this.setFeedback('error', message);
  }

  private setFeedback(kind: 'none' | 'success' | 'error', text: string, autoHideMs?: number): void {
    if (this.feedbackTimer !== null) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.feedbackKind.set(kind);
    this.feedbackMessage.set(text);
    if (autoHideMs !== undefined) {
      this.feedbackTimer = setTimeout(() => this.dismissFeedback(), autoHideMs);
    }
  }

  private async navigateToMovementsIfNeeded(): Promise<void> {
    if (!this.router.url.startsWith('/movements')) {
      await this.router.navigate(['/movements']);
    }
  }
}
