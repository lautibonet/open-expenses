import { Period } from '../types/period.type';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { Account } from '../models/account.model';
import { periodEndBaseAmount } from '../balances/period-end-balances';

export interface AccumulatedInput {
  accounts: Account[];
  transactions: Transaction[];
  transfers: Transfer[];
  isIncome: (transaction: Transaction) => boolean;
  /* The Periods to evaluate, in order. */
  periods: Period[];
  baseCurrency: string;
  /* Initial balance per account id, already in Base Currency. Accounts absent
     from the map are left out — the degraded path when an Exchange Rate
     cannot be resolved. */
  initialInBase: Map<number, number>;
}

/* Accumulated: money held at the end of each given Period — initial balances
   plus every movement whose stored Period is at or before it. The
   total-balance formula evaluated at each Period, so the figure at the
   Scope's To Period equals the Stats total balance. */
export function accumulatedByPeriod(input: AccumulatedInput): number[] {
  return input.periods.map(end => {
    let total = 0;
    for (const account of input.accounts) {
      const initial = input.initialInBase.get(account.id!);
      if (initial == null) continue;
      const balanceInput = {
        account,
        transactions: input.transactions,
        transfers: input.transfers,
        isIncome: input.isIncome,
        baseCurrency: input.baseCurrency,
      };
      total += periodEndBaseAmount(balanceInput, end, initial);
    }
    return Math.round(total * 100) / 100;
  });
}
