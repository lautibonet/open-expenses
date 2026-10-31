import {
  MONTH_NUMBERS,
  MonthNumber,
  ScopeAwareMovement,
  getCurrentPeriod,
  getCurrentYear,
  getPeriodYear,
  isMonthNumber,
  isValidYear,
} from '../types/period.type';

/* The reporting window of the Stats and Movements screens (see GLOSSARY.md):
   a single Period, or — on Movements only — a whole year. */
export interface MonthScope {
  kind: 'month';
  period: MonthNumber;
  year: number;
}

interface YearScope {
  kind: 'year';
  year: number;
}

export type PeriodScope = MonthScope | YearScope;

/* Issue #216: a screen opens on the latest Period with movements — even one
   ahead of the calendar, since a Period is the user's own convention — and
   on the current Period when nothing is recorded. */
export function defaultScope(movements: ScopeAwareMovement[] = []): MonthScope {
  const latestByYear = latestMonthByYear(movements);
  if (latestByYear.size === 0) {
    return { kind: 'month', period: getCurrentPeriod(), year: getCurrentYear() };
  }
  const year = Math.max(...latestByYear.keys());
  return { kind: 'month', period: latestByYear.get(year)!, year };
}

/* The latest Period with data in each stored Period year. */
function latestMonthByYear(movements: ScopeAwareMovement[]): Map<number, MonthNumber> {
  const latest = new Map<number, MonthNumber>();
  for (const movement of movements) {
    if (!isMonthNumber(movement.period)) continue;
    const year = getPeriodYear(movement);
    const known = latest.get(year);
    if (known === undefined || movement.period > known) {
      latest.set(year, movement.period);
    }
  }
  return latest;
}

/* Issue #194: a new year keeps the kind of Scope. Issue #218: a month
   Scope keeps its month, since every month is on offer in every year. */
export function changeYear(scope: MonthScope, year: number): MonthScope;
export function changeYear(scope: PeriodScope, year: number): PeriodScope;
export function changeYear(scope: PeriodScope, year: number): PeriodScope {
  return scope.kind === 'year' ? { kind: 'year', year } : { kind: 'month', period: scope.period, year };
}

/* A picked month narrows to that Period of the Scope year; "all" widens to
   the year Scope. With no month picked, leaving the year Scope lands on the
   latest month with data in that year, otherwise on the current month. */
export function changeMonth(scope: PeriodScope, value: MonthNumber): MonthScope;
export function changeMonth(
  scope: PeriodScope,
  value: MonthNumber | 'all' | null,
  options: Pick<ScopeOptions, 'latestMonthByYear'>,
): PeriodScope;
export function changeMonth(
  scope: PeriodScope,
  value: MonthNumber | 'all' | null,
  options?: Pick<ScopeOptions, 'latestMonthByYear'>,
): PeriodScope {
  const year = scope.year;
  if (value === 'all') {
    return { kind: 'year', year };
  }
  const period = value ?? defaultMonthForYear(year, options?.latestMonthByYear);
  return { kind: 'month', period, year };
}

function defaultMonthForYear(
  year: number,
  latestMonthByYear: ReadonlyMap<number, MonthNumber> | undefined,
): MonthNumber {
  return latestMonthByYear?.get(year) ?? getCurrentPeriod();
}

/* The Movements URL carries the Scope as `?period=<1-12|all>&year=<YYYY>`. */
export function scopeQuery(scope: PeriodScope): string {
  const period = scope.kind === 'year' ? 'all' : scope.period;
  return `period=${period}&year=${scope.year}`;
}

/* The Scope a URL query names, or null when it names none. */
export function scopeFromQuery(params: URLSearchParams): PeriodScope | null {
  const periodParam = params.get('period');
  const year = Number(params.get('year'));
  if (!isValidYear(year)) {
    return null;
  }
  if (periodParam === 'all') {
    return { kind: 'year', year };
  }
  const period = Number(periodParam);
  return isMonthNumber(period) ? { kind: 'month', period, year } : null;
}

export interface ScopeOptions {
  years: number[];
  months: MonthNumber[];
  /* The latest Period with data in each stored Period year. */
  latestMonthByYear: ReadonlyMap<number, MonthNumber>;
}

/* Issue #218: every month is on offer for any year — a Period without
   movements shows as empty, never snaps elsewhere. The years on offer run
   without gaps from the earliest year with data (or the selected year) to
   the latest of the current year, the latest year with data, and the
   selected year, so a deep-linked Scope stays put. */
export function scopeOptions(movements: ScopeAwareMovement[], scope: PeriodScope): ScopeOptions {
  let first = Math.min(getCurrentYear(), scope.year);
  let last = Math.max(getCurrentYear(), scope.year);
  for (const movement of movements) {
    const year = getPeriodYear(movement);
    first = Math.min(first, year);
    last = Math.max(last, year);
  }
  return {
    years: Array.from({ length: last - first + 1 }, (_, i) => first + i),
    months: [...MONTH_NUMBERS],
    latestMonthByYear: latestMonthByYear(movements),
  };
}
