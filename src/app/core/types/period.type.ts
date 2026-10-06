import type { MonthScope, PeriodScope } from '../scope/scope';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const MONTH_NUMBERS: MonthNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function isMonthNumber(value: unknown): value is MonthNumber {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12;
}

export const isValidPeriod = isMonthNumber;

export function monthNumberFromName(name: string): MonthNumber | null {
  const index = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === name.trim().toLowerCase(),
  );
  return index === -1 ? null : (index + 1 as MonthNumber);
}

export function getCurrentPeriod(): MonthNumber {
  return (new Date().getMonth() + 1) as MonthNumber;
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

export function getPeriodYear(movement: { year?: number; date: Date }): number {
  if (movement.year != null) {
    return movement.year;
  }
  return movement.date.getFullYear();
}

export function periodYearFromDate(date: Date | string): {
  period: MonthNumber;
  year: number;
} {
  if (typeof date === 'string') {
    const [yearText, monthText] = date.split('-');
    const month = Number(monthText);
    if (yearText && month >= 1 && month <= 12) {
      return { period: month as MonthNumber, year: Number(yearText) };
    }
  }
  const parsed = new Date(date);
  return { period: (parsed.getMonth() + 1) as MonthNumber, year: parsed.getFullYear() };
}

export type ScopeAwareMovement = {
  period: number | string;
  year?: number;
  date: Date;
};

/* Whether a (year, Period) bucket falls inside the Scope: its Period on a
   month Scope, any Period of the year on a year Scope. */
export function periodInScope(year: number, period: number | string, scope: PeriodScope): boolean {
  if (!isMonthNumber(period) || year !== scope.year) {
    return false;
  }
  return scope.kind === 'year' || period === scope.period;
}

/* Filtering by Scope always uses the stored Period year. A movement whose
   period is not a month number is in no Scope (ADR 0009). */
export function movementInScope(movement: ScopeAwareMovement, scope: PeriodScope): boolean {
  return periodInScope(getPeriodYear(movement), movement.period, scope);
}

/* Whether a (year, Period) bucket is year-to-period: January through the
   Scope's Period of the Scope's year. */
export function periodIsYearToPeriod(
  year: number,
  period: number | string,
  scope: MonthScope,
): boolean {
  return isMonthNumber(period) && year === scope.year && period <= scope.period;
}

export function movementIsYearToPeriod(movement: ScopeAwareMovement, scope: MonthScope): boolean {
  return periodIsYearToPeriod(getPeriodYear(movement), movement.period, scope);
}

export function movementIsAtOrBeforePeriod(
  movement: ScopeAwareMovement,
  scope: PeriodScope,
): boolean {
  if (!isMonthNumber(movement.period)) {
    return false;
  }
  const year = getPeriodYear(movement);
  if (scope.kind === 'year') {
    return year <= scope.year;
  }
  return year < scope.year || (year === scope.year && movement.period <= scope.period);
}
