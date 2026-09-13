import { Injectable } from '@angular/core';
import { db } from '../db/database';
import { Category, CategoryType, isCategoryType } from '../models/category.model';
import { DEFAULT_LANGUAGE, Language } from '../types/language.type';
import { translate } from '../translations/translations';
import { TranslationError } from '../models/translation-error';

const DEFAULT_CATEGORIES: { key: string; type: CategoryType }[] = [
  { key: 'food', type: 'expense' },
  { key: 'transport', type: 'expense' },
  { key: 'housing', type: 'expense' },
  { key: 'subscriptions', type: 'expense' },
  { key: 'leisure', type: 'expense' },
  { key: 'misc', type: 'expense' },
  { key: 'payroll', type: 'income' },
  { key: 'secondHandSale', type: 'income' },
  { key: 'refund', type: 'income' },
];

function assertCategoryType(type: CategoryType): void {
  if (!isCategoryType(type)) {
    throw new TranslationError('errors.categoryTypeInvalid');
  }
}

function categoryName(key: string, language: Language): string {
  return translate(language, `category.${key}`);
}

/* Category creation as a plain function so callers that are not DI-injected
   (and the AccountService's card transaction) can reuse the same rules. */
export async function createCategory(name: string, type: CategoryType): Promise<Category> {
  assertCategoryType(type);
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new TranslationError('errors.categoryNameRequired');
  }

  const existing = await db.categories.where('name').equals(trimmedName).first();
  if (existing) {
    throw new TranslationError('errors.categoryNameTaken', { name: trimmedName });
  }

  const category: Category = {
    name: trimmedName,
    type,
    active: true,
    createdAt: new Date(),
  };

  const id = await db.categories.add(category);
  return { ...category, id };
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  static defaultCategories(language: Language): { key: string; name: string; type: CategoryType }[] {
    return DEFAULT_CATEGORIES.map(c => ({
      key: c.key,
      name: categoryName(c.key, language),
      type: c.type,
    }));
  }

  static defaultCategoryName(key: string, language: Language): string {
    return categoryName(key, language);
  }

  async create(name: string, type: CategoryType): Promise<Category> {
    return createCategory(name, type);
  }

  async update(id: number, changes: { name?: string; type?: CategoryType }): Promise<Category> {
    if (changes.type !== undefined) {
      assertCategoryType(changes.type);
    }
    const category = await db.categories.get(id);
    if (!category) {
      throw new TranslationError('errors.categoryNotFound');
    }

    if (changes.name !== undefined) {
      const trimmedName = changes.name.trim();
      if (!trimmedName) {
        throw new TranslationError('errors.categoryNameRequired');
      }
      const existing = await db.categories.where('name').equals(trimmedName).first();
      if (existing && existing.id !== id) {
        throw new TranslationError('errors.categoryNameTaken', { name: trimmedName });
      }
      await db.categories.update(id, { name: trimmedName });
    }

    if (changes.type !== undefined) {
      await db.categories.update(id, { type: changes.type });
    }

    return (await db.categories.get(id))!;
  }

  async setActive(id: number, active: boolean): Promise<void> {
    const category = await db.categories.get(id);
    if (!category) {
      throw new TranslationError('errors.categoryNotFound');
    }
    await db.categories.update(id, { active });
  }

  /* ADR 0018: a Category has movements when any Transaction references it. */
  async hasMovements(id: number): Promise<boolean> {
    return (await db.transactions.where('categoryId').equals(id).count()) > 0;
  }

  /* Delete-if-unused, never cascade (ADR 0018): a Category referenced by a
     Transaction is refused; an unused Category is permanently removed. */
  async delete(id: number): Promise<void> {
    const category = await db.categories.get(id);
    if (!category) {
      throw new TranslationError('errors.categoryNotFound');
    }
    if (await this.hasMovements(id)) {
      throw new TranslationError('errors.categoryHasMovements');
    }
    await db.categories.delete(id);
  }

  async getAll(): Promise<Category[]> {
    return db.categories.toArray();
  }

  async getActive(): Promise<Category[]> {
    return db.categories.filter(c => c.active).toArray();
  }

  async getById(id: number): Promise<Category | undefined> {
    return db.categories.get(id);
  }

  async seedDefaults(language: Language = DEFAULT_LANGUAGE): Promise<void> {
    const count = await db.categories.count();
    if (count > 0) return;

    for (const cat of CategoryService.defaultCategories(language)) {
      await this.create(cat.name, cat.type);
    }
  }
}
