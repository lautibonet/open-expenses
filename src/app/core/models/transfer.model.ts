import { MonthNumber } from '../types/period.type';

export interface Transfer {
  id?: number;
  sourceAccountId: number;
  destinationAccountId: number;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  /* ADR 0028: the source side in Base Currency. Null only on an old Transfer
     that could not be repaired: neither account in the Base Currency and no
     base rate stored. */
  baseCurrencyAmount: number | null;
  /* ADR 0028: the source-to-base Exchange Rate, stored only when neither
     account is in the Base Currency. */
  baseExchangeRate?: number;
  date: Date;
  period: MonthNumber;
  year: number;
  note: string;
  createdAt: Date;
  /* ADR 0022: a Transfer into a Credit Card carries an Expense category that
     labels it. Only a Cash Account into a Credit Card (a Card Payment) counts
     as an Expense; it is absent when the destination is a Cash Account. */
  categoryId?: number;
}

/* ADR 0028: whether neither account is in the Base Currency, the one case
   where a Transfer needs its own source-to-base Exchange Rate. */
export function needsBaseExchangeRate(
  sourceCurrency: string,
  destinationCurrency: string,
  baseCurrency: string,
): boolean {
  return sourceCurrency !== baseCurrency && destinationCurrency !== baseCurrency;
}

/* ADR 0028: a Transfer's base amount is its source side in Base Currency —
   the source amount when the source is in base, the destination amount when
   the destination is, the source at its base rate otherwise. Null when
   neither account is in base and no base rate is stored. */
export function transferBaseAmount(
  transfer: Pick<Transfer, 'sourceAmount' | 'destinationAmount' | 'baseExchangeRate'>,
  sourceCurrency: string,
  destinationCurrency: string,
  baseCurrency: string,
): number | null {
  if (sourceCurrency === baseCurrency) return transfer.sourceAmount;
  if (destinationCurrency === baseCurrency) return transfer.destinationAmount;
  if (transfer.baseExchangeRate == null) return null;
  return Math.round(transfer.sourceAmount * transfer.baseExchangeRate * 100) / 100;
}
