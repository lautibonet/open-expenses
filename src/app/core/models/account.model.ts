/* ADR 0022: an Account is either a Cash Account (holds money) or a Credit
   Card (owes money). A Credit Card additionally carries an optional Limit and
   an initial balance that is its starting debt. */
export type AccountKind = 'cash' | 'credit-card';

export interface Account {
  id?: number;
  name: string;
  currency: string;
  initialBalance: number;
  active: boolean;
  kind: AccountKind;
  /* Optional ceiling on a Credit Card's debt. Never blocks. */
  limit?: number;
  /* The Expense category the card's Card Payments are captured under — the
     "Visa payment" category created with the card (ADR 0022). Locale-neutral:
     the link survives renaming or a Language change. */
  paymentCategoryId?: number;
  createdAt: Date;
}

/* Accounts persisted before the kind field existed are Cash Accounts. */
export function isCashAccount(account: Pick<Account, 'kind'>): boolean {
  return account.kind !== 'credit-card';
}

export function isCreditCard(account: Pick<Account, 'kind'>): boolean {
  return account.kind === 'credit-card';
}

/* ADR 0022 / #174: the set of categories that are a Credit Card's Payment
   Category, derived in one place from the cards' locale-neutral links — never
   stored or duplicated elsewhere. Stats excludes them from the spending graph
   (category-spending.ts); the ordinary pickers (transaction form, movements
   filter, onboarding) exclude them the same way, while Settings keeps them. */
export function paymentCategoryIds(accounts: Account[]): Set<number> {
  const ids = new Set<number>();
  for (const account of accounts) {
    if (isCreditCard(account) && account.paymentCategoryId != null) {
      ids.add(account.paymentCategoryId);
    }
  }
  return ids;
}
