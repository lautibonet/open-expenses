import { Injectable, inject, signal } from '@angular/core';
import { ProfileService } from './profile.service';
import {
  DEFAULT_LANGUAGE,
  Language,
  detectBrowserLanguage,
  isLanguage,
} from '../types/language.type';
import { translate } from '../translations/translations';
import { formatDateIn, formatMoneyIn, formatNumberIn } from '../format/format';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private profileService = inject(ProfileService);

  readonly activeLanguage = signal<Language>(DEFAULT_LANGUAGE);

  async init(): Promise<void> {
    const profile = await this.profileService.get();
    if (!profile) {
      this.apply(detectBrowserLanguage());
    } else if (isLanguage(profile.language)) {
      this.apply(profile.language);
    } else {
      this.apply(DEFAULT_LANGUAGE);
    }
  }

  async setLanguage(language: Language): Promise<void> {
    await this.profileService.updateLanguage(language);
    this.apply(language);
  }

  async applyFromProfile(): Promise<void> {
    const profile = await this.profileService.get();
    if (profile && isLanguage(profile.language)) {
      this.apply(profile.language);
    }
  }

  t(key: string, params?: Record<string, string | number>): string {
    return translate(this.activeLanguage(), key, params);
  }

  formatMoney(amount: number, currency: string): string {
    return formatMoneyIn(this.activeLanguage(), amount, currency);
  }

  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return formatNumberIn(this.activeLanguage(), value, options);
  }

  formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    return formatDateIn(this.activeLanguage(), date, options);
  }

  private apply(language: Language): void {
    this.activeLanguage.set(language);
    document.documentElement.lang = language;
  }
}
