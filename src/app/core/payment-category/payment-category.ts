import { db } from '../db/database';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { DeletionPlan, REFUSED_FOR_MOVEMENTS } from '../models/deletion-plan';
import { TranslationError } from '../models/translation-error';
import { Language } from '../types/language.type';
import { namesMatch } from '../models/name-uniqueness';
import { accountHasMovements } from '../services/account-movements';
import { categoryHasTransactions } from '../services/category.service';
import {
  PaymentCard,
  newPaymentCategory,
  paymentCategoryName,
  resolvePaymentCategory,
  storedPaymentCategory,
} from './payment-category-rules';

export { type PaymentCard } from './payment-category-rules';

/* The Payment Category module (issue #184, amended ADR 0022, ADR 0024): it
   owns the pairing between a Credit Card and the category its Card Payments
   wear. Card creation, card rename, Transfer capture and card deletion all go
   through it. Each operation opens its own transaction, which joins the
   caller's when one is already running over the same tables. */

/* The card's Payment Category, provisioned when missing: a stored link to an
   Expense category wins; otherwise an Expense category holding the payment name is linked, or
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
      case 'stored':
        return resolution.category;
      case 'taken':
        throw new TranslationError('errors.categoryNameTaken', { name: resolution.name });
      case 'linkable':
        category = resolution.category;
        break;
      case 'new': {
        const created = newPaymentCategory(resolution.name);
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

/* The Payment Category a card's Card Payments wear, read from its stored
   link only (ADR 0026): every upgrade and Restore already links each card it
   can, so the payment path never provisions one. A card left without a usable
   link refuses the payment; renaming the card gives it one. */
export async function paymentCategoryOf(card: Pick<Account, 'paymentCategoryId'>): Promise<Category> {
  const linked = card.paymentCategoryId == null
    ? undefined
    : await db.categories.get(card.paymentCategoryId);
  const category = storedPaymentCategory(card, linked ? [linked] : []);
  if (!category) {
    throw new TranslationError('errors.cardHasNoPaymentCategory');
  }
  return category;
}

/* A renamed card renames its Payment Category after the new name (amended
   ADR 0022). Another category already holding that name refuses the rename;
   the card may change only the letter case of its own. A card with no usable
   stored category (a dangling link, or a link to an Income category) gets
   one created under the new name — refused the same way when any category
   already holds it. The caller renames the card itself in the same
   transaction, so a refusal fails the whole rename. */
export function renamePaymentCategory(
  card: Account,
  newCardName: string,
  language: Language,
): Promise<void> {
  return db.transaction('rw', db.accounts, db.categories, async () => {
    const renamed = { ...card, name: newCardName };
    const categories = await db.categories.toArray();
    const resolution = resolvePaymentCategory(renamed, categories, language);
    const name = paymentCategoryName(newCardName, language);
    if (resolution.kind === 'stored') {
      const own = resolution.category;
      if (categories.some(c => c.id !== own.id && namesMatch(c.name, name))) {
        throw new TranslationError('errors.categoryNameTaken', { name });
      }
      await db.categories.update(own.id!, { name });
      return;
    }
    if (resolution.kind !== 'new') {
      throw new TranslationError('errors.categoryNameTaken', { name });
    }
    await ensurePaymentCategory(renamed, language);
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
  | Extract<DeletionPlan, { kind: 'refused' }>
  | { kind: 'proceed'; category: 'absent' }
  | { kind: 'proceed'; category: 'delete' | 'keep'; categoryName: string };

/* Whether a plan is a card's that names its paired category's fate. Lets a
   caller holding plans of several kinds read the card's outcome. */
export function namesPairedCategory(
  plan: DeletionPlan | CardDeletionPlan | null,
): plan is Extract<CardDeletionPlan, { categoryName: string }> {
  return plan !== null && 'categoryName' in plan;
}

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
    return REFUSED_FOR_MOVEMENTS;
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
