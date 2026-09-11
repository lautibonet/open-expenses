/* ADR 0022: an Account is either a Cash Account (holds money) or a Credit
   Card (owes money). A Credit Card additionally carries a Linked Account, an
   optional Limit, and an initial balance that is its starting debt. */
export type AccountKind = 'cash' | 'credit-card';

export interface Account {
  id?: number;
  name: string;
  currency: string;
  initialBalance: number;
  active: boolean;
  kind: AccountKind;
  /* Required on a Credit Card: the Cash Account it is linked to. */
  linkedAccountId?: number;
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
