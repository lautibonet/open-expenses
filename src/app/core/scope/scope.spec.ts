import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MONTH_NUMBERS, getCurrentPeriod, getCurrentYear } from '../types/period.type';
import {
  MonthScope,
  changeMonth,
  changeYear,
  defaultScope,
  monthsFromData,
  scopeFromQuery,
  scopeOptions,
  scopeQuery,
  yearsFromData,
} from './scope';

describe('scope', () => {
  describe('changeYear', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 15));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should keep the month when the year does not change', () => {
      const next: MonthScope = changeYear({ kind: 'month', period: 3, year: 2026 }, 2026);
      expect(next).toEqual({ kind: 'month', period: 3, year: 2026 });
    });

    it('should move a month Scope to the current month of another year', () => {
      const next: MonthScope = changeYear({ kind: 'month', period: 3, year: 2026 }, 2024);
      expect(next).toEqual({ kind: 'month', period: 10, year: 2024 });
    });

    it('should keep the year Scope a whole year', () => {
      expect(changeYear({ kind: 'year', year: 2026 }, 2024)).toEqual({ kind: 'year', year: 2024 });
    });
  });

  describe('changeMonth', () => {
    const options = scopeOptions([
      { period: 2, year: 2024, date: new Date(2024, 1, 1) },
      { period: 6, year: 2024, date: new Date(2024, 5, 1) },
    ]);

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 15));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should pick a month within the Scope year', () => {
      const next: MonthScope = changeMonth({ kind: 'month', period: 3, year: 2024 }, 5);
      expect(next).toEqual({ kind: 'month', period: 5, year: 2024 });
    });

    it('should leave the year Scope for the picked month', () => {
      expect(changeMonth({ kind: 'year', year: 2024 }, 2, options)).toEqual({
        kind: 'month',
        period: 2,
        year: 2024,
      });
    });

    it('should widen to the year Scope on "all"', () => {
      expect(changeMonth({ kind: 'month', period: 3, year: 2024 }, 'all', options)).toEqual({
        kind: 'year',
        year: 2024,
      });
    });

    it('should default to the latest month with data when leaving the year Scope of a past year', () => {
      expect(changeMonth({ kind: 'year', year: 2024 }, null, options)).toEqual({
        kind: 'month',
        period: 6,
        year: 2024,
      });
    });

    it('should default to the current month on the current year', () => {
      expect(changeMonth({ kind: 'year', year: 2026 }, null, options)).toEqual({
        kind: 'month',
        period: 10,
        year: 2026,
      });
    });

    it('should default to the current month on a past year without data', () => {
      expect(changeMonth({ kind: 'year', year: 2020 }, null, options)).toEqual({
        kind: 'month',
        period: 10,
        year: 2020,
      });
    });
  });

  describe('scopeQuery / scopeFromQuery', () => {
    it('should write a month Scope as its month number and year', () => {
      expect(scopeQuery({ kind: 'month', period: 3, year: 2026 })).toBe('period=3&year=2026');
    });

    it('should write the year Scope as the "all" period', () => {
      expect(scopeQuery({ kind: 'year', year: 2025 })).toBe('period=all&year=2025');
    });

    it('should read back what it writes', () => {
      expect(scopeFromQuery(new URLSearchParams('period=3&year=2026'))).toEqual({
        kind: 'month',
        period: 3,
        year: 2026,
      });
      expect(scopeFromQuery(new URLSearchParams('period=all&year=2025'))).toEqual({
        kind: 'year',
        year: 2025,
      });
    });

    it('should read nothing from a missing or invalid year', () => {
      expect(scopeFromQuery(new URLSearchParams(''))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=3'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=3&year=99'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=all&year=abc'))).toBeNull();
    });

    it('should read nothing from a missing or invalid period', () => {
      expect(scopeFromQuery(new URLSearchParams('year=2026'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=13&year=2026'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=March&year=2026'))).toBeNull();
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

  describe('scopeOptions', () => {
    it('should derive both years and months from a single pass over the data', () => {
      const movements = [
        { period: 1, year: 2012, date: new Date(2012, 0, 1) },
        { period: 3, year: 2015, date: new Date(2015, 2, 1) },
      ];
      const options = scopeOptions(movements as any);
      expect(options.years).toEqual([2012, 2015, getCurrentYear()]);
      expect(options.months).toEqual([1, 3, getCurrentPeriod()]);
    });

    it('should yield empty year list and only the current month when no data', () => {
      const options = scopeOptions([] as any);
      expect(options.years).toEqual([getCurrentYear()]);
      expect(options.months).toEqual([getCurrentPeriod()]);
    });

    it('should record the latest month with data in each stored Period year', () => {
      const options = scopeOptions([
        { period: 2, year: 2024, date: new Date(2024, 1, 1) },
        { period: 6, year: 2024, date: new Date(2024, 5, 1) },
        { period: 4, year: 2024, date: new Date(2024, 3, 1) },
        { period: 1, year: 2025, date: new Date(2024, 11, 30) },
        { period: 9, date: new Date(2023, 8, 15) },
      ]);
      expect(options.latestMonthByYear.get(2024)).toBe(6);
      expect(options.latestMonthByYear.get(2025)).toBe(1);
      expect(options.latestMonthByYear.get(2023)).toBe(9);
    });

    it('should ignore an unrecognizable period for the latest month', () => {
      const options = scopeOptions([
        { period: 3, year: 2024, date: new Date(2024, 2, 1) },
        { period: 'Diciembre', year: 2024, date: new Date(2024, 11, 1) },
      ]);
      expect(options.latestMonthByYear.get(2024)).toBe(3);
    });
  });

  describe('yearsFromData', () => {
    it('should derive distinct years from the data', () => {
      const movements = [
        { period: 1, year: 2020, date: new Date(2020, 0, 1) },
        { period: 2, year: 2024, date: new Date(2024, 1, 1) },
        { period: 3, year: 2020, date: new Date(2020, 2, 1) },
      ];
      expect(yearsFromData(movements as any)).toEqual([2020, 2024, getCurrentYear()]);
    });

    it('should sort years ascending', () => {
      const movements = [
        { period: 1, year: 2026, date: new Date(2026, 0, 1) },
        { period: 1, year: 2015, date: new Date(2015, 0, 1) },
        { period: 1, year: 2020, date: new Date(2020, 0, 1) },
      ];
      const years = yearsFromData(movements as any, { includeCurrentYear: false });
      expect(years).toEqual([2015, 2020, 2026]);
    });

    it('should not include years outside the data range', () => {
      const movements = [
        { period: 1, year: 2012, date: new Date(2012, 0, 1) },
        { period: 1, year: 2013, date: new Date(2013, 0, 1) },
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
      const movements = [{ period: 1, date: new Date(2016, 0, 1) }];
      expect(yearsFromData(movements as any, { includeCurrentYear: false })).toEqual([2016]);
    });
  });

  describe('monthsFromData', () => {
    it('should derive the months present in the data in canonical order', () => {
      const movements = [
        { period: 5, year: 2026, date: new Date(2026, 4, 1) },
        { period: 1, year: 2026, date: new Date(2026, 0, 1) },
        { period: 3, year: 2026, date: new Date(2026, 2, 1) },
      ];
      const months = monthsFromData(movements as any, { includeCurrentPeriod: false });
      expect(months).toEqual([1, 3, 5]);
    });

    it('should return empty when no period data exists and current period is excluded', () => {
      expect(monthsFromData([] as any, { includeCurrentPeriod: false })).toEqual([]);
    });

    it('should ignore unrecognized period values', () => {
      const movements = [
        { period: 1, year: 2026, date: new Date(2026, 0, 1) },
        { period: 'Enero', year: 2026, date: new Date(2026, 0, 1) },
        { period: 13, year: 2026, date: new Date(2026, 0, 1) },
        { period: 0, year: 2026, date: new Date(2026, 0, 1) },
      ];
      const months = monthsFromData(movements as any, { includeCurrentPeriod: false });
      expect(months).toEqual([1]);
    });

    it('should always return months from the canonical MONTH_NUMBERS list', () => {
      const movements = [
        { period: 1, year: 2026, date: new Date(2026, 0, 1) },
        { period: 12, year: 2026, date: new Date(2026, 11, 1) },
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
});
