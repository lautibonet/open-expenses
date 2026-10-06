import { movementIsAtOrBeforePeriod } from '../types/period.type';
import { PeriodScope } from '../scope/scope';
import { Account, isBaseCurrencyAccount } from '../models/account.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';

export interface PeriodEndBalanceInput {
  account: Account;
  transactions: Transaction[];
  transfers: Transfer[];
  isIncome: (transaction: Transaction) => boolean;
}

export interface PeriodEndBaseInput extends PeriodEndBalanceInput {
  baseCurrency: string;
}

function periodEndAmount(
  input: PeriodEndBalanceInput,
  scope: PeriodScope,
  initial: number,
  transactionAmount: (transaction: Transaction) => number,
  transferSourceAmount: (transfer: Transfer) => number,
  transferDestinationAmount: (transfer: Transfer) => number,
): number {
  let amount = initial;

  for (const t of input.transactions) {
    if (t.accountId !== input.account.id) continue;
    if (!movementIsAtOrBeforePeriod(t, scope)) continue;
    amount += transactionAmount(t);
  }

  for (const tr of input.transfers) {
    if (!movementIsAtOrBeforePeriod(tr, scope)) continue;
    if (tr.sourceAccountId === input.account.id) amount -= transferSourceAmount(tr);
    if (tr.destinationAccountId === input.account.id) amount += transferDestinationAmount(tr);
  }

  return amount;
}

export function periodEndBalance(input: PeriodEndBalanceInput, scope: PeriodScope): number {
  return periodEndAmount(
    input,
    scope,
    input.account.initialBalance,
    t => (input.isIncome(t) ? t.amount : -t.amount),
    tr => tr.sourceAmount,
    tr => tr.destinationAmount,
  );
}

export function storedBaseAmount(transaction: Transaction): number {
  if (transaction.baseCurrencyAmount != null) {
    return transaction.baseCurrencyAmount;
  }
  if (transaction.exchangeRate != null) {
    return Math.round(transaction.amount * transaction.exchangeRate * 100) / 100;
  }
  return transaction.amount;
}

/* ADR 0013, amended by #182 and #199: a Transaction on an Account already in
   the Base Currency counts at its face amount, since a stored base amount
   there can only be a stale one from an earlier Base Currency. Otherwise the
   stored base amount wins, then the amount at the stored Exchange Rate, then
   the face amount. */
export function transactionBaseAmount(
  transaction: Transaction,
  account: Account | undefined,
  baseCurrency: string,
): number {
  return account && isBaseCurrencyAccount(account, baseCurrency)
    ? transaction.amount
    : storedBaseAmount(transaction);
}

/* ADR 0028: a Transfer's source side in Base Currency, or its face source
   amount when no conversion could be stored. */
export function storedTransferBaseAmount(transfer: Transfer): number {
  return transfer.baseCurrencyAmount ?? transfer.sourceAmount;
}

export function periodEndBaseAmount(
  input: PeriodEndBaseInput,
  scope: PeriodScope,
  initialInBase: number,
): number {
  const amount = periodEndAmount(
    input,
    scope,
    initialInBase,
    t => {
      const amount = transactionBaseAmount(t, input.account, input.baseCurrency);
      return input.isIncome(t) ? amount : -amount;
    },
    storedTransferBaseAmount,
    storedTransferBaseAmount,
  );
  return Math.round(amount * 100) / 100;
}
