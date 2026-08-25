export type CategoryType = 'Income' | 'Expense';

export interface Category {
  id?: number;
  name: string;
  type: CategoryType;
  active: boolean;
  createdAt: Date;
}
