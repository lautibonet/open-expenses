import { MONTH_NUMBERS, MonthNumber, getPeriodYear } from '../types/period.type';
import { Transaction } from '../models/transaction.model';
import { storedBaseAmount } from '../balances/period-end-balances';

export interface PeriodNet {
  period: MonthNumber;
  net: number;
}

/* Net (Income minus Expenses) per Period of a year, reported in Base
   Currency. Transfers never count toward Net, so only Transactions come in.
   Months without movements stay at 0; aggregation follows the stored Period
   year, never the movement's date. */
export function netByPeriod(
  transactions: Transaction[],
  isIncome: (transaction: Transaction) => boolean,
  year: number,
): PeriodNet[] {
  const nets = new Map<MonthNumber, number>(MONTH_NUMBERS.map(m => [m, 0]));

  for (const t of transactions) {
    if (getPeriodYear(t) !== year) continue;
    const amount = isIncome(t) ? storedBaseAmount(t) : -storedBaseAmount(t);
    nets.set(t.period, Math.round((nets.get(t.period)! + amount) * 100) / 100);
  }

  return MONTH_NUMBERS.map(period => ({ period, net: nets.get(period)! }));
}
