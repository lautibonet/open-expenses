import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { Account } from '../models/account.model';
import { CategoryType } from '../models/category.model';
import {
  deleteCard,
  ensurePaymentCategory,
  planCardDeletion,
  renamePaymentCategory,
} from './payment-category';

async function addCategory(name: string, type: CategoryType = 'expense'): Promise<number> {
  return db.categories.add({ name, type, active: true, createdAt: new Date() });
}

async function addCard(name: string, paymentCategoryId?: number): Promise<Account> {
  const card: Account = {
    name,
    currency: 'EUR',
    initialBalance: 0,
    active: true,
    kind: 'credit-card',
    createdAt: new Date(),
    ...(paymentCategoryId !== undefined ? { paymentCategoryId } : {}),
  };
  const id = await db.accounts.add(card);
  return { ...card, id };
}

describe('Payment Category module', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('ensurePaymentCategory', () => {
    it('creates an Expense category named after a card that does not exist yet', async () => {
      const category = await ensurePaymentCategory({ name: 'Visa' }, 'es');
      expect(category).toMatchObject({ name: 'Pago Visa', type: 'expense' });
      expect(await db.categories.get(category.id!)).toMatchObject({ name: 'Pago Visa' });
    });

    it('links an Expense category that already holds the name instead of duplicating it', async () => {
      const existingId = await addCategory('visa payment');
      const category = await ensurePaymentCategory({ name: 'Visa' }, 'en');
      expect(category.id).toBe(existingId);
      expect(await db.categories.count()).toBe(1);
    });

    it('returns the linked category of a card', async () => {
      const linkedId = await addCategory('Tarjeta de crédito');
      const card = await addCard('Visa', linkedId);
      const category = await ensurePaymentCategory(card, 'en');
      expect(category.id).toBe(linkedId);
    });

    it('repairs a dangling link by writing the resolved category back to the card', async () => {
      const card = await addCard('Visa', 99);
      const category = await ensurePaymentCategory(card, 'en');
      expect(category.name).toBe('Visa payment');
      expect((await db.accounts.get(card.id!))?.paymentCategoryId).toBe(category.id);
    });

    it('re-links a card whose stored link points at an Income category', async () => {
      const card = await addCard('Visa', await addCategory('Bonus', 'income'));
      const category = await ensurePaymentCategory(card, 'en');
      expect(category).toMatchObject({ name: 'Visa payment', type: 'expense' });
      expect((await db.accounts.get(card.id!))?.paymentCategoryId).toBe(category.id);
    });

    it('refuses when an Income category holds the payment name', async () => {
      await addCategory('Visa payment', 'income');
      await expect(ensurePaymentCategory({ name: 'Visa' }, 'en')).rejects.toMatchObject({
        key: 'errors.categoryNameTaken',
        params: { name: 'Visa payment' },
      });
    });
  });

  describe('renamePaymentCategory', () => {
    it('renames the linked category after the new card name', async () => {
      const linkedId = await addCategory('Visa payment');
      const card = await addCard('Visa', linkedId);
      await renamePaymentCategory(card, 'Visa Gold', 'en');
      expect((await db.categories.get(linkedId))?.name).toBe('Visa Gold payment');
    });

    it('lets a card change only the letter case of its own payment name', async () => {
      const linkedId = await addCategory('Visa payment');
      const card = await addCard('Visa', linkedId);
      await renamePaymentCategory(card, 'VISA', 'en');
      expect((await db.categories.get(linkedId))?.name).toBe('VISA payment');
    });

    it('refuses when another category already holds the new payment name', async () => {
      const linkedId = await addCategory('Visa payment');
      await addCategory('amex PAYMENT');
      const card = await addCard('Visa', linkedId);
      await expect(renamePaymentCategory(card, 'Amex', 'en')).rejects.toMatchObject({
        key: 'errors.categoryNameTaken',
        params: { name: 'Amex payment' },
      });
      expect((await db.categories.get(linkedId))?.name).toBe('Visa payment');
    });

    it('refuses a dangling-link rename when an Expense category already holds the new name', async () => {
      const takenId = await addCategory('Amex payment');
      const card = await addCard('Visa', 99);
      await expect(renamePaymentCategory(card, 'Amex', 'en')).rejects.toMatchObject({
        key: 'errors.categoryNameTaken',
        params: { name: 'Amex payment' },
      });
      expect((await db.accounts.get(card.id!))?.paymentCategoryId).toBe(99);
      expect((await db.categories.get(takenId))?.name).toBe('Amex payment');
    });

    it('never renames a stored Income category, creating the payment category instead', async () => {
      const incomeId = await addCategory('Bonus', 'income');
      const card = await addCard('Visa', incomeId);
      await renamePaymentCategory(card, 'Visa Gold', 'en');
      expect((await db.categories.get(incomeId))?.name).toBe('Bonus');
      const linkedId = (await db.accounts.get(card.id!))?.paymentCategoryId;
      expect((await db.categories.get(linkedId!))?.name).toBe('Visa Gold payment');
    });

    it('repairs a dangling link under the new card name', async () => {
      const card = await addCard('Visa', 99);
      await renamePaymentCategory(card, 'Visa Gold', 'en');
      const linkedId = (await db.accounts.get(card.id!))?.paymentCategoryId;
      expect((await db.categories.get(linkedId!))?.name).toBe('Visa Gold payment');
    });
  });

  describe('card deletion', () => {
    async function addCash(): Promise<number> {
      return db.accounts.add({
        name: 'Bank',
        currency: 'EUR',
        initialBalance: 0,
        active: true,
        kind: 'cash',
        createdAt: new Date(),
      });
    }

    async function addTransaction(accountId: number, categoryId: number): Promise<void> {
      await db.transactions.add({
        accountId,
        categoryId,
        amount: 10,
        date: new Date(),
        period: 1,
        year: 2026,
        exchangeRate: null,
        baseCurrencyAmount: null,
        note: '',
        createdAt: new Date(),
      });
    }

    it('refuses a card that has a Transaction', async () => {
      const card = await addCard('Visa', await addCategory('Visa payment'));
      await addTransaction(card.id!, await addCategory('Food'));
      const expected = { kind: 'refused', reason: 'movements' };
      expect(await planCardDeletion(card.id!)).toEqual(expected);
      expect(await deleteCard(card.id!)).toEqual(expected);
      expect(await db.accounts.get(card.id!)).toBeDefined();
    });

    it('refuses a card that receives a Transfer', async () => {
      const card = await addCard('Visa', await addCategory('Visa payment'));
      await db.transfers.add({
        sourceAccountId: await addCash(),
        destinationAccountId: card.id!,
        sourceAmount: 10,
        destinationAmount: 10,
        exchangeRate: 1,
        baseCurrencyAmount: 10,
        date: new Date(),
        period: 1,
        year: 2026,
        note: '',
        createdAt: new Date(),
      });
      expect(await deleteCard(card.id!)).toEqual({ kind: 'refused', reason: 'movements' });
      expect(await db.accounts.get(card.id!)).toBeDefined();
    });

    it('deletes an unused paired category together with the card', async () => {
      const categoryId = await addCategory('Visa payment');
      const card = await addCard('Visa', categoryId);
      const expected = { kind: 'proceed', category: 'delete', categoryName: 'Visa payment' };
      expect(await planCardDeletion(card.id!)).toEqual(expected);
      expect(await deleteCard(card.id!)).toEqual(expected);
      expect(await db.accounts.get(card.id!)).toBeUndefined();
      expect(await db.categories.get(categoryId)).toBeUndefined();
    });

    it('keeps a paired category that has Transactions, even when deactivated', async () => {
      const categoryId = await addCategory('Visa payment');
      await db.categories.update(categoryId, { active: false });
      await addTransaction(await addCash(), categoryId);
      const card = await addCard('Visa', categoryId);
      const expected = { kind: 'proceed', category: 'keep', categoryName: 'Visa payment' };
      expect(await planCardDeletion(card.id!)).toEqual(expected);
      expect(await deleteCard(card.id!)).toEqual(expected);
      expect(await db.accounts.get(card.id!)).toBeUndefined();
      expect(await db.categories.get(categoryId)).toBeDefined();
    });

    it('deletes a card whose link is dangling, leaving every category alone', async () => {
      const otherId = await addCategory('Food');
      const card = await addCard('Visa', 99);
      const expected = { kind: 'proceed', category: 'absent' };
      expect(await planCardDeletion(card.id!)).toEqual(expected);
      expect(await deleteCard(card.id!)).toEqual(expected);
      expect(await db.accounts.get(card.id!)).toBeUndefined();
      expect(await db.categories.get(otherId)).toBeDefined();
    });

    it('deletes a card with no link at all', async () => {
      const card = await addCard('Visa');
      expect(await deleteCard(card.id!)).toEqual({ kind: 'proceed', category: 'absent' });
      expect(await db.accounts.get(card.id!)).toBeUndefined();
    });

    it('refuses to plan or delete a card that does not exist', async () => {
      await expect(planCardDeletion(42)).rejects.toMatchObject({ key: 'errors.accountNotFound' });
      await expect(deleteCard(42)).rejects.toMatchObject({ key: 'errors.accountNotFound' });
    });
  });
});
