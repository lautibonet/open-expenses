import type { Scope } from '../scope/scope';

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

/* A Period as a value: a month together with its year (GLOSSARY.md). */
export interface Period {
  year: number;
  month: MonthNumber;
}

/* A Period's position on one continuous count of months, so Periods compare
   and step across year boundaries. */
function periodIndex(period: Period): number {
  return period.year * 12 + (period.month - 1);
}

function periodAtIndex(index: number): Period {
  return { year: Math.floor(index / 12), month: ((index % 12) + 1) as MonthNumber };
}

/* Negative when `a` comes before `b`, zero when they are the same Period. */
export function comparePeriods(a: Period, b: Period): number {
  return periodIndex(a) - periodIndex(b);
}

export function samePeriod(a: Period, b: Period): boolean {
  return comparePeriods(a, b) === 0;
}

/* The Period `months` after (or, negative, before) the given one. */
export function shiftPeriod(period: Period, months: number): Period {
  return periodAtIndex(periodIndex(period) + months);
}

/* The stored Period of a movement, or null when its period is not a month
   number (ADR 0009). Reporting always uses the stored Period year. */
export function movementPeriod(movement: ScopeAwareMovement): Period | null {
  return isMonthNumber(movement.period)
    ? { year: getPeriodYear(movement), month: movement.period }
    : null;
}

/* Every Period of a Scope, From through To. */
export function scopePeriods(scope: Scope): Period[] {
  const first = periodIndex(scope.from);
  const last = periodIndex(scope.to);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => periodAtIndex(first + i));
}

/* Whether a (year, Period) bucket falls inside the Scope's run of Periods. */
function periodInScope(year: number, period: number | string, scope: Scope): boolean {
  if (!isMonthNumber(period)) {
    return false;
  }
  const bucket = { year, month: period };
  return comparePeriods(bucket, scope.from) >= 0 && comparePeriods(bucket, scope.to) <= 0;
}

/* Filtering by Scope always uses the stored Period year. A movement whose
   period is not a month number is in no Scope (ADR 0009). */
export function movementInScope(movement: ScopeAwareMovement, scope: Scope): boolean {
  return periodInScope(getPeriodYear(movement), movement.period, scope);
}

/* Whether a movement's stored Period is at or before the given Period — the
   movements a balance as of the end of that Period accumulates (ADR 0013). */
export function movementIsAtOrBeforePeriod(movement: ScopeAwareMovement, end: Period): boolean {
  const period = movementPeriod(movement);
  return period !== null && comparePeriods(period, end) <= 0;
}
