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
  styles: [
    `
      .install-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: var(--ink-tint);
        border-bottom: 1px solid var(--ink-tint-edge);
        font-size: 0.85rem;
        color: var(--ink-well-blue);
      }

      .btn {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--edge-graphite);
        border-radius: var(--radius-sm);
        background: var(--paper-white);
        cursor: pointer;
        font-size: 0.8rem;

        &.primary {
          background: var(--ledger-ink);
          color: var(--paper-white);
          border-color: var(--ledger-ink);
        }
      }
    `,
  ],
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
