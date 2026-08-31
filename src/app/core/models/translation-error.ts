export class TranslationError extends Error {
  readonly key: string;
  readonly params?: Record<string, string | number>;

  constructor(key: string, params?: Record<string, string | number>) {
    super(key);
    this.name = 'TranslationError';
    this.key = key;
    this.params = params;
  }
}

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function errorCopy(e: unknown, t: TranslateFn, fallbackKey: string): string {
  if (e instanceof TranslationError) {
    return t(e.key, e.params);
  }
  return t(fallbackKey);
}
