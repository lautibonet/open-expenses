import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentPeriod, getCurrentYear } from '../types/period.type';
import {
  MonthScope,
  changeMonth,
  changeYear,
  defaultScope,
  scopeFromQuery,
  scopeOptions,
  scopeQuery,
} from './scope';

describe('scope', () => {
  describe('changeYear', () => {
    it('should keep the month of a month Scope', () => {
      const next: MonthScope = changeYear({ kind: 'month', period: 3, year: 2026 }, 2025);
      expect(next).toEqual({ kind: 'month', period: 3, year: 2025 });
    });

    it('should keep the month even on a year without movements', () => {
      const next: MonthScope = changeYear({ kind: 'month', period: 11, year: 2024 }, 2020);
      expect(next).toEqual({ kind: 'month', period: 11, year: 2020 });
    });

    it('should keep the year Scope a whole year', () => {
      expect(changeYear({ kind: 'year', year: 2026 }, 2024)).toEqual({
        kind: 'year',
        year: 2024,
      });
    });
  });

  describe('changeMonth', () => {
    const options = scopeOptions(
      [
        { period: 2, year: 2024, date: new Date(2024, 1, 1) },
        { period: 6, year: 2024, date: new Date(2024, 5, 1) },
      ],
      { kind: 'year', year: 2024 },
    );

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

    it('should default to the current month on the current year when it has no data', () => {
      expect(changeMonth({ kind: 'year', year: 2026 }, null, options)).toEqual({
        kind: 'month',
        period: 10,
        year: 2026,
      });
    });

    it('should default to the latest month with data when leaving the year Scope of the current year', () => {
      const withCurrentYear = scopeOptions(
        [
          { period: 8, year: 2026, date: new Date(2026, 7, 1) },
          { period: 9, year: 2026, date: new Date(2026, 8, 1) },
        ],
        { kind: 'year', year: 2026 },
      );
      expect(changeMonth({ kind: 'year', year: 2026 }, null, withCurrentYear)).toEqual({
        kind: 'month',
        period: 9,
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
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 31));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should default to the current month and year when nothing is recorded', () => {
      expect(defaultScope([])).toEqual({ kind: 'month', period: 10, year: 2026 });
    });

    it('should open on the latest Period with movements when it is behind the calendar', () => {
      const movements = [
        { period: 9, year: 2026, date: new Date(2026, 8, 3) },
        { period: 7, year: 2026, date: new Date(2026, 6, 3) },
      ];
      expect(defaultScope(movements)).toEqual({ kind: 'month', period: 9, year: 2026 });
    });

    it('should open on a Period ahead of the calendar', () => {
      const movements = [
        { period: 10, year: 2026, date: new Date(2026, 9, 2) },
        { period: 12, year: 2026, date: new Date(2026, 9, 27) },
      ];
      expect(defaultScope(movements)).toEqual({ kind: 'month', period: 12, year: 2026 });
    });

    it('should open on the latest Period of an earlier year when the current year has none', () => {
      const movements = [
        { period: 11, year: 2024, date: new Date(2024, 10, 1) },
        { period: 3, year: 2025, date: new Date(2025, 2, 1) },
      ];
      expect(defaultScope(movements)).toEqual({ kind: 'month', period: 3, year: 2025 });
    });

    it('should order Periods by their stored year before their month', () => {
      const movements = [
        { period: 12, year: 2025, date: new Date(2025, 11, 1) },
        { period: 1, year: 2027, date: new Date(2026, 11, 28) },
      ];
      expect(defaultScope(movements)).toEqual({ kind: 'month', period: 1, year: 2027 });
    });

    it('should place a movement without a stored year in its date year', () => {
      const movements = [{ period: 5, date: new Date(2023, 4, 1) }];
      expect(defaultScope(movements)).toEqual({ kind: 'month', period: 5, year: 2023 });
    });

    it('should ignore an unrecognizable period', () => {
      const movements = [
        { period: 4, year: 2026, date: new Date(2026, 3, 1) },
        { period: 'Smarch', year: 2026, date: new Date(2026, 11, 1) },
      ];
      expect(defaultScope(movements)).toEqual({ kind: 'month', period: 4, year: 2026 });
    });
  });

  describe('scopeOptions', () => {
    const movements = [
      { period: 3, year: 2024, date: new Date(2024, 2, 1) },
      { period: 11, year: 2025, date: new Date(2025, 10, 1) },
      { period: 12, year: 2026, date: new Date(2026, 11, 1) },
    ];

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 15));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should offer all twelve months of a year with data', () => {
      const options = scopeOptions(movements, { kind: 'month', period: 3, year: 2024 });
      expect(options.months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('should offer all twelve months of a year without data', () => {
      const options = scopeOptions(movements, { kind: 'year', year: 2019 });
      expect(options.months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('should offer every year from the earliest with data to the current year, with no gaps', () => {
      const options = scopeOptions(
        [
          { period: 1, year: 2023, date: new Date(2023, 0, 1) },
          { period: 3, year: 2025, date: new Date(2025, 2, 1) },
        ],
        { kind: 'month', period: 10, year: 2026 },
      );
      expect(options.years).toEqual([2023, 2024, 2025, 2026]);
    });

    it('should offer years up to the latest year with data when it is ahead of the calendar', () => {
      const options = scopeOptions(
        [
          { period: 5, year: 2025, date: new Date(2025, 4, 1) },
          { period: 1, year: 2028, date: new Date(2026, 11, 28) },
        ],
        { kind: 'month', period: 10, year: 2026 },
      );
      expect(options.years).toEqual([2025, 2026, 2027, 2028]);
    });

    it('should keep offering a selected year outside the years with data', () => {
      expect(scopeOptions(movements, { kind: 'year', year: 2021 }).years).toEqual([
        2021, 2022, 2023, 2024, 2025, 2026,
      ]);
      expect(scopeOptions(movements, { kind: 'month', period: 3, year: 2030 }).years).toEqual([
        2024, 2025, 2026, 2027, 2028, 2029, 2030,
      ]);
    });

    it('should offer only the current year when there is no data', () => {
      const options = scopeOptions([], { kind: 'month', period: 10, year: 2026 });
      expect(options.years).toEqual([2026]);
    });

    it('should record the latest month with data in each stored Period year', () => {
      const options = scopeOptions(
        [
          { period: 2, year: 2024, date: new Date(2024, 1, 1) },
          { period: 6, year: 2024, date: new Date(2024, 5, 1) },
          { period: 4, year: 2024, date: new Date(2024, 3, 1) },
          { period: 1, year: 2025, date: new Date(2024, 11, 30) },
          { period: 9, date: new Date(2023, 8, 15) },
        ],
        { kind: 'month', period: 10, year: 2026 },
      );
      expect(options.latestMonthByYear.get(2024)).toBe(6);
      expect(options.latestMonthByYear.get(2025)).toBe(1);
      expect(options.latestMonthByYear.get(2023)).toBe(9);
    });

    it('should place a movement without a stored year in its date year', () => {
      const options = scopeOptions([{ period: 9, date: new Date(2023, 8, 15) }], {
        kind: 'year',
        year: 2023,
      });
      expect(options.years).toEqual([2023, 2024, 2025, 2026]);
    });

    it('should ignore an unrecognizable period for the latest month', () => {
      const options = scopeOptions(
        [
          { period: 3, year: 2024, date: new Date(2024, 2, 1) },
          { period: 'Diciembre', year: 2024, date: new Date(2024, 11, 1) },
        ],
        { kind: 'month', period: 10, year: 2026 },
      );
      expect(options.latestMonthByYear.get(2024)).toBe(3);
    });
  });
});
