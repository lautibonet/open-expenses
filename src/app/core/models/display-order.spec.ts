import { describe, expect, it } from 'vitest';
import { Account } from './account.model';
import { Category, CategoryType } from './category.model';
import { accountGroups, categoryGroups, sortAccounts, sortCategories } from './display-order';

function category(id: number, name: string, type: CategoryType): Category {
  return { id, name, type, active: true, createdAt: new Date() };
}

function account(id: number, name: string, kind: Account['kind'] = 'cash'): Account {
  return { id, name, currency: 'EUR', initialBalance: 0, active: true, kind, createdAt: new Date() };
}

const names = (items: { name: string }[]) => items.map((i) => i.name);

describe('sortCategories', () => {
  it('lists Expense first, then Income, each alphabetically', () => {
    const categories = [
      category(1, 'Payroll', 'income'),
      category(2, 'Transport', 'expense'),
      category(3, 'Bonus', 'income'),
      category(4, 'Food', 'expense'),
    ];
    expect(names(sortCategories(categories, 'en'))).toEqual(['Food', 'Transport', 'Bonus', 'Payroll']);
  });

  it('ignores letter case and accents', () => {
    const categories = [
      category(1, 'ocio', 'expense'),
      category(2, 'Óptica', 'expense'),
      category(3, 'Comida', 'expense'),
      category(4, 'Alquiler', 'expense'),
    ];
    expect(names(sortCategories(categories, 'es'))).toEqual(['Alquiler', 'Comida', 'ocio', 'Óptica']);
  });

  it('keeps deactivated categories in their alphabetical place', () => {
    const categories = [category(1, 'Zoo', 'expense'), { ...category(2, 'Bar', 'expense'), active: false }];
    expect(names(sortCategories(categories, 'en'))).toEqual(['Bar', 'Zoo']);
  });

  it('never mutates its input', () => {
    const categories = [category(1, 'B', 'expense'), category(2, 'A', 'expense')];
    sortCategories(categories, 'en');
    expect(names(categories)).toEqual(['B', 'A']);
  });
});

describe('categoryGroups', () => {
  it('labels the Expense group, then the Income group', () => {
    const groups = categoryGroups([category(1, 'Payroll', 'income'), category(2, 'Food', 'expense')], 'en');
    expect(groups.map((g) => g.labelKey)).toEqual(['type.expense', 'type.income']);
  });

  it('leaves out an empty group', () => {
    const groups = categoryGroups([category(1, 'Food', 'expense')], 'en');
    expect(groups.map((g) => g.labelKey)).toEqual(['type.expense']);
  });
});

describe('sortAccounts', () => {
  it('lists Cash Accounts first, then Credit Cards, each alphabetically', () => {
    const accounts = [
      account(1, 'Visa', 'credit-card'),
      account(2, 'Wallet'),
      account(3, 'Amex', 'credit-card'),
      account(4, 'bank'),
    ];
    expect(names(sortAccounts(accounts, 'en'))).toEqual(['bank', 'Wallet', 'Amex', 'Visa']);
  });
});

describe('accountGroups', () => {
  it('labels Cash Accounts, then Credit Cards, leaving out an empty group', () => {
    expect(accountGroups([account(1, 'Visa', 'credit-card'), account(2, 'Bank')], 'en').map((g) => g.labelKey)).toEqual([
      'accountGroup.cash',
      'accountGroup.creditCard',
    ]);
    expect(accountGroups([account(1, 'Bank')], 'en').map((g) => g.labelKey)).toEqual(['accountGroup.cash']);
  });
});
