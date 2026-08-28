import { Component, computed, inject } from '@angular/core';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { NetworkService } from '../../../core/services/network.service';

@Component({
  selector: 'app-backup-banner',
  template: `
    @if (isOnline()) {
      <button
        type="button"
        class="backup-banner"
        (click)="backUp()"
        [disabled]="isBackingUp()"
      >
        <span class="backup-method">
          {{ isBackingUp() ? 'Backing up…' : 'Back up' }} to {{ method }}
        </span>
        <span class="backup-time">Last backup: {{ lastBackupDisplay() }}</span>
      </button>
    } @else {
      <button type="button" class="backup-banner offline" disabled>
        <span class="backup-method">{{ method }} backup</span>
        <span class="backup-time">Offline</span>
      </button>
    }
    @if (backupError()) {
      <p class="backup-banner-error">{{ backupError() }}</p>
    }
  `,
  styles: `
    .backup-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      padding: 0.6rem 1rem;
      background: #eff6ff;
      border: none;
      border-bottom: 1px solid #bfdbfe;
      cursor: pointer;
      font: inherit;
      text-align: left;

      &:hover {
        background: #dbeafe;
      }

      &:disabled {
        cursor: default;
        opacity: 0.7;
      }

      &.offline {
        color: #6b7280;
        background: #f3f4f6;
        border-bottom-color: #e5e7eb;
      }
    }

    .backup-method {
      font-weight: 600;
      color: #1e40af;
    }

    .offline .backup-method {
      color: #6b7280;
    }

    .backup-time {
      color: #3b82f6;
      font-size: 0.85rem;
    }

    .offline .backup-time {
      color: #9ca3af;
    }

    .backup-banner-error {
      margin: 0;
      padding: 0.5rem 1rem;
      background: #fef2f2;
      color: #dc2626;
      font-size: 0.85rem;
      border-bottom: 1px solid #fecaca;
    }
  `,
})
export class BackupBannerComponent {
  private backupService = inject(DriveBackupService);
  private networkService = inject(NetworkService);

  method = this.backupService.method;
  lastBackupDisplay = computed(() =>
    this.backupService.lastBackupAt()
      ? this.formatRelativeTime(this.backupService.lastBackupAt()!)
      : 'Never',
  );
  isBackingUp = computed(() => this.backupService.isBackingUp());
  isOnline = computed(() => this.networkService.isOnline());
  backupError = computed(() => this.backupService.error());

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

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  }
}
