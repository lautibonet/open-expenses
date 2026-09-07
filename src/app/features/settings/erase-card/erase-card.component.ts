import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { eraseAllLocalData } from '../../../core/db/database';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-erase-card',
  templateUrl: './erase-card.component.html',
  styleUrl: './erase-card.component.scss',
})
export class EraseCardComponent {
  private driveBackupService = inject(DriveBackupService);
  private router = inject(Router);
  language = inject(LanguageService);

  pendingErase = signal(false);
  isBusy = signal(false);

  requestErase(): void {
    if (this.isBusy()) return;
    this.pendingErase.set(true);
  }

  cancelErase(): void {
    this.pendingErase.set(false);
  }

  /* Erase (CONTEXT.md): a permanent wipe of all local data — the token goes
     too and the app returns to Onboarding. Nothing is recoverable. */
  async confirmErase(): Promise<void> {
    if (this.isBusy()) return;
    this.isBusy.set(true);

    try {
      await eraseAllLocalData();
      this.driveBackupService.clearStoredToken();
      await this.router.navigate(['/onboarding']);
      this.pendingErase.set(false);
    } finally {
      this.isBusy.set(false);
    }
  }
}
