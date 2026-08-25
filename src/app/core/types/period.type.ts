export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type MonthName = (typeof MONTHS)[number];

export const DEFAULT_CATEGORIES: { name: string; type: 'Income' | 'Expense' }[] = [
  { name: 'Food', type: 'Expense' },
  { name: 'Transport', type: 'Expense' },
  { name: 'Housing', type: 'Expense' },
  { name: 'Subscriptions', type: 'Expense' },
  { name: 'Leisure', type: 'Expense' },
  { name: 'Misc', type: 'Expense' },
  { name: 'Payroll', type: 'Income' },
  { name: 'Second-hand Sale', type: 'Income' },
  { name: 'Refund', type: 'Income' },
];

export function getCurrentPeriod(): MonthName {
  return MONTHS[new Date().getMonth()];
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}
