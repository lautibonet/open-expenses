import { Injectable } from '@angular/core';
import { db } from '../db/database';
import { Transaction } from '../models/transaction.model';
import { getCurrentYear, getPeriodYear, isValidYear } from '../types/period.type';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  async create(
    accountId: number,
    categoryId: number,
    amount: number,
    date: Date,
    period: string,
    tags: string[] = [],
    exchangeRate: number | null = null,
    baseCurrencyAmount: number | null = null,
    year: number = getCurrentYear(),
  ): Promise<Transaction> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!period) {
      throw new Error('Period is required');
    }
    if (!isValidYear(year)) {
      throw new Error('Year must be a valid 4-digit year');
    }

    const account = await db.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const category = await db.categories.get(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    const cleanedTags = tags
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const transaction: Transaction = {
      accountId,
      categoryId,
      amount,
      date,
      period,
      year,
      tags: cleanedTags,
      exchangeRate,
      baseCurrencyAmount,
      createdAt: new Date(),
    };

    const id = await db.transactions.add(transaction);
    return { ...transaction, id };
  }

  async update(
    id: number,
    changes: Partial<Omit<Transaction, 'id' | 'createdAt'>>,
  ): Promise<Transaction> {
    const existing = await db.transactions.get(id);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    if (changes.amount !== undefined && changes.amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (changes.year !== undefined && !isValidYear(changes.year)) {
      throw new Error('Year must be a valid 4-digit year');
    }

    if (changes.tags !== undefined) {
      changes.tags = changes.tags
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);
    }

    await db.transactions.update(id, changes);
    return (await db.transactions.get(id))!;
  }

  async delete(id: number): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) {
      throw new Error('Transaction not found');
    }
    await db.transactions.delete(id);
  }

  async getAll(): Promise<Transaction[]> {
    return db.transactions.toArray();
  }

  async getByPeriod(period: string, year?: number): Promise<Transaction[]> {
    const transactions = await db.transactions.where('period').equals(period).toArray();
    if (year === undefined) {
      return transactions;
    }
    return transactions.filter(t => getPeriodYear(t) === year);
  }

  async getByAccount(accountId: number): Promise<Transaction[]> {
    return db.transactions.where('accountId').equals(accountId).toArray();
  }

  async getByCategory(categoryId: number): Promise<Transaction[]> {
    return db.transactions.where('categoryId').equals(categoryId).toArray();
  }

  async getById(id: number): Promise<Transaction | undefined> {
    return db.transactions.get(id);
  }

  async getAllTags(): Promise<string[]> {
    const transactions = await db.transactions.toArray();
    const tagSet = new Set<string>();
    for (const t of transactions) {
      for (const tag of t.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }

  async getTagCounts(): Promise<{ tag: string; count: number }[]> {
    const transactions = await db.transactions.toArray();
    const counts = new Map<string, number>();
    for (const t of transactions) {
      for (const tag of t.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  async deleteTag(tagName: string): Promise<void> {
    const cleaned = tagName.trim().toLowerCase();
    if (!cleaned) {
      throw new Error('Tag name cannot be empty');
    }

    const allTransactions = await db.transactions.toArray();
    for (const t of allTransactions) {
      if (t.tags.includes(cleaned)) {
        const updatedTags = t.tags.filter(tag => tag !== cleaned);
        await db.transactions.update(t.id!, { tags: updatedTags });
      }
    }
  }

  async renameTag(oldName: string, newName: string): Promise<void> {
    const cleanedOld = oldName.trim().toLowerCase();
    const cleanedNew = newName.trim().toLowerCase();
    if (!cleanedOld || !cleanedNew) {
      throw new Error('Tag names cannot be empty');
    }
    if (cleanedOld === cleanedNew) {
      return;
    }

    const allTransactions = await db.transactions.toArray();
    for (const t of allTransactions) {
      if (t.tags.includes(cleanedOld)) {
        const updatedTags = t.tags.map(tag => (tag === cleanedOld ? cleanedNew : tag));
        await db.transactions.update(t.id!, { tags: updatedTags });
      }
    }
  }
}
