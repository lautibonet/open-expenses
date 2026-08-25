import { Component, inject } from '@angular/core';
import { PwaInstallService } from '../../../core/services/pwa-install.service';

@Component({
  selector: 'app-install-prompt',
  template: `
    @if (pwaInstall.canInstall()) {
      <div class="install-banner">
        <span>Install Open Expenses for quick access</span>
        <button class="btn primary small" (click)="install()">Install</button>
        <button class="btn small" (click)="dismiss()">Dismiss</button>
      </div>
    }
  `,
  styles: [`
    .install-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #eff6ff;
      border-bottom: 1px solid #bfdbfe;
      font-size: 0.85rem;
      color: #1e40af;
    }

    .btn {
      padding: 0.25rem 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
      font-size: 0.8rem;

      &.primary {
        background: #2563eb;
        color: #fff;
        border-color: #2563eb;
      }
    }
  `],
})
export class InstallPromptComponent {
  pwaInstall = inject(PwaInstallService);

  async install(): Promise<void> {
    await this.pwaInstall.install();
  }

  dismiss(): void {
    this.pwaInstall.dismiss();
  }
}
