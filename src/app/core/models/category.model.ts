export type CategoryType = 'income' | 'expense';

export interface Category {
  id?: number;
  name: string;
  type: CategoryType;
  active: boolean;
  createdAt: Date;
}

export function isCategoryType(value: unknown): value is CategoryType {
  return value === 'income' || value === 'expense';
}

export function isIncomeCategory(type: unknown): boolean {
  return isCategoryType(type) && type === 'income';
}

export function categoryTypeFromLegacy(value: unknown): CategoryType | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return isCategoryType(normalized) ? normalized : null;
}
