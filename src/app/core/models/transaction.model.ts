export interface Transaction {
  id?: number;
  accountId: number;
  categoryId: number;
  amount: number;
  date: Date;
  period: string;
  tags: string[];
  exchangeRate: number | null;
  baseCurrencyAmount: number | null;
  createdAt: Date;
}
