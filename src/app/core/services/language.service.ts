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
import { Period, isMonthNumber } from '../types/period.type';
import { Scope, isMultiPeriod } from '../scope/scope';
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

  periodLabel(period: number | string): string {
    return isMonthNumber(period) ? this.monthName(period) : String(period);
  }

  /* A Period by its month and year: "March 2026". */
  periodName(period: Period): string {
    return `${this.monthName(period.month)} ${period.year}`;
  }

  /* A Scope by its From and To Periods: "March 2026" for one Period, "2026"
     for a whole year, "January – March 2026" within a year, and
     "November 2025 – January 2026" across a year boundary. */
  scopeLabel(scope: Scope): string {
    const { from, to } = scope;
    if (!isMultiPeriod(scope)) {
      return this.periodName(to);
    }
    if (from.year === to.year) {
      if (from.month === 1 && to.month === 12) {
        return String(to.year);
      }
      return this.t('scope.range', { from: this.monthName(from.month), to: this.periodName(to) });
    }
    return this.t('scope.range', { from: this.periodName(from), to: this.periodName(to) });
  }

  /* A Scope's short caption, by abbreviated months: "2026 · MAR" for one
     Period, "2026 · JAN–MAR" within a year, and "NOV 2025–JAN 2026" across
     a year boundary. */
  scopeCaption(scope: Scope): string {
    const { from, to } = scope;
    if (from.year === to.year) {
      const months = isMultiPeriod(scope)
        ? this.t('scope.captionRun', { from: this.monthAbbrev(from.month), to: this.monthAbbrev(to.month) })
        : this.monthAbbrev(to.month);
      return this.t('scope.caption', { year: to.year, months });
    }
    return this.t('scope.captionRun', {
      from: this.periodCaption(from),
      to: this.periodCaption(to),
    });
  }

  private periodCaption(period: Period): string {
    return this.t('scope.captionPeriod', { month: this.monthAbbrev(period.month), year: period.year });
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
