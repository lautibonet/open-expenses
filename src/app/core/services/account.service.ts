import { Injectable, inject } from '@angular/core';
import { db } from '../db/database';
import { Account, isCashAccount, isCreditCard } from '../models/account.model';
import { namesMatch } from '../models/name-uniqueness';
import { TranslationError } from '../models/translation-error';
import { deleteCard, ensurePaymentCategory, renamePaymentCategory } from '../payment-category/payment-category';
import { accountHasMovements } from './account-movements';
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

/* Issue #180: names are unique ignoring letter case, so the lookup applies
   the shared rule rather than the exact-match name index. */
function findAccountNamed(name: string): Promise<Account | undefined> {
  return db.accounts.filter(a => namesMatch(a.name, name)).first();
}

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

    const existing = await findAccountNamed(trimmedName);
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
     transaction by the Payment Category module (issue #184). */
  async createCard(input: CreateCardInput): Promise<Account> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new TranslationError('errors.accountNameRequired');
    }
    const currency = input.currency?.trim().toUpperCase();
    if (!currency) {
      throw new TranslationError('errors.currencyRequired');
    }

    const existing = await findAccountNamed(trimmedName);
    if (existing) {
      throw new TranslationError('errors.accountNameTaken', { name: trimmedName });
    }

    if (input.limit != null && input.limit < 0) {
      throw new TranslationError('errors.cardLimitNegative');
    }

    return db.transaction('rw', db.accounts, db.categories, async () => {
      const paymentCategory = await ensurePaymentCategory(
        { name: trimmedName },
        this.languageService.activeLanguage(),
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
      const existing = await findAccountNamed(trimmedName);
      if (existing && existing.id !== id) {
        throw new TranslationError('errors.accountNameTaken', { name: trimmedName });
      }
      /* Amended 0022: a card owns its payment category, so the category
         follows the name; a collision fails the whole rename atomically. */
      if (card) {
        await db.transaction('rw', db.accounts, db.categories, async () => {
          await renamePaymentCategory(account, trimmedName, this.languageService.activeLanguage());
          await db.accounts.update(id, { name: trimmedName });
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
  hasMovements(id: number): Promise<boolean> {
    return accountHasMovements(id);
  }

  /* What would refuse Delete, in the order the explanation is offered. */
  async getDeleteRefusal(id: number): Promise<DeleteRefusalReason | null> {
    if (await this.hasMovements(id)) return 'movements';
    return null;
  }

  /* Delete-if-unused, never cascade (ADR 0018): an Account carrying movements
     is refused; an unused Account is permanently removed. There is no guard
     on deleting the last Account. A card goes through the Payment Category
     module (ADR 0024), so its paired category is never left behind. */
  async delete(id: number): Promise<void> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new TranslationError('errors.accountNotFound');
    }
    if (isCreditCard(account)) {
      const plan = await deleteCard(id);
      if (plan.kind === 'refused') {
        throw new TranslationError('errors.accountHasMovements');
      }
      return;
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
