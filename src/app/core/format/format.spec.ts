import { describe, it, expect } from 'vitest';
import { formatDateIn, formatMoneyIn, formatNumberIn } from './format';

describe('format helpers', () => {
  it('formats currency with the English locale', () => {
    expect(formatMoneyIn('en', 12345.5, 'EUR')).toBe('€12,345.50');
  });

  it('formats currency with the Spanish locale', () => {
    expect(formatMoneyIn('es', 12345.5, 'EUR')).toBe('12.345,50\u00A0€');
  });

  it('always shows two fraction digits', () => {
    expect(formatMoneyIn('en', 3, 'EUR')).toBe('€3.00');
  });

  it('formats dates with the active language month names', () => {
    const date = new Date('2026-08-15T12:00:00Z');
    const options = { month: 'long', day: 'numeric', year: 'numeric' } as const;
    expect(formatDateIn('en', date, options)).toBe('15 August 2026');
    expect(formatDateIn('es', date, options)).toBe('15 de agosto de 2026');
  });

  it('uses a short default date style', () => {
    const date = new Date('2026-08-15T12:00:00Z');
    expect(formatDateIn('en', date)).toBe('15 Aug 2026');
    expect(formatDateIn('es', date)).toBe('15 ago 2026');
  });

  it('accepts ISO date strings', () => {
    expect(formatDateIn('en', '2026-08-15T12:00:00Z')).toBe('15 Aug 2026');
  });

  it('formats numbers with the active locale separators', () => {
    expect(formatNumberIn('en', 1234567.89)).toBe('1,234,567.89');
    expect(formatNumberIn('es', 1234567.89)).toBe('1.234.567,89');
  });
});
