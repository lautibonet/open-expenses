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

export function getPeriodYear(movement: { year?: number; date: Date | string }): number {
  if (movement.year != null) {
    return movement.year;
  }
  return new Date(movement.date).getFullYear();
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

export interface MonthScope {
  kind: 'month';
  period: MonthNumber;
  year: number;
}

export type PeriodScope = MonthScope;

export type ScopeAwareMovement = {
  period: number | string;
  year?: number;
  date: Date | string;
};

export function defaultScope(): PeriodScope {
  return { kind: 'month', period: getCurrentPeriod(), year: getCurrentYear() };
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
}

export function scopeOptionsFromMovements(movements: ScopeAwareMovement[]): ScopeOptions {
  return {
    years: yearsFromData(movements),
    months: monthsFromData(movements),
  };
}

export function movementIsAtOrBeforePeriod(
  movement: ScopeAwareMovement,
  scope: PeriodScope,
): boolean {
  if (!isMonthNumber(movement.period)) {
    return false;
  }
  const year = getPeriodYear(movement);
  return year < scope.year || (year === scope.year && movement.period <= scope.period);
}
