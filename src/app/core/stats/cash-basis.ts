import { Account, isCashAccount, isCreditCard } from '../models/account.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';

/* ADR 0022: whether a Transaction's spending was paid with credit — it sits on
   a Credit Card. A missing account is treated as cash, the orphan rule the
   cash-basis seam and the spending split share. */
export function isCreditCardTransaction(
  transaction: Transaction,
  accountsById: Map<number, Account>,
): boolean {
  const account = accountsById.get(transaction.accountId);
  return account ? isCreditCard(account) : false;
}

/* ADR 0022: the Income, Expenses, and Net figures are cash-basis. A Transaction
   on a Credit Card (a Card Purchase or a card refund) never counts in them —
   card spending reaches Expenses only through a Card Payment. A missing account
   is treated as cash so an orphaned reference is never silently dropped. */
export function countsTowardCashBasis(
  transaction: Transaction,
  accountsById: Map<number, Account>,
): boolean {
  return !isCreditCardTransaction(transaction, accountsById);
}

/* The Transactions that count in the cash-basis KPIs: every one on a Cash
   Account, none on a Credit Card. */
export function cashBasisTransactions(
  transactions: Transaction[],
  accountsById: Map<number, Account>,
): Transaction[] {
  return transactions.filter(transaction => countsTowardCashBasis(transaction, accountsById));
}

/* ADR 0022: the one Transfer kind that reaches the cash-basis KPIs is the Card
   Payment — money leaving a Cash Account to settle a Credit Card. Every other
   kind (Cash to Cash, Card to Cash, Card to Card) never counts. A Transfer
   whose accounts cannot both be resolved is not a Card Payment. */
export function isCardPayment(
  transfer: Transfer,
  accountsById: Map<number, Account>,
): boolean {
  const source = accountsById.get(transfer.sourceAccountId);
  const destination = accountsById.get(transfer.destinationAccountId);
  return !!source && !!destination && isCashAccount(source) && isCreditCard(destination);
}

/* The Transfers that count in the cash-basis KPIs: the Card Payments. */
export function cardPaymentTransfers(
  transfers: Transfer[],
  accountsById: Map<number, Account>,
): Transfer[] {
  return transfers.filter(transfer => isCardPayment(transfer, accountsById));
}
