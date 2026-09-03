import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../core/services/language.service';
import { Language, isLanguage, LANGUAGES } from '../../../core/types/language.type';
import { errorCopy } from '../../../core/models/translation-error';

@Component({
  selector: 'app-language-card',
  imports: [FormsModule],
  templateUrl: './language-card.component.html',
  styleUrl: './language-card.component.scss',
})
export class LanguageCardComponent {
  language = inject(LanguageService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  languages = LANGUAGES;
  selected = signal<Language>(this.language.activeLanguage());
  editing = signal(false);
  editError = signal('');
  languageSelect = viewChild<ElementRef<HTMLSelectElement>>('languageSelect');

  activeLabel = computed(
    () => LANGUAGES.find((l) => l.code === this.language.activeLanguage())?.label ?? '',
  );

  /* On open, focus the select. */
  private focusEditState = effect(() => {
    if (this.editing()) {
      this.languageSelect()?.nativeElement.focus();
    }
  });

  startEdit(): void {
    this.selected.set(this.language.activeLanguage());
    this.editing.set(true);
    this.editError.set('');
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editError.set('');
    this.returnToPencil();
  }

  async applyLanguage(): Promise<void> {
    const value = this.selected();
    if (!isLanguage(value)) return;
    try {
      await this.language.setLanguage(value);
      this.editing.set(false);
      this.editError.set('');
      this.returnToPencil();
    } catch (e: unknown) {
      this.editError.set(errorCopy(e, this.language.translateFn, 'settings.failedUpdateLanguage'));
    }
  }

  /* After the edit state collapses, hand focus back to the pencil. Runs
     on a macrotask so the pencil element is back in the DOM first. */
  private returnToPencil(): void {
    setTimeout(() => {
      this.host.nativeElement
        .querySelector<HTMLButtonElement>('button[data-edit-pencil="language"]')
        ?.focus();
    });
  }
}
