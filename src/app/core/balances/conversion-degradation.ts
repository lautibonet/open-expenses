import { movementInScope, movementIsAtOrBeforePeriod } from '../types/period.type';
import { PeriodScope } from '../scope/scope';
import { Account, isCreditCard } from '../models/account.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { isUnconvertedTransaction, isUnconvertedTransfer } from '../stats/cash-basis';

/**
 * The silent paths that degrade Base Currency figures on Stats:
 * - `accountsExcluded`: foreign accounts whose Exchange Rate could not be
 *   resolved are left out of the total balance.
 * - `unconvertedMovements`: transactions, and transfers between a Cash
 *   Account and a Credit Card, captured without a stored conversion count at
 *   their face amount inside Base Currency sums.
 */
export interface ConversionDegradation {
  accountsExcluded: boolean;
  unconvertedMovements: boolean;
}

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
    if (!isUnconvertedTransaction(t, accountsById.get(t.accountId), baseCurrency)) return false;
    return (
      movementIsAtOrBeforePeriod(t, scope) ||
      movementInScope(t, { kind: 'year', year: scope.year })
    );
  });
}

/**
 * ADR 0028: Transfers with no stored base amount that reach a figure the
 * conversion-warning strip vouches for. Only a Transfer between a Cash
 * Account and a Credit Card does — a Card Payment in the yearly totals, any
 * of them in the Debt split. Between two accounts of the same kind its two
 * legs cancel out of every figure.
 */
export function unconvertedTransfersAffecting(
  transfers: Transfer[],
  accountsById: Map<number, Account>,
  scope: PeriodScope,
): Transfer[] {
  return transfers.filter(t => {
    if (!isUnconvertedTransfer(t)) return false;
    const source = accountsById.get(t.sourceAccountId);
    const destination = accountsById.get(t.destinationAccountId);
    if (!source || !destination || isCreditCard(source) === isCreditCard(destination)) return false;
    return (
      movementIsAtOrBeforePeriod(t, scope) ||
      movementInScope(t, { kind: 'year', year: scope.year })
    );
  });
}
