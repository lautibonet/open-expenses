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
