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

export function defaultScope(): MonthScope {
  return { kind: 'month', period: getCurrentPeriod(), year: getCurrentYear() };
}

/* Issue #194: a new year keeps the kind of Scope. A month Scope keeps its
   month within the same year and otherwise lands on the current month on
   the current year, else on the latest month with data in that year. */
export function changeYear(
  scope: MonthScope,
  year: number,
  options: Pick<ScopeOptions, 'latestMonthByYear'>,
): MonthScope;
export function changeYear(
  scope: PeriodScope,
  year: number,
  options: Pick<ScopeOptions, 'latestMonthByYear'>,
): PeriodScope;
export function changeYear(
  scope: PeriodScope,
  year: number,
  options: Pick<ScopeOptions, 'latestMonthByYear'>,
): PeriodScope {
  if (scope.kind === 'year') {
    return { kind: 'year', year };
  }
  const period =
    scope.year === year ? scope.period : defaultMonthForYear(year, options.latestMonthByYear);
  return { kind: 'month', period, year };
}

/* A picked month narrows to that Period of the Scope year; "all" widens to
   the year Scope. With no month picked, leaving the year Scope lands on the
   current month on the current year, otherwise on the latest month with
   data in that year. */
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
  if (year === getCurrentYear()) {
    return getCurrentPeriod();
  }
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

/* Issue #194: the months on offer follow the Scope's year: its months with
   data, plus the current month on the current year. The selected month and
   year are always on offer, so a Scope with no data behind it — a deep
   link, or a Period whose last movement was deleted — stays put. */
export function scopeOptions(movements: ScopeAwareMovement[], scope: PeriodScope): ScopeOptions {
  const currentYear = getCurrentYear();
  const years = new Set([currentYear, scope.year]);
  const months = new Set<MonthNumber>();
  if (scope.year === currentYear) {
    months.add(getCurrentPeriod());
  }
  if (scope.kind === 'month') {
    months.add(scope.period);
  }
  const latestMonthByYear = new Map<number, MonthNumber>();
  for (const movement of movements) {
    const year = getPeriodYear(movement);
    years.add(year);
    if (!isMonthNumber(movement.period)) continue;
    if (year === scope.year) {
      months.add(movement.period);
    }
    const known = latestMonthByYear.get(year);
    if (known === undefined || movement.period > known) {
      latestMonthByYear.set(year, movement.period);
    }
  }
  return {
    years: Array.from(years).sort((a, b) => a - b),
    months: MONTH_NUMBERS.filter(m => months.has(m)),
    latestMonthByYear,
  };
}
