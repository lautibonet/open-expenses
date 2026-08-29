import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { NetworkService } from '../../../core/services/network.service';
import { LanguageService } from '../../../core/services/language.service';
import { localeFor } from '../../../core/types/language.type';
import { describeBackupError } from '../../../backup/backup-errors';

@Component({
  selector: 'app-backup-banner',
  template: `
    @if (isOnline()) {
      <section class="backup-banner" [attr.aria-label]="language.t('backup.banner.ariaLabel')">
        <div class="backup-status">
          <span class="backup-method">{{
            language.t('backup.banner.methodBackup', { method: method })
          }}</span>
          <span class="backup-time">{{
            language.t('backup.banner.lastBackup', { when: lastBackupDisplay() })
          }}</span>
        </div>
        <button
          type="button"
          class="backup-action"
          (click)="backUp()"
          [disabled]="isBackingUp()"
        >
          {{ isBackingUp() ? language.t('backup.banner.backingUp') : language.t('backup.banner.backUp') }}
        </button>
      </section>
    } @else {
      <section class="backup-banner offline" [attr.aria-label]="language.t('backup.banner.ariaLabel')">
        <div class="backup-status">
          <span class="backup-method">{{
            language.t('backup.banner.methodBackup', { method: method })
          }}</span>
          <span class="backup-time">{{ language.t('backup.banner.offline') }}</span>
        </div>
        <button type="button" class="backup-action" disabled>
          {{ language.t('backup.banner.backUp') }}
        </button>
      </section>
    }
    @if (backupError()) {
      <p class="backup-banner-error" role="alert" [attr.title]="errorCopy().code">
        <span class="error-text">{{ errorCopy().text }}</span>
        <button type="button" class="error-dismiss" (click)="dismissError()">
          {{ language.t('backup.banner.dismiss') }}
        </button>
      </p>
    }
  `,
  styles: `
    @use '../../styles/patterns' as *;

    .backup-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      box-sizing: border-box;
      padding: 0.6rem var(--chrome-gutter);
      background: var(--ink-tint);
      border-bottom: 1px solid var(--ink-tint-edge);

      &.offline {
        background: var(--silvered-paper);
        border-bottom-color: var(--hairline-graphite);
      }
    }

    .backup-status {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }

      .backup-method {
      font-weight: 600;
      color: var(--ink-well-blue);

      .offline & {
        color: var(--body-ink);
      }
    }

      .backup-time {
      color: var(--ink-well-blue);
      font-size: 0.85rem;

      .offline & {
        color: var(--body-ink);
      }
    }

    .backup-action {
      @extend %btn-base;
      @extend %btn-primary;
      @extend %btn-small;
      flex-shrink: 0;

      &:disabled {
        cursor: default;
        opacity: 0.6;
      }

      .offline & {
        background: var(--paper-white);
        color: var(--muted-slate);
        border-color: var(--edge-graphite);
      }
    }

    .backup-banner-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin: 0;
      padding: 0.5rem var(--chrome-gutter);
      background: var(--danger-surface);
      color: var(--danger-text);
      font-size: 0.85rem;
      border-bottom: 1px solid var(--danger-border);
    }

    .error-text {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .error-dismiss {
      @extend %btn-base;
      @extend %btn-danger;
      @extend %btn-small;
      color: var(--danger-text);
      flex-shrink: 0;
    }

    @media (pointer: coarse) {
      .backup-action {
        min-height: 44px;
      }
    }
  `,
})
export class BackupBannerComponent {
  private backupService = inject(DriveBackupService);
  private networkService = inject(NetworkService);
  language = inject(LanguageService);

  private minuteTick = signal(0);

  method = this.backupService.method;
  lastBackupDisplay = computed(() => {
    this.minuteTick();
    this.language.activeLanguage();
    const at = this.backupService.lastBackupAt();
    return at ? this.formatRelativeTime(at) : this.language.t('backup.banner.never');
  });
  isBackingUp = this.backupService.isBackingUp;
  isOnline = this.networkService.isOnline;
  backupError = this.backupService.error;
  errorCopy = computed(() => {
    this.language.activeLanguage();
    return describeBackupError(this.backupError() ?? '', this.language.activeLanguage());
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

  async backUp(): Promise<void> {
    if (!this.isOnline() || this.isBackingUp()) {
      return;
    }
    try {
      await this.backupService.backupNow();
    } catch {
      // Errors surface via backupService.error()
    }
  }

  dismissError(): void {
    this.backupService.clearError();
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return this.language.t('backup.relative.justNow');
    const rtf = new Intl.RelativeTimeFormat(localeFor(this.language.activeLanguage()), {
      numeric: 'auto',
    });
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return rtf.format(-diffHr, 'hour');
    if (diffHr < 48) return rtf.format(-1, 'day');
    return this.language.formatDate(date, { month: 'short', day: 'numeric' });
  }
}
