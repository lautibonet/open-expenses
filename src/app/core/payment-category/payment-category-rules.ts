import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { namesMatch } from '../models/name-uniqueness';
import { translate } from '../translations/translations';
import { Language } from '../types/language.type';

/* The pure half of the Payment Category module (issue #184): the naming rule
   and the resolution decision, free of the database so the v8 migration and
   the Transfer Form can share them without a circular import. */

/* The one place the Payment Category's name is derived (amended ADR 0022):
   named after the card in the given Language — "Visa payment" / "Pago Visa". */
export function paymentCategoryName(cardName: string, language: Language): string {
  return translate(language, 'category.cardPayment', { name: cardName.trim() });
}

/* A fresh Payment Category under the given name, ready to be stored: always
   an Expense category (amended ADR 0022). */
export function newPaymentCategory(name: string): Category {
  return { name, type: 'expense', active: true, createdAt: new Date() };
}

/* Which category a card's Card Payments wear:
   - 'stored': the card's stored link points at an existing Expense category;
   - 'linkable': an Expense category already holds the payment name, and will
     be linked rather than duplicated;
   - 'new': nothing holds the name, so a category with it will be created;
   - 'taken': an Income category holds the name, so none can be provisioned
     (amended ADR 0022: only an Expense category can be linked).
   A stored link to an Income category predates that rule and is not
   trusted: the card resolves by name as if the link were dangling. */
export type PaymentCategoryResolution =
  | { kind: 'stored'; category: Category }
  | { kind: 'linkable'; category: Category }
  | { kind: 'new'; name: string }
  | { kind: 'taken'; name: string };

/* What resolution needs to know about a card — its name and stored link — so
   a card that is still being created can be resolved before it exists. */
export type PaymentCard = Pick<Account, 'name' | 'paymentCategoryId'>;

/* The category the card's stored link points at, when it is an Expense
   category — never looked up by name (ADR 0026). A missing link, a dangling
   one, or one pointing at an Income category yields none. */
export function storedPaymentCategory(
  card: Pick<Account, 'paymentCategoryId'>,
  categories: readonly Category[],
): Category | undefined {
  if (card.paymentCategoryId == null) return undefined;
  const stored = categories.find(c => c.id === card.paymentCategoryId);
  return stored?.type === 'expense' ? stored : undefined;
}

export function resolvePaymentCategory(
  card: PaymentCard,
  categories: readonly Category[],
  language: Language,
): PaymentCategoryResolution {
  const stored = storedPaymentCategory(card, categories);
  if (stored) {
    return { kind: 'stored', category: stored };
  }
  const name = paymentCategoryName(card.name, language);
  const named = categories.find(c => namesMatch(c.name, name));
  if (!named) {
    return { kind: 'new', name };
  }
  if (named.type !== 'expense') {
    return { kind: 'taken', name };
  }
  return { kind: 'linkable', category: named };
}
