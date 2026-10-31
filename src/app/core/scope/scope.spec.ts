import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthNumber } from '../types/period.type';
import {
  Scope,
  changeFrom,
  changeTo,
  defaultScope,
  defaultStatsScope,
  latestPeriodWithMovements,
  matchingPreset,
  presetScope,
  scopeFromQuery,
  scopeOptions,
  scopeQuery,
} from './scope';

const at = (year: number, month: MonthNumber) => ({ year, month });
const scope = (from: [number, MonthNumber], to: [number, MonthNumber]): Scope => ({
  from: at(...from),
  to: at(...to),
});
const movement = (year: number, period: number | string) => ({
  period,
  year,
  date: new Date(year, typeof period === 'number' ? period - 1 : 0, 1),
});

describe('scope', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 20));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('latestPeriodWithMovements', () => {
    const movements = [movement(2025, 12), movement(2026, 4), movement(2025, 8), movement(2026, 'Smarch')];

    it('should find the latest Period with movements, or null when none is recorded', () => {
      expect(latestPeriodWithMovements(movements)).toEqual(at(2026, 4));
      expect(latestPeriodWithMovements([])).toBeNull();
    });

    it('should look only within a Scope when given one, across a year boundary', () => {
      expect(latestPeriodWithMovements(movements, scope([2025, 11], [2026, 1]))).toEqual(at(2025, 12));
      expect(latestPeriodWithMovements(movements, scope([2026, 5], [2026, 12]))).toBeNull();
    });
  });

  describe('presetScope', () => {
    const movements = [movement(2025, 6), movement(2025, 11), movement(2026, 1)];
    const current = scope([2026, 1], [2026, 1]);

    it('should cover the latest Period with movements for "This Period"', () => {
      expect(presetScope('thisPeriod', current, movements)).toEqual(scope([2026, 1], [2026, 1]));
    });

    it('should count "Last 3" back across a year boundary', () => {
      expect(presetScope('last3', current, movements)).toEqual(scope([2025, 11], [2026, 1]));
    });

    it('should count "Last 6" and "Last 12" back from the latest Period with movements', () => {
      expect(presetScope('last6', current, movements)).toEqual(scope([2025, 8], [2026, 1]));
      expect(presetScope('last12', current, movements)).toEqual(scope([2025, 2], [2026, 1]));
    });

    it('should count back from a latest Period ahead of the calendar', () => {
      const ahead = [...movements, movement(2026, 4)];
      expect(presetScope('last3', current, ahead)).toEqual(scope([2026, 2], [2026, 4]));
    });

    it('should count back from the current Period when nothing is recorded', () => {
      expect(presetScope('thisPeriod', current, [])).toEqual(scope([2026, 1], [2026, 1]));
      expect(presetScope('last6', current, [])).toEqual(scope([2025, 8], [2026, 1]));
    });

    it('should cover January through December of the To Period year for "Whole year"', () => {
      expect(presetScope('wholeYear', scope([2024, 11], [2025, 3]), movements)).toEqual(
        scope([2025, 1], [2025, 12]),
      );
    });

    it('should run "Year to date" to the latest Period with movements in that year', () => {
      expect(presetScope('yearToDate', scope([2025, 11], [2026, 1]), movements)).toEqual(
        scope([2026, 1], [2026, 1]),
      );
    });

    it('should run "Year to date" of a past year to December', () => {
      expect(presetScope('yearToDate', scope([2025, 3], [2025, 4]), movements)).toEqual(
        scope([2025, 1], [2025, 12]),
      );
    });

    it('should run "Year to date" to the current Period when nothing is recorded', () => {
      vi.setSystemTime(new Date(2026, 4, 20));
      expect(presetScope('yearToDate', scope([2026, 1], [2026, 1]), [])).toEqual(
        scope([2026, 1], [2026, 5]),
      );
    });

    it('should ignore an unrecognizable period when finding the latest Period', () => {
      const withUnknown = [...movements, movement(2026, 'Smarch')];
      expect(presetScope('thisPeriod', current, withUnknown)).toEqual(scope([2026, 1], [2026, 1]));
    });
  });

  describe('matchingPreset', () => {
    const movements = [movement(2025, 6), movement(2026, 3)];

    it('should name the preset an edited From and To matches', () => {
      expect(matchingPreset(scope([2026, 2], [2026, 3]), movements)).toBe('custom');
      expect(matchingPreset(scope([2025, 10], [2026, 3]), movements)).toBe('last6');
      expect(matchingPreset(scope([2025, 4], [2026, 3]), movements)).toBe('last12');
      expect(matchingPreset(scope([2025, 1], [2025, 12]), movements)).toBe('wholeYear');
      expect(matchingPreset(scope([2026, 3], [2026, 3]), movements)).toBe('thisPeriod');
    });

    it('should name Year to date over a rolling preset producing the same Scope', () => {
      // Year to date of 2026 runs January to March, as does "Last 3".
      expect(matchingPreset(scope([2026, 1], [2026, 3]), movements)).toBe('yearToDate');
    });

    it('should name Whole year over Year to date and Last 12 producing the same Scope', () => {
      const december = [movement(2025, 12)];
      expect(matchingPreset(scope([2025, 1], [2025, 12]), december)).toBe('wholeYear');
    });

    it('should name Custom when no preset produces the Scope', () => {
      expect(matchingPreset(scope([2025, 11], [2026, 2]), movements)).toBe('custom');
      expect(matchingPreset(scope([2025, 5], [2025, 5]), movements)).toBe('custom');
    });

    it('should keep the preferred preset when several produce the same Scope', () => {
      // Year to date of 2026 runs January to March, as does "Last 3".
      expect(matchingPreset(scope([2026, 1], [2026, 3]), movements, 'yearToDate')).toBe('yearToDate');
      expect(matchingPreset(scope([2026, 1], [2026, 3]), movements, 'last3')).toBe('last3');
    });

    it('should not keep a preferred preset that no longer produces the Scope', () => {
      expect(matchingPreset(scope([2025, 11], [2026, 2]), movements, 'last3')).toBe('custom');
    });
  });

  describe('changeFrom / changeTo', () => {
    const current = scope([2025, 11], [2026, 1]);

    it('should move only the edited end while the ends stay in order', () => {
      expect(changeFrom(current, at(2025, 12))).toEqual(scope([2025, 12], [2026, 1]));
      expect(changeTo(current, at(2026, 4))).toEqual(scope([2025, 11], [2026, 4]));
    });

    it('should move the To Period to match a From picked after it', () => {
      expect(changeFrom(current, at(2026, 3))).toEqual(scope([2026, 3], [2026, 3]));
    });

    it('should move the From Period to match a To picked before it', () => {
      expect(changeTo(current, at(2025, 2))).toEqual(scope([2025, 2], [2025, 2]));
    });

    it('should allow a Scope of any length', () => {
      expect(changeFrom(current, at(2019, 1))).toEqual(scope([2019, 1], [2026, 1]));
    });
  });

  describe('scopeQuery / scopeFromQuery', () => {
    it('should write a Scope as its From and To Periods', () => {
      expect(scopeQuery(scope([2025, 11], [2026, 1]))).toBe('from=2025-11&to=2026-01');
    });

    it('should read back what it writes', () => {
      const written = scope([2025, 11], [2026, 1]);
      expect(scopeFromQuery(new URLSearchParams(scopeQuery(written)))).toEqual(written);
      const single = scope([2026, 3], [2026, 3]);
      expect(scopeFromQuery(new URLSearchParams(scopeQuery(single)))).toEqual(single);
    });

    it('should order From and To when a link names them inverted', () => {
      expect(scopeFromQuery(new URLSearchParams('from=2026-02&to=2025-12'))).toEqual(
        scope([2025, 12], [2026, 2]),
      );
    });

    it('should read nothing from a missing or invalid From or To', () => {
      expect(scopeFromQuery(new URLSearchParams(''))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('from=2026-01'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('from=2026-13&to=2026-12'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('from=26-01&to=2026-02'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('from=March&to=2026-02'))).toBeNull();
    });

    it('should open an old one-Period link on that Period', () => {
      expect(scopeFromQuery(new URLSearchParams('period=3&year=2026'))).toEqual(
        scope([2026, 3], [2026, 3]),
      );
    });

    it('should open an old "all" link on January through December of its year', () => {
      expect(scopeFromQuery(new URLSearchParams('period=all&year=2025'))).toEqual(
        scope([2025, 1], [2025, 12]),
      );
    });

    it('should read nothing from an old link with a missing or invalid year or period', () => {
      expect(scopeFromQuery(new URLSearchParams('period=3'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=3&year=99'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=all&year=abc'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('year=2026'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=13&year=2026'))).toBeNull();
      expect(scopeFromQuery(new URLSearchParams('period=March&year=2026'))).toBeNull();
    });
  });

  describe('defaultScope', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date(2026, 9, 31));
    });

    it('should default to the current Period when nothing is recorded', () => {
      expect(defaultScope([])).toEqual(scope([2026, 10], [2026, 10]));
    });

    it('should open on the latest Period with movements when it is behind the calendar', () => {
      expect(defaultScope([movement(2026, 9), movement(2026, 7)])).toEqual(scope([2026, 9], [2026, 9]));
    });

    it('should open on a Period ahead of the calendar', () => {
      expect(defaultScope([movement(2026, 10), movement(2026, 12)])).toEqual(
        scope([2026, 12], [2026, 12]),
      );
    });

    it('should order Periods by their stored year before their month', () => {
      const movements = [
        { period: 12, year: 2025, date: new Date(2025, 11, 1) },
        { period: 1, year: 2027, date: new Date(2026, 11, 28) },
      ];
      expect(defaultScope(movements)).toEqual(scope([2027, 1], [2027, 1]));
    });

    it('should place a movement without a stored year in its date year', () => {
      expect(defaultScope([{ period: 5, date: new Date(2023, 4, 1) }])).toEqual(
        scope([2023, 5], [2023, 5]),
      );
    });

    it('should ignore an unrecognizable period', () => {
      expect(defaultScope([movement(2026, 4), movement(2026, 'Smarch')])).toEqual(
        scope([2026, 4], [2026, 4]),
      );
    });
  });

  describe('defaultStatsScope', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date(2026, 9, 31));
    });

    it('should open on Year to date ending at the latest Period with movements', () => {
      expect(defaultStatsScope([movement(2025, 4), movement(2026, 9)])).toEqual(
        scope([2026, 1], [2026, 9]),
      );
    });

    it('should open on Year to date ending at the current Period when nothing is recorded', () => {
      expect(defaultStatsScope([])).toEqual(scope([2026, 1], [2026, 10]));
    });

    it('should open on Year to date of an earlier year when the latest movement is there', () => {
      expect(defaultStatsScope([movement(2024, 11)])).toEqual(scope([2024, 1], [2024, 11]));
    });
  });

  describe('scopeOptions', () => {
    const movements = [movement(2024, 3), movement(2025, 11), movement(2026, 12)];

    beforeEach(() => {
      vi.setSystemTime(new Date(2026, 9, 15));
    });

    it('should offer all twelve months', () => {
      expect(scopeOptions(movements, scope([2019, 3], [2019, 3])).months).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);
    });

    it('should offer every year from the earliest with data to the current year, with no gaps', () => {
      const options = scopeOptions(
        [movement(2023, 1), movement(2025, 3)],
        scope([2026, 10], [2026, 10]),
      );
      expect(options.years).toEqual([2023, 2024, 2025, 2026]);
    });

    it('should offer years up to the latest year with data when it is ahead of the calendar', () => {
      const options = scopeOptions(
        [movement(2025, 5), movement(2028, 1)],
        scope([2026, 10], [2026, 10]),
      );
      expect(options.years).toEqual([2025, 2026, 2027, 2028]);
    });

    it('should keep offering both ends of a Scope outside the years with data', () => {
      expect(scopeOptions(movements, scope([2021, 1], [2030, 3])).years).toEqual([
        2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
      ]);
    });

    it('should offer only the current year when there is no data', () => {
      expect(scopeOptions([], scope([2026, 10], [2026, 10])).years).toEqual([2026]);
    });

    it('should place a movement without a stored year in its date year', () => {
      const options = scopeOptions([{ period: 9, date: new Date(2023, 8, 15) }], scope([2023, 1], [2023, 12]));
      expect(options.years).toEqual([2023, 2024, 2025, 2026]);
    });
  });
});
