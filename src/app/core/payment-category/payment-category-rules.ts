import { Account, isCreditCard } from '../models/account.model';
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

/* Issue #196 (amended ADR 0022): what a Language change does to the
   Payment Categories. Every card's stored Payment Category is renamed to the
   card's payment name in the new Language, unless another category would
   still hold that name once every rename is applied: that card keeps its
   current name, and the caller names it in a notice. Kept cards are settled
   first, since a category that keeps its name can block another card. */
export interface KeptPaymentCategory {
  cardName: string;
  takenName: string;
}

export interface PaymentCategoryRenames {
  renamed: { id: number; name: string }[];
  kept: KeptPaymentCategory[];
}

export function paymentCategoryRenames(
  accounts: readonly Account[],
  categories: readonly Category[],
  language: Language,
): PaymentCategoryRenames {
  const candidates = accounts.flatMap(card => {
    const own = isCreditCard(card) ? storedPaymentCategory(card, categories) : undefined;
    if (!own) return [];
    const name = paymentCategoryName(card.name, language);
    return own.name !== name ? [{ card, id: own.id!, name }] : [];
  });
  const kept = new Set<number>();
  let settled = false;
  while (!settled) {
    settled = true;
    const finalNames = new Map(categories.map(c => [c.id!, c.name]));
    for (const candidate of candidates) {
      if (!kept.has(candidate.id)) finalNames.set(candidate.id, candidate.name);
    }
    for (const candidate of candidates) {
      if (kept.has(candidate.id)) continue;
      const taken = [...finalNames].some(
        ([id, name]) => id !== candidate.id && namesMatch(name, candidate.name),
      );
      if (taken) {
        kept.add(candidate.id);
        settled = false;
      }
    }
  }
  return {
    renamed: candidates.filter(c => !kept.has(c.id)).map(({ id, name }) => ({ id, name })),
    kept: candidates
      .filter(c => kept.has(c.id))
      .map(({ card, name }) => ({ cardName: card.name, takenName: name })),
  };
}
