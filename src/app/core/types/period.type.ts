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
