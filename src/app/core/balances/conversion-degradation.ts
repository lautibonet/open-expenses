import { PeriodScope, getPeriodYear, movementIsAtOrBeforePeriod } from '../types/period.type';
import { Account } from '../models/account.model';
import { Transaction } from '../models/transaction.model';

/**
 * The silent paths that degrade Base Currency figures on Stats:
 * - `accountsExcluded`: foreign accounts whose Exchange Rate could not be
 *   resolved are left out of the total balance.
 * - `unconvertedTransactions`: transactions captured without a stored
 *   conversion count at their face amount inside Base Currency sums.
 */
export interface ConversionDegradation {
  accountsExcluded: boolean;
  unconvertedTransactions: boolean;
}

export const noDegradation: ConversionDegradation = {
  accountsExcluded: false,
  unconvertedTransactions: false,
};

/**
 * Transactions on non-base-currency accounts with neither a stored base
 * amount nor a stored exchange rate, that reach at least one figure the
 * conversion-warning strip vouches for: the Period-end balances (anything
 * at or before the Scope's Period) or the yearly totals (anything in the
 * Scope's year).
 */
export function unconvertedTransactionsAffecting(
  transactions: Transaction[],
  accountsById: Map<number, Account>,
  baseCurrency: string,
  scope: PeriodScope,
): Transaction[] {
  return transactions.filter(t => {
    if (t.baseCurrencyAmount != null || t.exchangeRate != null) return false;
    const account = accountsById.get(t.accountId);
    if (!account || account.currency === baseCurrency) return false;
    return (
      movementIsAtOrBeforePeriod(t, scope) || getPeriodYear(t) === scope.year
    );
  });
}
