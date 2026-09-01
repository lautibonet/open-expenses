import { PeriodScope, movementIsAtOrBeforePeriod } from '../types/period.type';
import { Account } from '../models/account.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';

export interface PeriodEndBalanceInput {
  account: Account;
  transactions: Transaction[];
  transfers: Transfer[];
  isIncome: (transaction: Transaction) => boolean;
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

export function periodEndBaseAmount(
  input: PeriodEndBalanceInput,
  scope: PeriodScope,
  initialInBase: number,
): number {
  const amount = periodEndAmount(
    input,
    scope,
    initialInBase,
    t => (input.isIncome(t) ? storedBaseAmount(t) : -storedBaseAmount(t)),
    tr => tr.baseCurrencyAmount,
    tr => tr.baseCurrencyAmount,
  );
  return Math.round(amount * 100) / 100;
}
