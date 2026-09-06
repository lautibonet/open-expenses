import { Injectable } from '@angular/core';
import { db } from '../db/database';
import { Account } from '../models/account.model';
import { TranslationError } from '../models/translation-error';

@Injectable({ providedIn: 'root' })
export class AccountService {
  async create(name: string, currency: string, initialBalance: number): Promise<Account> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new TranslationError('errors.accountNameRequired');
    }
    if (initialBalance < 0) {
      throw new TranslationError('errors.initialBalanceNegative');
    }

    const existing = await db.accounts.where('name').equals(trimmedName).first();
    if (existing) {
      throw new TranslationError('errors.accountNameTaken', { name: trimmedName });
    }

    const account: Account = {
      name: trimmedName,
      currency: currency.toUpperCase(),
      initialBalance,
      active: true,
      createdAt: new Date(),
    };

    const id = await db.accounts.add(account);
    return { ...account, id };
  }

  async update(id: number, changes: { name?: string; initialBalance?: number }): Promise<Account> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new TranslationError('errors.accountNotFound');
    }

    if (changes.name !== undefined) {
      const trimmedName = changes.name.trim();
      if (!trimmedName) {
        throw new TranslationError('errors.accountNameRequired');
      }
      const existing = await db.accounts.where('name').equals(trimmedName).first();
      if (existing && existing.id !== id) {
        throw new TranslationError('errors.accountNameTaken', { name: trimmedName });
      }
      await db.accounts.update(id, { name: trimmedName });
    }

    if (changes.initialBalance !== undefined) {
      if (changes.initialBalance < 0) {
        throw new TranslationError('errors.initialBalanceNegative');
      }
      await db.accounts.update(id, { initialBalance: changes.initialBalance });
    }

    return (await db.accounts.get(id))!;
  }

  async setActive(id: number, active: boolean): Promise<void> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new TranslationError('errors.accountNotFound');
    }
    await db.accounts.update(id, { active });
  }

  /* ADR 0018: an Account has movements when any Transaction references it
     or any Transfer references it on either side. */
  async hasMovements(id: number): Promise<boolean> {
    const inTransactions = await db.transactions.where('accountId').equals(id).count();
    if (inTransactions > 0) return true;
    const asSource = await db.transfers.where('sourceAccountId').equals(id).count();
    if (asSource > 0) return true;
    return (await db.transfers.where('destinationAccountId').equals(id).count()) > 0;
  }

  /* Delete-if-unused, never cascade (ADR 0018): an Account with movements
     is refused; an unused Account is permanently removed. There is no
     guard on deleting the last remaining Account. */
  async delete(id: number): Promise<void> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new TranslationError('errors.accountNotFound');
    }
    if (await this.hasMovements(id)) {
      throw new TranslationError('errors.accountHasMovements');
    }
    await db.accounts.delete(id);
  }

  async getAll(): Promise<Account[]> {
    return db.accounts.toArray();
  }

  async getActive(): Promise<Account[]> {
    return db.accounts.filter(a => a.active).toArray();
  }

  async getById(id: number): Promise<Account | undefined> {
    return db.accounts.get(id);
  }
}
