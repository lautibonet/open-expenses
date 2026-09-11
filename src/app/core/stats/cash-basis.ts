import { Account, isCashAccount } from '../models/account.model';
import { Transaction } from '../models/transaction.model';

/* ADR 0022: the Income, Expenses, and Net figures are cash-basis. A Transaction
   on a Credit Card (a Card Purchase or a card refund) never counts in them —
   card spending reaches Expenses only through a Card Payment. A missing account
   is treated as cash so an orphaned reference is never silently dropped. */
export function countsTowardCashBasis(
  transaction: Transaction,
  accountsById: Map<number, Account>,
): boolean {
  const account = accountsById.get(transaction.accountId);
  return account ? isCashAccount(account) : true;
}

/* The Transactions that count in the cash-basis KPIs: every one on a Cash
   Account, none on a Credit Card. */
export function cashBasisTransactions(
  transactions: Transaction[],
  accountsById: Map<number, Account>,
): Transaction[] {
  return transactions.filter(transaction => countsTowardCashBasis(transaction, accountsById));
}
