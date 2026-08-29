export type Language = 'en' | 'es';

export interface LanguageOption {
  code: Language;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'es';
}

export function localeFor(language: Language): string {
  return language === 'es' ? 'es-ES' : 'en-GB';
}

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  const candidates = [navigator.language, ...(navigator.languages ?? [])];
  return candidates.some((code) => code?.toLowerCase().startsWith('es')) ? 'es' : DEFAULT_LANGUAGE;
}
