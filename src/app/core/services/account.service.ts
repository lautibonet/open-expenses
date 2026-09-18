import { Injectable, inject } from '@angular/core';
import { db } from '../db/database';
import { Account, isCashAccount, isCreditCard } from '../models/account.model';
import { TranslationError } from '../models/translation-error';
import { findOrCreateCategory } from './category.service';
import { LanguageService } from './language.service';

export interface CreateCardInput {
  name: string;
  currency: string;
  limit?: number | null;
  initialBalance?: number;
}

export interface AccountChanges {
  name?: string;
  currency?: string;
  initialBalance?: number;
  limit?: number | null;
}

export type DeleteRefusalReason = 'movements';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private languageService = inject(LanguageService);

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

  /* ADR 0022: a Credit Card is tied to no Account — its currency is chosen
     explicitly at creation and its initial balance is its starting debt,
     which may be negative. Amended 0022 (ticket #172): the payment category
     is no longer optional — every card owns one, provisioned in the same
     transaction and named in the active Language; a pre-existing category
     with that name is linked, not duplicated. */
  async createCard(input: CreateCardInput): Promise<Account> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new TranslationError('errors.accountNameRequired');
    }
    const currency = input.currency?.trim().toUpperCase();
    if (!currency) {
      throw new TranslationError('errors.currencyRequired');
    }

    const existing = await db.accounts.where('name').equals(trimmedName).first();
    if (existing) {
      throw new TranslationError('errors.accountNameTaken', { name: trimmedName });
    }

    if (input.limit != null && input.limit < 0) {
      throw new TranslationError('errors.cardLimitNegative');
    }

    return db.transaction('rw', db.accounts, db.categories, async () => {
      const paymentCategory = await findOrCreateCategory(
        this.languageService.t('category.cardPayment', { name: trimmedName }),
        'expense',
      );
      const card: Account = {
        name: trimmedName,
        currency,
        initialBalance: input.initialBalance ?? 0,
        active: true,
        kind: 'credit-card',
        paymentCategoryId: paymentCategory.id,
        createdAt: new Date(),
      };
      if (input.limit != null) {
        card.limit = input.limit;
      }

      const id = await db.accounts.add(card);
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
      /* Amended 0022: a card owns its payment category, so the category
         follows the name; a collision fails the whole rename atomically. */
      if (card && account.paymentCategoryId != null) {
        const paymentName = this.languageService.t('category.cardPayment', {
          name: trimmedName,
        });
        await db.transaction('rw', db.accounts, db.categories, async () => {
          const taken = await db.categories.where('name').equals(paymentName).first();
          if (taken && taken.id !== account.paymentCategoryId) {
            throw new TranslationError('errors.categoryNameTaken', { name: paymentName });
          }
          await db.accounts.update(id, { name: trimmedName });
          await db.categories.update(account.paymentCategoryId!, { name: paymentName });
        });
      } else {
        await db.accounts.update(id, { name: trimmedName });
      }
    }

    /* ADR 0022: an Account's currency is chosen at creation and can change
       only while it has no movements — a currency change with recorded
       movements would silently reinterpret history. */
    if (changes.currency !== undefined) {
      const currency = changes.currency.trim().toUpperCase();
      if (currency !== account.currency) {
        if (await this.hasMovements(id)) {
          throw new TranslationError('errors.currencyHasMovements');
        }
        if (!currency) {
          throw new TranslationError('errors.currencyRequired');
        }
        await db.accounts.update(id, { currency });
      }
    }

    if (changes.initialBalance !== undefined) {
      /* A Cash Account may not go negative; a Credit Card's is its debt. */
      if (!card && changes.initialBalance < 0) {
        throw new TranslationError('errors.initialBalanceNegative');
      }
      await db.accounts.update(id, { initialBalance: changes.initialBalance });
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

  /* What would refuse Delete, in the order the explanation is offered. */
  async getDeleteRefusal(id: number): Promise<DeleteRefusalReason | null> {
    if (await this.hasMovements(id)) return 'movements';
    return null;
  }

  /* Delete-if-unused, never cascade (ADR 0018): an Account carrying movements
     is refused; an unused Account is permanently removed. There is no guard
     on deleting the last Account. */
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

  async getCashAccounts(): Promise<Account[]> {
    return db.accounts.filter(isCashAccount).toArray();
  }

  async getCards(): Promise<Account[]> {
    return db.accounts.where('kind').equals('credit-card').toArray();
  }

  /* Accounts offered to the Transaction capture: both Cash Accounts and
     Credit Cards. */
  async getActive(): Promise<Account[]> {
    return db.accounts.filter(a => a.active).toArray();
  }

  async getById(id: number): Promise<Account | undefined> {
    return db.accounts.get(id);
  }
}
