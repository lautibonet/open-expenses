import { describe, expect, it } from 'vitest';
import { Account } from '../models/account.model';
import { Category } from '../models/category.model';
import {
  paymentCategoryName,
  paymentCategoryRenames,
  resolvePaymentCategory,
} from './payment-category-rules';

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
  it('returns the stored category when the link points at an existing Expense category', () => {
    const linked = category(7, 'Tarjeta de crédito');
    const resolution = resolvePaymentCategory(
      card({ paymentCategoryId: 7 }),
      [category(3, 'Visa payment'), linked],
      'en',
    );
    expect(resolution).toEqual({ kind: 'stored', category: linked });
  });

  it('does not trust a stored link to an Income category, resolving by name instead', () => {
    const income = category(7, 'Bonus', 'income');
    const named = category(3, 'Visa payment');
    const resolution = resolvePaymentCategory(card({ paymentCategoryId: 7 }), [income, named], 'en');
    expect(resolution).toEqual({ kind: 'linkable', category: named });
  });

  it('matches an Expense category named after the card, ignoring letter case', () => {
    const named = category(3, 'visa PAYMENT');
    const resolution = resolvePaymentCategory(card(), [named], 'en');
    expect(resolution).toEqual({ kind: 'linkable', category: named });
  });

  it('matches by name when the link is dangling', () => {
    const named = category(3, 'Visa payment');
    const resolution = resolvePaymentCategory(card({ paymentCategoryId: 99 }), [named], 'en');
    expect(resolution).toEqual({ kind: 'linkable', category: named });
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

describe('paymentCategoryRenames', () => {
  it('renames a linked Payment Category to the card payment name in the new Language', () => {
    const result = paymentCategoryRenames(
      [card({ paymentCategoryId: 3 })],
      [category(3, 'Visa payment'), category(4, 'Food')],
      'es',
    );
    expect(result).toEqual({ renamed: [{ id: 3, name: 'Pago Visa' }], kept: [] });
  });

  it('leaves a Payment Category already named in the new Language untouched', () => {
    const result = paymentCategoryRenames(
      [card({ paymentCategoryId: 3 })],
      [category(3, 'Pago Visa')],
      'es',
    );
    expect(result).toEqual({ renamed: [], kept: [] });
  });

  it('keeps the current name when another category holds the translated name, ignoring letter case', () => {
    const result = paymentCategoryRenames(
      [card({ paymentCategoryId: 3 })],
      [category(3, 'Visa payment'), category(4, 'pago visa', 'income')],
      'es',
    );
    expect(result).toEqual({ renamed: [], kept: [{ cardName: 'Visa', takenName: 'Pago Visa' }] });
  });

  it('checks collisions against the renamed names, so two cards may trade names', () => {
    const result = paymentCategoryRenames(
      [card({ id: 1, name: 'Visa', paymentCategoryId: 3 }), card({ id: 2, name: 'Amex', paymentCategoryId: 4 })],
      [category(3, 'Amex payment'), category(4, 'Visa payment')],
      'en',
    );
    expect(result).toEqual({
      renamed: [
        { id: 3, name: 'Visa payment' },
        { id: 4, name: 'Amex payment' },
      ],
      kept: [],
    });
  });

  it('keeps a card whose translated name stays held by a category that keeps its own name', () => {
    const result = paymentCategoryRenames(
      [card({ id: 1, name: 'Visa', paymentCategoryId: 3 }), card({ id: 2, name: 'Amex', paymentCategoryId: 4 })],
      [category(3, 'Pago Visa'), category(4, 'Visa payment'), category(5, 'Amex payment')],
      'en',
    );
    expect(result).toEqual({
      renamed: [],
      kept: [
        { cardName: 'Visa', takenName: 'Visa payment' },
        { cardName: 'Amex', takenName: 'Amex payment' },
      ],
    });
  });
});
