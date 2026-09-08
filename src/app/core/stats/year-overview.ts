import { MONTH_NUMBERS, MonthNumber, PeriodScope, getPeriodYear } from '../types/period.type';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Account } from '../models/account.model';
import {
  periodEndBalance,
  periodEndBaseAmount,
  storedBaseAmount,
} from '../balances/period-end-balances';

export interface PeriodOverview {
  period: MonthNumber;
  income: number;
  expenses: number;
  net: number;
}

/* Income, Expenses, and Net (Income minus Expenses) per Period of a year,
   reported in Base Currency. Transfers never count toward Net, so only
   Transactions come in. Months without movements stay at 0; aggregation
   follows the stored Period year, never the movement's date. */
export function yearOverview(
  transactions: Transaction[],
  isIncome: (transaction: Transaction) => boolean,
  year: number,
): PeriodOverview[] {
  const incomes = new Map<MonthNumber, number>(MONTH_NUMBERS.map(m => [m, 0]));
  const expenses = new Map<MonthNumber, number>(MONTH_NUMBERS.map(m => [m, 0]));

  for (const t of transactions) {
    if (getPeriodYear(t) !== year) continue;
    const amount = storedBaseAmount(t);
    const bucket = isIncome(t) ? incomes : expenses;
    bucket.set(t.period, Math.round((bucket.get(t.period)! + amount) * 100) / 100);
  }

  return MONTH_NUMBERS.map(period => {
    const income = incomes.get(period)!;
    const monthExpenses = expenses.get(period)!;
    return {
      period,
      income,
      expenses: monthExpenses,
      net: Math.round((income - monthExpenses) * 100) / 100,
    };
  });
}

export interface AccumulatedInput {
  accounts: Account[];
  transactions: Transaction[];
  transfers: Transfer[];
  isIncome: (transaction: Transaction) => boolean;
  year: number;
  /* Initial balance per account id, already in Base Currency. Accounts absent
     from the map are left out — the degraded path when an Exchange Rate
     cannot be resolved. */
  initialInBase: Map<number, number>;
  /* Degraded mode: accounts are all Base Currency, so movements count at
     their face amounts instead of their stored conversions. */
  nativeAmounts?: boolean;
}

/* Accumulated: money held at the end of each Period of the year — initial
   balances plus every movement whose stored Period is at or before it. The
   total-balance formula evaluated at all twelve Periods, so the figure at
   the Scope's Period equals the Stats total balance. */
export function accumulatedByPeriod(input: AccumulatedInput): number[] {
  return MONTH_NUMBERS.map(period => {
    const scope: PeriodScope = { kind: 'month', period, year: input.year };
    let total = 0;
    for (const account of input.accounts) {
      const initial = input.initialInBase.get(account.id!);
      if (initial == null) continue;
      const balanceInput = {
        account,
        transactions: input.transactions,
        transfers: input.transfers,
        isIncome: input.isIncome,
      };
      total += input.nativeAmounts
        ? periodEndBalance(balanceInput, scope)
        : periodEndBaseAmount(balanceInput, scope, initial);
    }
    return Math.round(total * 100) / 100;
  });
}
