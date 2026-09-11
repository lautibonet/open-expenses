import { Account } from '../models/account.model';
import { Category, isIncomeCategory } from '../models/category.model';
import { Transaction } from '../models/transaction.model';
import { storedBaseAmount } from '../balances/period-end-balances';
import { isCreditCardTransaction } from './cash-basis';

/* One category's spending, split by how it was paid: `cash` is money that
   left a Cash Account, `credit` is spending that consumed a Credit Card's
   credit. `total` is their sum — the figure the bar's length encodes. */
export interface CategorySpending {
  categoryId: number;
  name: string;
  cash: number;
  credit: number;
  total: number;
}

/* ADR 0022: the category graph counts spending, not cash — every purchase,
   cash or credit, appears under its real category with its bar split into the
   cash-paid and credit-paid portions. Only expense Transactions count (income
   is not spending); the Card Payment categories are excluded because the
   purchases they settle already report the same spending. A Transaction whose
   account is unknown counts as cash, mirroring the cash-basis seam so an
   orphaned reference is never silently dropped; one whose category is unknown
   is skipped because it cannot be named. */
export function categorySpending(
  transactions: Transaction[],
  categoriesById: Map<number, Category>,
  accountsById: Map<number, Account>,
  paymentCategoryIds: Set<number> = new Set(),
): CategorySpending[] {
  const totals = new Map<number, { cash: number; credit: number }>();

  for (const transaction of transactions) {
    const category = categoriesById.get(transaction.categoryId);
    if (!category || isIncomeCategory(category.type)) continue;
    if (paymentCategoryIds.has(transaction.categoryId)) continue;

    const entry = totals.get(transaction.categoryId) ?? { cash: 0, credit: 0 };
    if (isCreditCardTransaction(transaction, accountsById)) {
      entry.credit += storedBaseAmount(transaction);
    } else {
      entry.cash += storedBaseAmount(transaction);
    }
    totals.set(transaction.categoryId, entry);
  }

  const rows: CategorySpending[] = [];
  for (const [categoryId, entry] of totals) {
    const cash = Math.round(entry.cash * 100) / 100;
    const credit = Math.round(entry.credit * 100) / 100;
    rows.push({
      categoryId,
      name: categoriesById.get(categoryId)!.name,
      cash,
      credit,
      total: Math.round((cash + credit) * 100) / 100,
    });
  }

  return rows.sort((a, b) => b.total - a.total);
}

/* A portion's share of a category's spending, as the percentage the bar's
   two-tone split renders. */
export function spendingShare(part: number, total: number): number {
  if (part <= 0 || total <= 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}
