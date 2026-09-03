export const SUPPORTED_CURRENCIES = [
  'ARS', 'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK',
  'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK',
  'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN',
  'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
] as const;

/** Glyph shown for each currency code (onboarding tiles, format fallbacks). */
export const CURRENCY_SYMBOLS: Record<(typeof SUPPORTED_CURRENCIES)[number], string> = {
  ARS: '$', AUD: 'A$', BGN: 'лв', BRL: 'R$', CAD: 'C$', CHF: 'CHF',
  CNY: '¥', CZK: 'Kč', DKK: 'kr', EUR: '€', GBP: '£', HKD: 'HK$',
  HUF: 'Ft', IDR: 'Rp', ILS: '₪', INR: '₹', ISK: 'kr', JPY: '¥',
  KRW: '₩', MXN: 'MX$', MYR: 'RM', NOK: 'kr', NZD: 'NZ$', PHP: '₱',
  PLN: 'zł', RON: 'lei', SEK: 'kr', SGD: 'S$', THB: '฿', TRY: '₺',
  USD: '$', ZAR: 'R',
};
