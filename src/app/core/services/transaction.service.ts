import { Injectable } from '@angular/core';
import { db } from '../db/database';
import { Transaction } from '../models/transaction.model';
import {
  PERIOD_ERROR,
  PeriodScope,
  getCurrentYear,
  getPeriodYear,
  isValidPeriod,
  isValidYear,
} from '../types/period.type';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  async create(
    accountId: number,
    categoryId: number,
    amount: number,
    date: Date,
    period: number,
    exchangeRate: number | null = null,
    baseCurrencyAmount: number | null = null,
    year: number = getCurrentYear(),
    note: string = '',
  ): Promise<Transaction> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!isValidPeriod(period)) {
      throw new Error(PERIOD_ERROR);
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

    const transaction: Transaction = {
      accountId,
      categoryId,
      amount,
      date,
      period,
      year,
      exchangeRate,
      baseCurrencyAmount,
      note,
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

    if (changes.period !== undefined && !isValidPeriod(changes.period)) {
      throw new Error(PERIOD_ERROR);
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

  async restore(snapshot: Transaction): Promise<Transaction> {
    if (!snapshot.id) {
      throw new Error('Transaction id is required');
    }
    const existing = await db.transactions.get(snapshot.id);
    if (existing) {
      throw new Error('Transaction already exists');
    }
    const { id, ...fields } = snapshot;
    await db.transactions.add({ ...fields, id });
    return (await db.transactions.get(id))!;
  }

  async getAll(): Promise<Transaction[]> {
    return db.transactions.toArray();
  }

  async getByPeriod(period: number, year?: number): Promise<Transaction[]> {
    const transactions = await db.transactions.where('period').equals(period as any).toArray();
    if (year === undefined) {
      return transactions;
    }
    return transactions.filter(t => getPeriodYear(t) === year);
  }

  async getByScope(scope: PeriodScope): Promise<Transaction[]> {
    if (scope.kind === 'all-time') {
      return this.getAll();
    }
    return this.getByPeriod(scope.period, scope.year);
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
}
