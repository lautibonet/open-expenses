import { describe, expect, it } from 'vitest';
import {
  MONTHS,
  defaultScope,
  getCurrentPeriod,
  getCurrentYear,
  getPeriodYear,
  isAllTime,
  isValidYear,
  monthsFromData,
  scopeLabel,
  scopeOptionsFromMovements,
  yearsFromData,
} from './period.type';

describe('period.type - scope helpers', () => {
  describe('defaultScope', () => {
    it('should default to the current month and year', () => {
      expect(defaultScope()).toEqual({
        kind: 'month',
        period: getCurrentPeriod(),
        year: getCurrentYear(),
      });
    });
  });

  describe('isAllTime', () => {
    it('should be true for an all-time scope', () => {
      expect(isAllTime({ kind: 'all-time' })).toBe(true);
    });

    it('should be false for a month scope', () => {
      expect(isAllTime({ kind: 'month', period: 'January', year: 2026 })).toBe(false);
    });
  });

  describe('scopeLabel', () => {
    it('should label a month scope with period and year', () => {
      expect(scopeLabel({ kind: 'month', period: 'August', year: 2026 })).toBe('August 2026');
    });

    it('should label the all-time scope', () => {
      expect(scopeLabel({ kind: 'all-time' })).toBe('All time');
    });
  });

  describe('scopeOptionsFromMovements', () => {
    it('should derive both years and months from a single pass over the data', () => {
      const movements = [
        { period: 'January', year: 2012, date: '2012-01-01' },
        { period: 'March', year: 2015, date: '2015-03-01' },
      ];
      const options = scopeOptionsFromMovements(movements as any);
      expect(options.years).toEqual([2012, 2015, getCurrentYear()]);
      expect(options.months).toEqual(['January', 'March', getCurrentPeriod()]);
    });

    it('should yield empty year list and only the current month when no data', () => {
      const options = scopeOptionsFromMovements([] as any);
      expect(options.years).toEqual([getCurrentYear()]);
      expect(options.months).toEqual([getCurrentPeriod()]);
    });
  });

  describe('getPeriodYear', () => {
    it('should prefer the stored year over the date year', () => {
      expect(getPeriodYear({ year: 2026, date: new Date('2025-12-22') })).toBe(2026);
    });

    it('should fall back to the date year when no year is stored', () => {
      expect(getPeriodYear({ date: new Date('2025-12-22') })).toBe(2025);
    });
  });

  describe('yearsFromData', () => {
    it('should derive distinct years from the data', () => {
      const movements = [
        { period: 'January', year: 2020, date: '2020-01-01' },
        { period: 'February', year: 2024, date: '2024-02-01' },
        { period: 'March', year: 2020, date: '2020-03-01' },
      ];
      expect(yearsFromData(movements as any)).toEqual([2020, 2024, getCurrentYear()]);
    });

    it('should sort years ascending', () => {
      const movements = [
        { period: 'January', year: 2026, date: '2026-01-01' },
        { period: 'January', year: 2015, date: '2015-01-01' },
        { period: 'January', year: 2020, date: '2020-01-01' },
      ];
      const years = yearsFromData(movements as any, { includeCurrentYear: false });
      expect(years).toEqual([2015, 2020, 2026]);
      expect(years).toContain(2015);
      expect(years).toContain(2026);
    });

    it('should not include years outside the data range', () => {
      const movements = [
        { period: 'January', year: 2012, date: '2012-01-01' },
        { period: 'January', year: 2013, date: '2013-01-01' },
      ];
      const years = yearsFromData(movements as any, { includeCurrentYear: false });
      expect(years).toEqual([2012, 2013]);
      expect(years).not.toContain(2005);
    });

    it('should include the current year by default', () => {
      expect(yearsFromData([], { includeCurrentYear: true })).toEqual([getCurrentYear()]);
      expect(yearsFromData([])).toEqual([getCurrentYear()]);
    });

    it('should support excluding the current year', () => {
      expect(yearsFromData([], { includeCurrentYear: false })).toEqual([]);
    });

    it('should include legacy movements via their date year', () => {
      const movements = [{ period: 'January', date: '2016-01-01' }];
      expect(yearsFromData(movements as any, { includeCurrentYear: false })).toEqual([2016]);
    });
  });

  describe('monthsFromData', () => {
    it('should derive the months present in the data in canonical order', () => {
      const movements = [
        { period: 'May', year: 2026, date: '2026-05-01' },
        { period: 'January', year: 2026, date: '2026-01-01' },
        { period: 'March', year: 2026, date: '2026-03-01' },
      ];
      const months = monthsFromData(movements as any, { includeCurrentPeriod: false });
      expect(months).toEqual(['January', 'March', 'May']);
    });

    it('should return empty when no period data exists and current period is excluded', () => {
      expect(monthsFromData([] as any, { includeCurrentPeriod: false })).toEqual([]);
    });

    it('should ignore unrecognised month names', () => {
      const movements = [
        { period: 'January', year: 2026, date: '2026-01-01' },
        { period: 'NotAMonth', year: 2026, date: '2026-01-01' },
      ];
      const months = monthsFromData(movements as any, { includeCurrentPeriod: false });
      expect(months).toEqual(['January']);
    });

    it('should always return months from the canonical MONTHS list', () => {
      const movements = [
        { period: 'January', year: 2026, date: '2026-01-01' },
        { period: 'December', year: 2026, date: '2026-12-01' },
      ];
      const months = monthsFromData(movements as any);
      for (const m of months) {
        expect(MONTHS).toContain(m);
      }
    });

    it('should include the current period by default', () => {
      expect(monthsFromData([] as any)).toEqual([getCurrentPeriod()]);
    });
  });

  describe('isValidYear', () => {
    it('should accept valid four-digit years', () => {
      expect(isValidYear(2026)).toBe(true);
      expect(isValidYear(1000)).toBe(true);
      expect(isValidYear(9999)).toBe(true);
    });

    it('should reject invalid years', () => {
      expect(isValidYear(99)).toBe(false);
      expect(isValidYear(10000)).toBe(false);
      expect(isValidYear(2026.5)).toBe(false);
    });
  });
});
