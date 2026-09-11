import { Injectable } from '@angular/core';
import { db } from '../db/database';
import { Account, isCashAccount, isCreditCard } from '../models/account.model';
import { TranslationError } from '../models/translation-error';
import { createCategory } from './category.service';

export interface CreateCardInput {
  name: string;
  linkedAccountId: number;
  limit?: number | null;
  initialBalance?: number;
}

export interface AccountChanges {
  name?: string;
  initialBalance?: number;
  linkedAccountId?: number;
  limit?: number | null;
}

export type DeleteRefusalReason = 'movements' | 'linked-card';

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
      kind: 'cash',
      createdAt: new Date(),
    };

    const id = await db.accounts.add(account);
    return { ...account, id };
  }

  /* ADR 0022: a Credit Card's account is a Cash Account, its currency is
     seeded from that account, and its initial balance is its starting debt —
     which may be negative. With consent, its payment category is created in
     the same transaction, named by the caller in the active Language. */
  async createCard(
    input: CreateCardInput,
    paymentCategoryName?: string | null,
  ): Promise<Account> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new TranslationError('errors.accountNameRequired');
    }
    if (input.linkedAccountId == null) {
      throw new TranslationError('errors.linkedAccountRequired');
    }

    const existing = await db.accounts.where('name').equals(trimmedName).first();
    if (existing) {
      throw new TranslationError('errors.accountNameTaken', { name: trimmedName });
    }

    const linked = await db.accounts.get(input.linkedAccountId);
    if (!linked || !isCashAccount(linked)) {
      throw new TranslationError('errors.linkedAccountMustBeCash');
    }

    if (input.limit != null && input.limit < 0) {
      throw new TranslationError('errors.cardLimitNegative');
    }

    return db.transaction('rw', db.accounts, db.categories, async () => {
      const card: Account = {
        name: trimmedName,
        currency: linked.currency,
        initialBalance: input.initialBalance ?? 0,
        active: true,
        kind: 'credit-card',
        linkedAccountId: linked.id,
        createdAt: new Date(),
      };
      if (input.limit != null) {
        card.limit = input.limit;
      }

      const id = await db.accounts.add(card);
      if (paymentCategoryName) {
        await createCategory(paymentCategoryName, 'expense');
      }
      return { ...card, id };
    });
  }

  async update(id: number, changes: AccountChanges): Promise<Account> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new TranslationError('errors.accountNotFound');
    }
    const card = isCreditCard(account);

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
      /* A Cash Account may not go negative; a Credit Card's is its debt. */
      if (!card && changes.initialBalance < 0) {
        throw new TranslationError('errors.initialBalanceNegative');
      }
      await db.accounts.update(id, { initialBalance: changes.initialBalance });
    }

    if (card && changes.linkedAccountId !== undefined) {
      const linked = await db.accounts.get(changes.linkedAccountId);
      if (!linked || !isCashAccount(linked)) {
        throw new TranslationError('errors.linkedAccountMustBeCash');
      }
      await db.accounts.update(id, { linkedAccountId: changes.linkedAccountId });
    }

    if (card && changes.limit !== undefined) {
      if (changes.limit != null && changes.limit < 0) {
        throw new TranslationError('errors.cardLimitNegative');
      }
      await db.accounts.update(id, { limit: changes.limit ?? undefined });
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

  /* A Credit Card counts as a reference to its Linked Account (CONTEXT.md,
     Delete): a Cash Account any card points to cannot be deleted. */
  async hasCardReference(id: number): Promise<boolean> {
    return (await db.accounts.where('linkedAccountId').equals(id).count()) > 0;
  }

  /* What would refuse Delete, in the order the explanation is offered. */
  async getDeleteRefusal(id: number): Promise<DeleteRefusalReason | null> {
    if (await this.hasCardReference(id)) return 'linked-card';
    if (await this.hasMovements(id)) return 'movements';
    return null;
  }

  /* Delete-if-unused, never cascade (ADR 0018): an Account referenced by a
     Credit Card or carrying movements is refused; an unused Account is
     permanently removed. There is no guard on deleting the last Account. */
  async delete(id: number): Promise<void> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new TranslationError('errors.accountNotFound');
    }
    if (await this.hasCardReference(id)) {
      throw new TranslationError('errors.accountLinkedToCard');
    }
    if (await this.hasMovements(id)) {
      throw new TranslationError('errors.accountHasMovements');
    }
    await db.accounts.delete(id);
  }

  async getAll(): Promise<Account[]> {
    return db.accounts.toArray();
  }

  async getCashAccounts(): Promise<Account[]> {
    return db.accounts.filter(isCashAccount).toArray();
  }

  async getCards(): Promise<Account[]> {
    return db.accounts.where('kind').equals('credit-card').toArray();
  }

  /* Accounts offered to capture. Cards stay out until the capture forms learn
     about them (a later Ticket), so card purchases cannot reach the cash-basis
     KPIs before the reporting rules land. */
  async getActive(): Promise<Account[]> {
    return db.accounts.filter(a => a.active && isCashAccount(a)).toArray();
  }

  async getById(id: number): Promise<Account | undefined> {
    return db.accounts.get(id);
  }
}
