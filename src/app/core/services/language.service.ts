import { Injectable, inject, signal } from '@angular/core';
import { ProfileService } from './profile.service';
import { db } from '../db/database';
import { KeptPaymentCategory, renamePaymentCategoriesFor } from '../payment-category/payment-category';
import {
  DEFAULT_LANGUAGE,
  Language,
  detectBrowserLanguage,
  isLanguage,
} from '../types/language.type';
import { isCategoryType } from '../models/category.model';
import { isMonthNumber } from '../types/period.type';
import { PeriodScope } from '../scope/scope';
import { translate } from '../translations/translations';
import { formatDateIn, formatMoneyIn, formatNumberIn } from '../format/format';
import { TranslateFn } from '../models/translation-error';

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

  /* Saves the Language and renames the Payment Categories after it in one
     transaction (issue #196). Resolves to the cards whose category kept its
     name because another category holds the translated one. */
  async setLanguage(language: Language): Promise<KeptPaymentCategory[]> {
    const kept = await db.transaction('rw', db.profile, db.accounts, db.categories, async () => {
      await this.profileService.updateLanguage(language);
      return renamePaymentCategoriesFor(language);
    });
    this.apply(language);
    return kept;
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

  get translateFn(): TranslateFn {
    return (key, params) => this.t(key, params);
  }

  monthName(period: number): string {
    return this.t(`month.${period}`);
  }

  monthInitial(period: number): string {
    return this.monthName(period).charAt(0).toLocaleUpperCase(this.activeLanguage());
  }

  monthAbbrev(period: number): string {
    return this.monthName(period)
      .slice(0, 3)
      .toLocaleUpperCase(this.activeLanguage());
  }

  monthRangeLabel(from: number, to: number): string {
    return `${this.monthAbbrev(from)}–${this.monthAbbrev(to)}`;
  }

  periodLabel(period: number | string): string {
    return isMonthNumber(period) ? this.monthName(period) : String(period);
  }

  scopeLabel(scope: PeriodScope): string {
    if (scope.kind === 'year') {
      return this.t('scope.allYear', { year: scope.year });
    }
    return `${this.monthName(scope.period)} ${scope.year}`;
  }

  categoryTypeLabel(type: string): string {
    return isCategoryType(type) ? this.t(`type.${type}`) : String(type);
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
    document.title = translate(language, 'app.title');
  }
}
