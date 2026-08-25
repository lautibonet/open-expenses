import { Injectable } from '@angular/core';
import { db } from '../db/database';
import { Category, CategoryType } from '../models/category.model';
import { DEFAULT_CATEGORIES } from '../types/period.type';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  async create(name: string, type: CategoryType): Promise<Category> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Category name is required');
    }

    const existing = await db.categories.where('name').equals(trimmedName).first();
    if (existing) {
      throw new Error('Category name must be unique');
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

  async update(id: number, changes: { name?: string; type?: CategoryType }): Promise<Category> {
    const category = await db.categories.get(id);
    if (!category) {
      throw new Error('Category not found');
    }

    if (changes.name !== undefined) {
      const trimmedName = changes.name.trim();
      if (!trimmedName) {
        throw new Error('Category name is required');
      }
      const existing = await db.categories.where('name').equals(trimmedName).first();
      if (existing && existing.id !== id) {
        throw new Error('Category name must be unique');
      }
      await db.categories.update(id, { name: trimmedName });
    }

    if (changes.type !== undefined) {
      await db.categories.update(id, { type: changes.type });
    }

    return (await db.categories.get(id))!;
  }

  async deactivate(id: number): Promise<void> {
    const category = await db.categories.get(id);
    if (!category) {
      throw new Error('Category not found');
    }
    await db.categories.update(id, { active: false });
  }

  async reactivate(id: number): Promise<void> {
    const category = await db.categories.get(id);
    if (!category) {
      throw new Error('Category not found');
    }
    await db.categories.update(id, { active: true });
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

  async seedDefaults(): Promise<void> {
    const count = await db.categories.count();
    if (count > 0) return;

    for (const cat of DEFAULT_CATEGORIES) {
      await this.create(cat.name, cat.type);
    }
  }
}
