import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../core/services/language.service';
import { Language, isLanguage, LANGUAGES } from '../../../core/types/language.type';
import { DismissibleAlertComponent } from '../../../shared/components/dismissible-alert/dismissible-alert.component';

@Component({
  selector: 'app-language-card',
  imports: [FormsModule, DismissibleAlertComponent],
  templateUrl: './language-card.component.html',
  styleUrl: './language-card.component.scss',
})
export class LanguageCardComponent {
  language = inject(LanguageService);

  languages = LANGUAGES;
  selected = signal<Language>(this.language.activeLanguage());
  successMessage = signal('');
  errorMessage = signal('');
  statusEpoch = signal(0);

  async applyLanguage(): Promise<void> {
    const value = this.selected();
    if (!isLanguage(value)) return;
    this.statusEpoch.update((n) => n + 1);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await this.language.setLanguage(value);
      this.successMessage.set(this.language.t('settings.languageUpdated'));
      this.errorMessage.set('');
    } catch (e: unknown) {
      this.errorMessage.set(
        e instanceof Error ? e.message : this.language.t('settings.failedUpdateLanguage'),
      );
    }
  }
}
