import { Period, movementIsAtOrBeforePeriod } from '../types/period.type';
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
 * conversion-warning strip vouches for. Every Stats figure — the Scope's
 * totals, the balances as of the end of its To Period, and the charts of the
 * twelve Periods ending there — counts only movements at or before the end
 * of the To Period (ADR 0029).
 */
export function unconvertedTransactionsAffecting(
  transactions: Transaction[],
  accountsById: Map<number, Account>,
  baseCurrency: string,
  end: Period,
): Transaction[] {
  return transactions.filter(t => {
    if (!isUnconvertedTransaction(t, accountsById.get(t.accountId), baseCurrency)) return false;
    return movementIsAtOrBeforePeriod(t, end);
  });
}

/**
 * ADR 0028: Transfers with no stored base amount that reach a figure the
 * conversion-warning strip vouches for. Only a Transfer between a Cash
 * Account and a Credit Card does — a Card Payment in the totals or charts, any
 * of them in the Debt split. Between two accounts of the same kind its two
 * legs cancel out of every figure.
 */
export function unconvertedTransfersAffecting(
  transfers: Transfer[],
  accountsById: Map<number, Account>,
  end: Period,
): Transfer[] {
  return transfers.filter(t => {
    if (!isUnconvertedTransfer(t)) return false;
    const source = accountsById.get(t.sourceAccountId);
    const destination = accountsById.get(t.destinationAccountId);
    if (!source || !destination || isCreditCard(source) === isCreditCard(destination)) return false;
    return movementIsAtOrBeforePeriod(t, end);
  });
}
