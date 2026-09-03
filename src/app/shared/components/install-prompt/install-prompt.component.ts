import { Component, inject } from '@angular/core';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-install-prompt',
  template: `
    @if (pwaInstall.canInstall()) {
      <div class="install-banner" role="status">
        <span>{{ language.t('install.prompt') }}</span>
        <button class="btn primary small" (click)="install()">{{ language.t('install.action') }}</button>
        <button class="btn small" (click)="dismiss()">{{ language.t('install.dismiss') }}</button>
      </div>
    }
  `,
  styles: [
    `
      @use '../../../shared/styles/patterns' as *;

      /* Strip language per DESIGN.md ("Backup Banner"): Primary Fixed fill,
         Primary bottom hairline, chrome-gutter alignment. Prose message set
         in Body Caption, not caps-label — it is a sentence, not metadata. */
      .install-banner {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0.6rem var(--chrome-gutter);
        background: var(--primary-fixed);
        border-bottom: 1px solid var(--primary);

        > span {
          flex: 1 1 auto;
          min-width: 0;
          font-size: var(--type-caption);
          line-height: var(--leading-caption);
          color: var(--on-primary-fixed);
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .install-banner {
          animation: banner-in 0.25s ease-out;
        }

        @keyframes banner-in {
          from {
            transform: translateY(-100%);
            max-height: 0;
            padding-block: 0;
            overflow: hidden;
          }
          to {
            transform: translateY(0);
            max-height: 8rem;
            padding-block: 0.5rem;
            overflow: hidden;
          }
        }
      }

      .btn {
        @extend %btn-base;
        @extend %btn-small;
        color: var(--on-surface);

        &:hover:not(:disabled) {
          background: var(--surface-container-low);
        }

        &.primary {
          @extend %btn-primary;

          &:hover:not(:disabled) {
            background: var(--primary-deep);
            border-color: var(--primary-deep);
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
  language = inject(LanguageService);

  async install(): Promise<void> {
    await this.pwaInstall.install();
  }

  dismiss(): void {
    this.pwaInstall.dismiss();
  }
}
