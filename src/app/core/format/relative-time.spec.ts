import { describe, it, expect } from 'vitest';
import { formatRelativeTimeIn } from './relative-time';

describe('formatRelativeTimeIn', () => {
  const now = new Date('2026-08-31T12:00:00');

  it('returns Just now for less than a minute ago', () => {
    expect(formatRelativeTimeIn('en', new Date('2026-08-31T11:59:30'), now)).toBe('Just now');
  });

  it('formats minutes', () => {
    expect(formatRelativeTimeIn('en', new Date('2026-08-31T11:55:00'), now)).toBe('5 minutes ago');
  });

  it('formats hours', () => {
    expect(formatRelativeTimeIn('en', new Date('2026-08-31T09:00:00'), now)).toBe('3 hours ago');
  });

  it('formats yesterday', () => {
    expect(formatRelativeTimeIn('en', new Date('2026-08-30T09:00:00'), now)).toBe('yesterday');
  });

  it('formats older dates as a short date', () => {
    expect(formatRelativeTimeIn('en', new Date('2026-08-01T09:00:00'), now)).toBe('1 Aug');
  });

  it('formats in Spanish', () => {
    expect(formatRelativeTimeIn('es', new Date('2026-08-31T11:55:00'), now)).toBe(
      'hace 5 minutos',
    );
    expect(formatRelativeTimeIn('es', new Date('2026-08-31T09:00:00'), now)).toBe(
      'hace 3 horas',
    );
    expect(formatRelativeTimeIn('es', new Date('2026-08-01T09:00:00'), now)).toBe('1 ago');
  });
});
