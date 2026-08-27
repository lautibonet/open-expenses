export interface Transfer {
  id?: number;
  sourceAccountId: number;
  destinationAccountId: number;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  baseCurrencyAmount: number;
  date: Date;
  period: string;
  year: number;
  note: string;
  createdAt: Date;
}
