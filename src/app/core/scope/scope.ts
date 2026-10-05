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

/* The reporting window of the Stats and Movements screens (see CONTEXT.md):
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

/* A new year keeps the kind of Scope. A month Scope keeps its month within
   the same year and otherwise moves to the current month. */
export function changeYear(scope: MonthScope, year: number): MonthScope;
export function changeYear(scope: PeriodScope, year: number): PeriodScope;
export function changeYear(scope: PeriodScope, year: number): PeriodScope {
  if (scope.kind === 'year') {
    return { kind: 'year', year };
  }
  const period = scope.year === year ? scope.period : getCurrentPeriod();
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

export function yearsFromData(
  movements: ScopeAwareMovement[],
  options: { includeCurrentYear?: boolean } = {},
): number[] {
  const years = new Set<number>();
  for (const m of movements) {
    years.add(getPeriodYear(m));
  }
  if (options.includeCurrentYear !== false) {
    years.add(getCurrentYear());
  }
  return Array.from(years).sort((a, b) => a - b);
}

export function monthsFromData(
  movements: ScopeAwareMovement[],
  options: { includeCurrentPeriod?: boolean } = {},
): MonthNumber[] {
  const present = new Set(movements.map(m => m.period).filter(isMonthNumber));
  if (options.includeCurrentPeriod !== false) {
    present.add(getCurrentPeriod());
  }
  return MONTH_NUMBERS.filter(m => present.has(m));
}

export interface ScopeOptions {
  years: number[];
  months: MonthNumber[];
  /* The latest Period with data in each stored Period year. */
  latestMonthByYear: ReadonlyMap<number, MonthNumber>;
}

/* What the selectors offer before the movements have loaded. */
export const noScopeOptions: ScopeOptions = { years: [], months: [], latestMonthByYear: new Map() };

export function scopeOptions(movements: ScopeAwareMovement[]): ScopeOptions {
  const latestMonthByYear = new Map<number, MonthNumber>();
  for (const movement of movements) {
    if (!isMonthNumber(movement.period)) continue;
    const year = getPeriodYear(movement);
    const known = latestMonthByYear.get(year);
    if (known === undefined || movement.period > known) {
      latestMonthByYear.set(year, movement.period);
    }
  }
  return {
    years: yearsFromData(movements),
    months: monthsFromData(movements),
    latestMonthByYear,
  };
}
