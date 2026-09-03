import { Component, effect, inject, input, signal } from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';

export type AlertVariant = 'error' | 'success' | 'info';
export type AlertAppearance = 'strip' | 'note';

/**
 * Shared dismissible alert: a message with the app's ×-close affordance.
 * Dismissal is per occurrence — the alert reappears whenever `message` or
 * `resetKey` changes; nothing is persisted. Consumers set the host's
 * `role` (alert/status) and any outer margins.
 */
@Component({
  selector: 'app-dismissible-alert',
  template: `
    @if (message() && !dismissed()) {
      <div class="alert" [class]="'alert-' + appearance() + '-' + variant()">
        <span class="alert-message">{{ message() }}</span>
        <button
          type="button"
          class="alert-dismiss"
          (click)="dismiss()"
          [attr.aria-label]="language.t('alert.dismiss')"
          [title]="language.t('alert.dismiss')"
        >
          <svg aria-hidden="true" viewBox="0 0 10 10" focusable="false">
            <path d="M2 2l6 6M8 2 2 8" fill="none" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
      </div>
    }
  `,
  styles: `
    @use '../../../shared/styles/patterns' as *;

    :host {
      display: block;
    }

    .alert {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
    }

    .alert-strip-error {
      @extend %status-strip-error;

      margin: 0;
    }

    .alert-strip-success,
    .alert-strip-info {
      @extend %status-strip-primary;

      margin: 0;
    }

    .alert-note-error {
      color: var(--error);
      font-size: var(--type-caption);
    }

    .alert-note-success,
    .alert-note-info {
      color: var(--primary);
      font-size: var(--type-caption);
    }

    .alert-message {
      min-width: 0;
    }

    .alert-dismiss {
      @extend %alert-dismiss;
    }
  `,
})
export class DismissibleAlertComponent {
  language = inject(LanguageService);

  message = input('');
  variant = input<AlertVariant>('info');
  appearance = input<AlertAppearance>('strip');
  resetKey = input<unknown>(null);

  dismissed = signal(false);

  constructor() {
    effect(() => {
      this.message();
      this.resetKey();
      this.dismissed.set(false);
    });
  }

  dismiss(): void {
    this.dismissed.set(true);
  }
}
