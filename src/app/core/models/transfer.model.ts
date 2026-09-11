import { MonthNumber } from '../types/period.type';

export interface Transfer {
  id?: number;
  sourceAccountId: number;
  destinationAccountId: number;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  baseCurrencyAmount: number;
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
