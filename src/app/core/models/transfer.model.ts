export interface Transfer {
  id?: number;
  sourceAccountId: number;
  destinationAccountId: number;
  amount: number;
  date: Date;
  period: string;
  note: string;
  createdAt: Date;
}
