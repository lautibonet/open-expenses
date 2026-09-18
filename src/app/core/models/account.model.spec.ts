import { describe, expect, it } from 'vitest';
import { Account, paymentCategoryIds } from './account.model';

function cash(id: number): Account {
  return { id, name: `Cash ${id}`, currency: 'EUR', initialBalance: 0, active: true, kind: 'cash', createdAt: new Date() };
}

function card(id: number, paymentCategoryId?: number): Account {
  const account: Account = {
    id,
    name: `Card ${id}`,
    currency: 'EUR',
    initialBalance: 0,
    active: true,
    kind: 'credit-card',
    createdAt: new Date(),
  };
  if (paymentCategoryId != null) {
    account.paymentCategoryId = paymentCategoryId;
  }
  return account;
}

describe('paymentCategoryIds', () => {
  it('collects the payment-category links of every Credit Card', () => {
    const accounts = [cash(1), card(2, 10), card(3, 11)];
    expect(paymentCategoryIds(accounts)).toEqual(new Set([10, 11]));
  });

  it('ignores Cash Accounts and cards without a link', () => {
    const accounts = [cash(1), card(2)];
    expect(paymentCategoryIds(accounts)).toEqual(new Set());
  });

  it('dedupes when two cards share one payment category', () => {
    const accounts = [card(1, 10), card(2, 10)];
    expect(paymentCategoryIds(accounts)).toEqual(new Set([10]));
  });
});
