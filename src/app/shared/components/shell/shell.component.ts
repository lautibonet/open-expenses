import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { InstallPromptComponent } from '../install-prompt/install-prompt.component';
import { BackupBannerComponent } from '../backup-banner/backup-banner.component';
import { LanguageService } from '../../../core/services/language.service';
import { CaptureFormService } from '../../../core/services/capture-form.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, InstallPromptComponent, BackupBannerComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  host: { '(document:keydown)': 'onDocKeydown($event)' },
})
export class ShellComponent {
  language = inject(LanguageService);
  private router = inject(Router);
  private captureFormService = inject(CaptureFormService);

  skipToContent(event: MouseEvent): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }

  async goToQuickAdd(): Promise<void> {
    await this.navigateToMovementsIfNeeded();
    this.captureFormService.requestQuickAdd();
  }

  async goToTransferForm(): Promise<void> {
    await this.navigateToMovementsIfNeeded();
    this.captureFormService.requestTransfer();
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
      await this.goToQuickAdd();
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
