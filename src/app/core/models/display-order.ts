import { Account, isCreditCard } from './account.model';
import { Category } from './category.model';
import { Language, localeFor } from '../types/language.type';

/* GLOSSARY.md, Account and Category: wherever they are listed, Accounts come
   Cash Accounts first, then Credit Cards, and Categories Expense first, then
   Income — each group alphabetical in the active Language, ignoring letter
   case and accents. Every list and picker shares this one rule. */

/* A run of items listed under one heading. `labelKey` is a translation key. */
export interface DisplayGroup<T> {
  labelKey: string;
  items: T[];
}

function byName(language: Language): (a: { name: string }, b: { name: string }) => number {
  const collator = new Intl.Collator(localeFor(language), { sensitivity: 'base' });
  return (a, b) => collator.compare(a.name, b.name);
}

/* Groups in their fixed order, each sorted by name; empty groups are left
   out so a picker never shows a heading over nothing. */
function grouped<T extends { name: string }>(
  items: readonly T[],
  language: Language,
  groups: { labelKey: string; belongs: (item: T) => boolean }[],
): DisplayGroup<T>[] {
  const compare = byName(language);
  return groups
    .map((g) => ({ labelKey: g.labelKey, items: items.filter(g.belongs).sort(compare) }))
    .filter((g) => g.items.length > 0);
}

export function categoryGroups(categories: readonly Category[], language: Language): DisplayGroup<Category>[] {
  return grouped(categories, language, [
    { labelKey: 'type.expense', belongs: (c) => c.type !== 'income' },
    { labelKey: 'type.income', belongs: (c) => c.type === 'income' },
  ]);
}

export function accountGroups(accounts: readonly Account[], language: Language): DisplayGroup<Account>[] {
  return grouped(accounts, language, [
    { labelKey: 'accountGroup.cash', belongs: (a) => !isCreditCard(a) },
    { labelKey: 'accountGroup.creditCard', belongs: (a) => isCreditCard(a) },
  ]);
}

export function sortCategories(categories: readonly Category[], language: Language): Category[] {
  return categoryGroups(categories, language).flatMap((g) => g.items);
}

export function sortAccounts(accounts: readonly Account[], language: Language): Account[] {
  return accountGroups(accounts, language).flatMap((g) => g.items);
}
