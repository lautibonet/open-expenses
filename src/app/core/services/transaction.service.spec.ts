import { TestBed } from '@angular/core/testing';
import { TransactionService } from './transaction.service';
import { AccountService } from './account.service';
import { CategoryService } from './category.service';
import { db } from '../db/database';

describe('TransactionService', () => {
  let transactionService: TransactionService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    transactionService = TestBed.inject(TransactionService);
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    const category = await categoryService.create('Food', 'Expense');
    categoryId = category.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should create a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
    );
    expect(t.id).toBeDefined();
    expect(t.amount).toBe(1500);
    expect(t.period).toBe('January');
    expect(t.tags).toEqual([]);
  });

  it('should create transaction with tags', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
      ['groceries', 'weekly'],
    );
    expect(t.tags).toEqual(['groceries', 'weekly']);
  });

  it('should normalize tags to lowercase and trimmed', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
      ['  Groceries  ', 'Weekly'],
    );
    expect(t.tags).toEqual(['groceries', 'weekly']);
  });

  it('should filter out empty tags', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
      ['groceries', '', '  ', 'weekly'],
    );
    expect(t.tags).toEqual(['groceries', 'weekly']);
  });

  it('should reject zero amount', async () => {
    await expect(
      transactionService.create(accountId, categoryId, 0, new Date(), 'January'),
    ).rejects.toThrow('Amount must be positive');
  });

  it('should reject negative amount', async () => {
    await expect(
      transactionService.create(accountId, categoryId, -100, new Date(), 'January'),
    ).rejects.toThrow('Amount must be positive');
  });

  it('should reject missing period', async () => {
    await expect(
      transactionService.create(accountId, categoryId, 100, new Date(), ''),
    ).rejects.toThrow('Period is required');
  });

  it('should reject invalid account', async () => {
    await expect(
      transactionService.create(999, categoryId, 100, new Date(), 'January'),
    ).rejects.toThrow('Account not found');
  });

  it('should reject invalid category', async () => {
    await expect(
      transactionService.create(accountId, 999, 100, new Date(), 'January'),
    ).rejects.toThrow('Category not found');
  });

  it('should update a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
    );
    const updated = await transactionService.update(t.id!, { amount: 2000, period: 'February' });
    expect(updated.amount).toBe(2000);
    expect(updated.period).toBe('February');
  });

  it('should reject invalid update amount', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
    );
    await expect(
      transactionService.update(t.id!, { amount: 0 }),
    ).rejects.toThrow('Amount must be positive');
  });

  it('should delete a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
    );
    await transactionService.delete(t.id!);
    const found = await transactionService.getById(t.id!);
    expect(found).toBeUndefined();
  });

  it('should get transactions by period', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January');
    await transactionService.create(accountId, categoryId, 200, new Date(), 'February');
    const jan = await transactionService.getByPeriod('January');
    expect(jan.length).toBe(1);
  });

  it('should collect all unique tags', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'January', ['food', 'monthly']);
    const tags = await transactionService.getAllTags();
    expect(tags).toEqual(['food', 'monthly', 'weekly']);
  });

  it('should rename a tag across all transactions', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'February', ['food', 'weekly']);
    await transactionService.renameTag('food', 'groceries');
    const tags = await transactionService.getAllTags();
    expect(tags).toEqual(['groceries', 'weekly']);
  });

  it('should return tag counts across transactions', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'February', ['food', 'monthly']);
    await transactionService.create(accountId, categoryId, 300, new Date(), 'March', ['weekly']);
    const counts = await transactionService.getTagCounts();
    expect(counts).toEqual([
      { tag: 'food', count: 2 },
      { tag: 'monthly', count: 1 },
      { tag: 'weekly', count: 2 },
    ]);
  });

  it('should return empty array when no tags exist', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January');
    const counts = await transactionService.getTagCounts();
    expect(counts).toEqual([]);
  });

  it('should delete a tag from all transactions', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'February', ['food', 'monthly']);
    await transactionService.deleteTag('food');
    const tags = await transactionService.getAllTags();
    expect(tags).toEqual(['monthly', 'weekly']);
  });

  it('should leave transactions with no other tags intact after tag deletion', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food']);
    await transactionService.deleteTag('food');
    const all = await transactionService.getAll();
    expect(all[0].tags).toEqual([]);
  });

  it('should throw when deleting empty tag name', async () => {
    await expect(transactionService.deleteTag('')).rejects.toThrow('Tag name cannot be empty');
  });

  it('should store exchange rate and base currency amount', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date(), 'January', [], 1.08, 1620,
    );
    expect(t.exchangeRate).toBe(1.08);
    expect(t.baseCurrencyAmount).toBe(1620);
  });
});
