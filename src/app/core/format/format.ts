import { Language } from '../types/language.type';
import { localeFor } from '../types/language.type';

export function formatMoneyIn(language: Language, amount: number, currency: string): string {
  return new Intl.NumberFormat(localeFor(language), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumberIn(
  language: Language,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}

export function formatDateIn(
  language: Language,
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(localeFor(language), options).format(new Date(date));
}
