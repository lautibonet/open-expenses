import { describe, expect, it } from 'vitest';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import { paymentCategoryName, resolvePaymentCategory } from './payment-category-rules';

function card(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'Visa',
    currency: 'EUR',
    initialBalance: 0,
    active: true,
    kind: 'credit-card',
    createdAt: new Date(2026, 0, 1),
    ...overrides,
  };
}

function category(id: number, name: string, type: Category['type'] = 'expense'): Category {
  return { id, name, type, active: true, createdAt: new Date(2026, 0, 1) };
}

describe('paymentCategoryName', () => {
  it('names the category after the card in English', () => {
    expect(paymentCategoryName('Visa', 'en')).toBe('Visa payment');
  });

  it('names the category after the card in Spanish', () => {
    expect(paymentCategoryName('Visa', 'es')).toBe('Pago Visa');
  });
});

describe('resolvePaymentCategory', () => {
  it('returns the linked category when the link points at an existing category', () => {
    const linked = category(7, 'Tarjeta de crédito');
    const resolution = resolvePaymentCategory(
      card({ paymentCategoryId: 7 }),
      [category(3, 'Visa payment'), linked],
      'en',
    );
    expect(resolution).toEqual({ kind: 'linked', category: linked });
  });

  it('matches an Expense category named after the card, ignoring letter case', () => {
    const named = category(3, 'visa PAYMENT');
    const resolution = resolvePaymentCategory(card(), [named], 'en');
    expect(resolution).toEqual({ kind: 'matched', category: named });
  });

  it('matches by name when the link is dangling', () => {
    const named = category(3, 'Visa payment');
    const resolution = resolvePaymentCategory(card({ paymentCategoryId: 99 }), [named], 'en');
    expect(resolution).toEqual({ kind: 'matched', category: named });
  });

  it('proposes a new category named in the given Language when none matches', () => {
    const resolution = resolvePaymentCategory(card(), [category(3, 'Food')], 'es');
    expect(resolution).toEqual({ kind: 'new', name: 'Pago Visa' });
  });

  it('reports the name as taken when an Income category holds it', () => {
    const income = category(4, 'Visa payment', 'income');
    const resolution = resolvePaymentCategory(card(), [income], 'en');
    expect(resolution).toEqual({ kind: 'taken', name: 'Visa payment' });
  });
});
