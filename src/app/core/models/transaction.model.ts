export interface Transaction {
  id?: number;
  accountId: number;
  categoryId: number;
  amount: number;
  date: Date;
  period: string;
  year: number;
  exchangeRate: number | null;
  baseCurrencyAmount: number | null;
  note: string;
  createdAt: Date;
}
