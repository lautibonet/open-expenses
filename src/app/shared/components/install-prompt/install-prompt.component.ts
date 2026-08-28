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
      @use '../../../shared/styles/patterns' as *;

      .install-banner {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0.5rem var(--chrome-gutter);
        background: var(--ink-tint);
        border-bottom: 1px solid var(--ink-tint-edge);
        font-size: 0.85rem;
        color: var(--ink-well-blue);

        > span {
          flex: 1 1 auto;
          min-width: 0;
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .install-banner {
          animation: banner-in 0.25s ease-out;
        }

        @keyframes banner-in {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }
      }

      .btn {
        @extend %btn-base;
        @extend %btn-small;
        color: var(--body-ink);

        &:hover:not(:disabled) {
          background: var(--silvered-paper);
        }

        &.primary {
          @extend %btn-primary;

          &:hover:not(:disabled) {
            background: var(--ink-well-blue);
            border-color: var(--ink-well-blue);
          }
        }
      }

      @media (pointer: coarse) {
        .btn {
          min-height: 44px;
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
