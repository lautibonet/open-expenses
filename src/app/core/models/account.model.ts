export interface Account {
  id?: number;
  name: string;
  currency: string;
  initialBalance: number;
  active: boolean;
  createdAt: Date;
}
