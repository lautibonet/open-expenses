import {
  MONTH_NUMBERS,
  MonthNumber,
  movementInScope,
} from '../types/period.type';
import { PeriodScope } from '../scope/scope';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Account } from '../models/account.model';
import {
  periodEndBalance,
  periodEndBaseAmount,
} from '../balances/period-end-balances';

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

/* The latest Period of the year carrying a recorded Movement — Transaction or
   Transfer. 0 when the year carries none. Accumulated Periods after it are
   frozen at the last known balance rather than recorded data. */
export function lastMovementPeriod(
  transactions: Transaction[],
  transfers: Transfer[],
  year: number,
): number {
  let last = 0;
  for (const movement of [...transactions, ...transfers]) {
    if (movementInScope(movement, { kind: 'year', year })) {
      last = Math.max(last, movement.period);
    }
  }
  return last;
}
