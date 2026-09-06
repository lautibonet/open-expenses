import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import pkg from '../../../../../package.json';
import { InstallPromptComponent } from '../install-prompt/install-prompt.component';
import { UpdatePromptComponent } from '../update-prompt/update-prompt.component';
import { LanguageService } from '../../../core/services/language.service';
import { CaptureFormService } from '../../../core/services/capture-form.service';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';
import { formatLastBackupStatus } from '../../../backup/last-backup-status';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, InstallPromptComponent, UpdatePromptComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  host: { '(document:keydown)': 'onDocKeydown($event)' },
})
export class ShellComponent {
  language = inject(LanguageService);

  /** The released version, cut with the package.json field at each tag. */
  readonly appVersion = pkg.version;

  private router = inject(Router);
  private captureFormService = inject(CaptureFormService);
  private backupService = inject(DriveBackupService);
  private pwaUpdate = inject(PwaUpdateService);

  private minuteTick = signal(0);

  isBackingUp = this.backupService.isBackingUp;

  /** The install suggestion yields the strip to the urgent update banner. */
  showInstallPrompt = computed(() => !this.pwaUpdate.updateReady());

  backupCaption = computed(() => {
    this.minuteTick();
    return formatLastBackupStatus(
      this.language.activeLanguage(),
      this.backupService.lastBackupAt(),
      this.backupService.method,
    );
  });

  constructor() {
    const intervalId = setInterval(() => this.minuteTick.update((t) => t + 1), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }

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
    if (this.isBackingUp()) {
      return;
    }
    try {
      await this.backupService.backupNow();
    } catch {
      // Backup errors surface in the Settings backup card.
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

  private async navigateToMovementsIfNeeded(): Promise<void> {
    if (!this.router.url.startsWith('/movements')) {
      await this.router.navigate(['/movements']);
    }
  }
}
