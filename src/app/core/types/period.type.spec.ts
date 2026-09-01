import { describe, expect, it } from 'vitest';
import {
  MONTH_NAMES,
  MONTH_NUMBERS,
  defaultScope,
  getCurrentPeriod,
  getCurrentYear,
  getPeriodYear,
  isMonthNumber,
  isValidPeriod,
  isValidYear,
  monthNumberFromName,
  monthsFromData,
  movementIsAtOrBeforePeriod,
  periodYearFromDate,
  scopeOptionsFromMovements,
  yearsFromData,
} from './period.type';

describe('period.type - scope helpers', () => {
  describe('MONTH_NUMBERS', () => {
    it('should list the months 1 through 12 in calendar order', () => {
      expect(MONTH_NUMBERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('should keep the canonical English names for legacy mapping', () => {
      expect(MONTH_NAMES[0]).toBe('January');
      expect(MONTH_NAMES[11]).toBe('December');
      expect(MONTH_NAMES).toHaveLength(12);
    });
  });

  describe('isMonthNumber / isValidPeriod', () => {
    it('should accept integers 1 through 12', () => {
      for (const m of MONTH_NUMBERS) {
        expect(isMonthNumber(m)).toBe(true);
        expect(isValidPeriod(m)).toBe(true);
      }
    });

    it('should reject out-of-range numbers, non-integers and non-numbers', () => {
      expect(isMonthNumber(0)).toBe(false);
      expect(isMonthNumber(13)).toBe(false);
      expect(isMonthNumber(6.5)).toBe(false);
      expect(isMonthNumber('6')).toBe(false);
      expect(isMonthNumber(null)).toBe(false);
      expect(isValidPeriod('January')).toBe(false);
    });
  });

  describe('monthNumberFromName', () => {
    it('maps canonical English month names to their month numbers', () => {
      expect(monthNumberFromName('January')).toBe(1);
      expect(monthNumberFromName('December')).toBe(12);
    });

    it('maps case-insensitively', () => {
      expect(monthNumberFromName('august')).toBe(8);
      expect(monthNumberFromName('AUGUST')).toBe(8);
    });

    it('returns null for unrecognized values', () => {
      expect(monthNumberFromName('Enero')).toBeNull();
      expect(monthNumberFromName('NotAMonth')).toBeNull();
      expect(monthNumberFromName('')).toBeNull();
    });
  });

  describe('getCurrentPeriod', () => {
    it('should return the current month as a number 1-12', () => {
      const expected = new Date().getMonth() + 1;
      expect(getCurrentPeriod()).toBe(expected);
      expect(isMonthNumber(getCurrentPeriod())).toBe(true);
    });
  });

  describe('defaultScope', () => {
    it('should default to the current month and year', () => {
      expect(defaultScope()).toEqual({
        kind: 'month',
        period: getCurrentPeriod(),
        year: getCurrentYear(),
      });
    });
  });

  describe('scopeOptionsFromMovements', () => {
    it('should derive both years and months from a single pass over the data', () => {
      const movements = [
        { period: 1, year: 2012, date: '2012-01-01' },
        { period: 3, year: 2015, date: '2015-03-01' },
      ];
      const options = scopeOptionsFromMovements(movements as any);
      expect(options.years).toEqual([2012, 2015, getCurrentYear()]);
      expect(options.months).toEqual([1, 3, getCurrentPeriod()]);
    });

    it('should yield empty year list and only the current month when no data', () => {
      const options = scopeOptionsFromMovements([] as any);
      expect(options.years).toEqual([getCurrentYear()]);
      expect(options.months).toEqual([getCurrentPeriod()]);
    });
  });

  describe('periodYearFromDate', () => {
    it('derives the period and year from a date string', () => {
      expect(periodYearFromDate('2025-12-22')).toEqual({ period: 12, year: 2025 });
      expect(periodYearFromDate('2026-03-10')).toEqual({ period: 3, year: 2026 });
    });

    it('derives the period from month-boundary date strings without timezone drift', () => {
      expect(periodYearFromDate('2026-01-01')).toEqual({ period: 1, year: 2026 });
      expect(periodYearFromDate('2025-12-31')).toEqual({ period: 12, year: 2025 });
      expect(periodYearFromDate('2026-03-01')).toEqual({ period: 3, year: 2026 });
    });

    it('derives the period and year from a Date object', () => {
      expect(periodYearFromDate(new Date('2024-07-05T12:00:00'))).toEqual({
        period: 7,
        year: 2024,
      });
    });

    it('derives the period for every calendar month', () => {
      for (let month = 0; month < 12; month++) {
        const date = new Date(2026, month, 15);
        expect(periodYearFromDate(date)).toEqual({ period: month + 1, year: 2026 });
      }
    });

    it('defaults to the current period and year for today', () => {
      expect(periodYearFromDate(new Date())).toEqual({
        period: getCurrentPeriod(),
        year: getCurrentYear(),
      });
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

  describe('movementIsAtOrBeforePeriod', () => {
    const scope = { kind: 'month', period: 9, year: 2026 } as const;

    it('should include a movement in its own period', () => {
      expect(movementIsAtOrBeforePeriod({ period: 9, year: 2026, date: '2026-09-05' }, scope)).toBe(true);
    });

    it('should include movements from earlier periods of the same year', () => {
      expect(movementIsAtOrBeforePeriod({ period: 1, year: 2026, date: '2026-01-05' }, scope)).toBe(true);
      expect(movementIsAtOrBeforePeriod({ period: 8, year: 2026, date: '2026-08-05' }, scope)).toBe(true);
    });

    it('should exclude movements from later periods of the same year', () => {
      expect(movementIsAtOrBeforePeriod({ period: 10, year: 2026, date: '2026-10-05' }, scope)).toBe(false);
      expect(movementIsAtOrBeforePeriod({ period: 12, year: 2026, date: '2026-12-05' }, scope)).toBe(false);
    });

    it('should include movements from earlier years regardless of month', () => {
      expect(movementIsAtOrBeforePeriod({ period: 12, year: 2025, date: '2025-12-05' }, scope)).toBe(true);
    });

    it('should exclude movements from later years regardless of month', () => {
      expect(movementIsAtOrBeforePeriod({ period: 1, year: 2027, date: '2027-01-05' }, scope)).toBe(false);
    });

    it('should compare against the stored year, not the date year', () => {
      const decDatedJanuaryPeriod = { period: 1, year: 2026, date: '2025-12-22' };
      expect(movementIsAtOrBeforePeriod(decDatedJanuaryPeriod, scope)).toBe(true);
      expect(
        movementIsAtOrBeforePeriod(decDatedJanuaryPeriod, { kind: 'month', period: 9, year: 2025 }),
      ).toBe(false);
    });

    it('should fall back to the date year when no year is stored', () => {
      expect(movementIsAtOrBeforePeriod({ period: 3, date: '2024-03-10' }, scope)).toBe(true);
      expect(movementIsAtOrBeforePeriod({ period: 3, date: '2027-03-10' }, scope)).toBe(false);
    });

    it('should exclude movements with an unrecognizable period', () => {
      expect(movementIsAtOrBeforePeriod({ period: 'Enero', year: 2026, date: '2026-01-05' }, scope)).toBe(false);
      expect(movementIsAtOrBeforePeriod({ period: 13, year: 2026, date: '2026-01-05' }, scope)).toBe(false);
    });
  });

  describe('yearsFromData', () => {
    it('should derive distinct years from the data', () => {
      const movements = [
        { period: 1, year: 2020, date: '2020-01-01' },
        { period: 2, year: 2024, date: '2024-02-01' },
        { period: 3, year: 2020, date: '2020-03-01' },
      ];
      expect(yearsFromData(movements as any)).toEqual([2020, 2024, getCurrentYear()]);
    });

    it('should sort years ascending', () => {
      const movements = [
        { period: 1, year: 2026, date: '2026-01-01' },
        { period: 1, year: 2015, date: '2015-01-01' },
        { period: 1, year: 2020, date: '2020-01-01' },
      ];
      const years = yearsFromData(movements as any, { includeCurrentYear: false });
      expect(years).toEqual([2015, 2020, 2026]);
    });

    it('should not include years outside the data range', () => {
      const movements = [
        { period: 1, year: 2012, date: '2012-01-01' },
        { period: 1, year: 2013, date: '2013-01-01' },
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
      const movements = [{ period: 1, date: '2016-01-01' }];
      expect(yearsFromData(movements as any, { includeCurrentYear: false })).toEqual([2016]);
    });
  });

  describe('monthsFromData', () => {
    it('should derive the months present in the data in canonical order', () => {
      const movements = [
        { period: 5, year: 2026, date: '2026-05-01' },
        { period: 1, year: 2026, date: '2026-01-01' },
        { period: 3, year: 2026, date: '2026-03-01' },
      ];
      const months = monthsFromData(movements as any, { includeCurrentPeriod: false });
      expect(months).toEqual([1, 3, 5]);
    });

    it('should return empty when no period data exists and current period is excluded', () => {
      expect(monthsFromData([] as any, { includeCurrentPeriod: false })).toEqual([]);
    });

    it('should ignore unrecognized period values', () => {
      const movements = [
        { period: 1, year: 2026, date: '2026-01-01' },
        { period: 'Enero', year: 2026, date: '2026-01-01' },
        { period: 13, year: 2026, date: '2026-01-01' },
        { period: 0, year: 2026, date: '2026-01-01' },
      ];
      const months = monthsFromData(movements as any, { includeCurrentPeriod: false });
      expect(months).toEqual([1]);
    });

    it('should always return months from the canonical MONTH_NUMBERS list', () => {
      const movements = [
        { period: 1, year: 2026, date: '2026-01-01' },
        { period: 12, year: 2026, date: '2026-12-01' },
      ];
      const months = monthsFromData(movements as any);
      for (const m of months) {
        expect(MONTH_NUMBERS).toContain(m);
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
