import { db } from '../db/database';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { TranslationError } from '../models/translation-error';
import { Language } from '../types/language.type';
import { namesMatch } from '../models/name-uniqueness';
import { accountHasMovements } from '../services/account-movements';
import { categoryHasTransactions } from '../services/category.service';
import {
  PaymentCard,
  paymentCategoryName,
  resolvePaymentCategory,
} from './payment-category-rules';

export {
  paymentCategoryName,
  resolvePaymentCategory,
  type PaymentCard,
  type PaymentCategoryResolution,
} from './payment-category-rules';

/* The Payment Category module (issue #184, amended ADR 0022, ADR 0024): it
   owns the pairing between a Credit Card and the category its Card Payments
   wear. Card creation, card rename, Transfer capture and card deletion all go
   through it. Each operation opens its own transaction, which joins the
   caller's when one is already running over the same tables. */

/* The card's Payment Category, provisioned when missing: the stored link
   wins; otherwise an Expense category holding the payment name is linked, or
   a new one is created. A card that already exists has the result written
   back as its link, so a dangling link is repaired once. Refused with the
   name-taken error when an Income category holds the payment name. */
export function ensurePaymentCategory(
  card: PaymentCard & Pick<Account, 'id'>,
  language: Language,
): Promise<Category> {
  return db.transaction('rw', db.accounts, db.categories, async () => {
    const resolution = resolvePaymentCategory(card, await db.categories.toArray(), language);
    let category: Category;
    switch (resolution.kind) {
      case 'linked':
        return resolution.category;
      case 'taken':
        throw new TranslationError('errors.categoryNameTaken', { name: resolution.name });
      case 'matched':
        category = resolution.category;
        break;
      case 'new': {
        const created: Category = {
          name: resolution.name,
          type: 'expense',
          active: true,
          createdAt: new Date(),
        };
        category = { ...created, id: await db.categories.add(created) };
        break;
      }
    }
    if (card.id != null) {
      await db.accounts.update(card.id, { paymentCategoryId: category.id });
    }
    return category;
  });
}

/* A renamed card renames its Payment Category after the new name (amended
   ADR 0022). Another category already holding that name refuses the rename;
   the card may change only the letter case of its own. A card whose link is
   dangling gets its category resolved under the new name instead. The
   caller renames the card itself in the same transaction, so a refusal
   fails the whole rename. */
export function renamePaymentCategory(
  card: Account,
  newCardName: string,
  language: Language,
): Promise<void> {
  return db.transaction('rw', db.accounts, db.categories, async () => {
    const linked =
      card.paymentCategoryId != null ? await db.categories.get(card.paymentCategoryId) : undefined;
    if (!linked) {
      await ensurePaymentCategory({ ...card, name: newCardName }, language);
      return;
    }
    const name = paymentCategoryName(newCardName, language);
    const taken = await db.categories
      .filter(c => c.id !== linked.id && namesMatch(c.name, name))
      .first();
    if (taken) {
      throw new TranslationError('errors.categoryNameTaken', { name });
    }
    await db.categories.update(linked.id!, { name });
  });
}

/* What deleting a card will do (ADR 0018, ADR 0024): a card with movements
   is refused; otherwise it goes, and its paired Payment Category is
   - 'delete'd with it when the category has no Transactions,
   - 'keep't when it has Transactions (active or deactivated), and the
     caller explains why,
   - 'absent' when there is no link or the link is dangling: a silent no-op.
   The category's name travels with the plan so the caller can name it. */
export type CardDeletionPlan =
  | { kind: 'refused'; reason: 'movements' }
  | { kind: 'proceed'; category: 'absent' }
  | { kind: 'proceed'; category: 'delete' | 'keep'; categoryName: string };

/* The plan for the card delete confirm step: nothing is removed. */
export function planCardDeletion(cardId: number): Promise<CardDeletionPlan> {
  return db.transaction('r', db.accounts, db.categories, db.transactions, db.transfers, async () => {
    const card = await db.accounts.get(cardId);
    if (!card) {
      throw new TranslationError('errors.accountNotFound');
    }
    return planFor(card);
  });
}

/* Deletes the card by the same plan, decided again inside the transaction so
   a movement recorded since the confirm step refuses rather than throws. The
   card and its unused paired category vanish together or not at all. */
export function deleteCard(cardId: number): Promise<CardDeletionPlan> {
  return db.transaction('rw', db.accounts, db.categories, db.transactions, db.transfers, async () => {
    const card = await db.accounts.get(cardId);
    if (!card) {
      throw new TranslationError('errors.accountNotFound');
    }
    const plan = await planFor(card);
    if (plan.kind === 'refused') {
      return plan;
    }
    await db.accounts.delete(cardId);
    if (plan.category === 'delete') {
      await db.categories.delete(card.paymentCategoryId!);
    }
    return plan;
  });
}

async function planFor(card: Account): Promise<CardDeletionPlan> {
  if (await accountHasMovements(card.id!)) {
    return { kind: 'refused', reason: 'movements' };
  }
  const category =
    card.paymentCategoryId != null ? await db.categories.get(card.paymentCategoryId) : undefined;
  if (!category) {
    return { kind: 'proceed', category: 'absent' };
  }
  return {
    kind: 'proceed',
    category: (await categoryHasTransactions(category.id!)) ? 'keep' : 'delete',
    categoryName: category.name,
  };
}
