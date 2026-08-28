export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type MonthName = (typeof MONTHS)[number];

export function getCurrentPeriod(): MonthName {
  return MONTHS[new Date().getMonth()];
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

export function getPeriodYear(movement: { year?: number; date: Date | string }): number {
  if (movement.year != null) {
    return movement.year;
  }
  return new Date(movement.date).getFullYear();
}

export interface MonthScope {
  kind: 'month';
  period: MonthName;
  year: number;
}

export interface AllTimeScope {
  kind: 'all-time';
}

export type PeriodScope = MonthScope | AllTimeScope;

export type ScopeAwareMovement = {
  period: string;
  year?: number;
  date: Date | string;
};

export function defaultScope(): PeriodScope {
  return { kind: 'month', period: getCurrentPeriod(), year: getCurrentYear() };
}

export function isAllTime(scope: PeriodScope): scope is AllTimeScope {
  return scope.kind === 'all-time';
}

export function scopeLabel(scope: PeriodScope): string {
  if (scope.kind === 'all-time') {
    return 'All time';
  }
  return `${scope.period} ${scope.year}`;
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
): MonthName[] {
  const present = new Set(movements.map(m => m.period));
  if (options.includeCurrentPeriod !== false) {
    present.add(getCurrentPeriod());
  }
  return MONTHS.filter(m => present.has(m));
}

export interface ScopeOptions {
  years: number[];
  months: MonthName[];
}

export function scopeOptionsFromMovements(movements: ScopeAwareMovement[]): ScopeOptions {
  return {
    years: yearsFromData(movements),
    months: monthsFromData(movements),
  };
}
