import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../core/services/language.service';
import { isLanguage, LANGUAGES } from '../../../core/types/language.type';

@Component({
  selector: 'app-language-card',
  imports: [FormsModule],
  templateUrl: './language-card.component.html',
})
export class LanguageCardComponent {
  language = inject(LanguageService);

  languages = LANGUAGES;

  async onLanguageChange(value: string): Promise<void> {
    if (!isLanguage(value)) return;
    await this.language.setLanguage(value);
  }
}
