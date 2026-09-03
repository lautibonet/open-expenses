import { TestBed } from '@angular/core/testing';
import { TransactionService } from './transaction.service';
import { AccountService } from './account.service';
import { CategoryService } from './category.service';
import { db } from '../db/database';
import { getCurrentYear } from '../types/period.type';

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
    const category = await categoryService.create('Food', 'expense');
    categoryId = category.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should create a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1,
    );
    expect(t.id).toBeDefined();
    expect(t.amount).toBe(1500);
    expect(t.period).toBe(1);
    expect('tags' in t).toBe(false);
  });

  it('should create transaction with note', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1, null, null,
      getCurrentYear(), 'Dinner with friends',
    );
    expect(t.note).toBe('Dinner with friends');
  });

  it('should default the note to empty string', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1,
    );
    expect(t.note).toBe('');
  });

  it('should update the note on a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1,
    );
    const updated = await transactionService.update(t.id!, { note: 'Updated note' });
    expect(updated.note).toBe('Updated note');
  });

  it('should reject zero amount', async () => {
    await expect(
      transactionService.create(accountId, categoryId, 0, new Date(), 1),
    ).rejects.toThrow('errors.amountPositive');
  });

  it('should reject negative amount', async () => {
    await expect(
      transactionService.create(accountId, categoryId, -100, new Date(), 1),
    ).rejects.toThrow('errors.amountPositive');
  });

  it('should reject an out-of-range period', async () => {
    await expect(
      transactionService.create(accountId, categoryId, 100, new Date(), 0),
    ).rejects.toThrow('errors.periodInvalid');
  });

  it('should reject a non-integer period', async () => {
    await expect(
      transactionService.create(accountId, categoryId, 100, new Date(), 1.5),
    ).rejects.toThrow('errors.periodInvalid');
  });

  it('should reject invalid account', async () => {
    await expect(
      transactionService.create(999, categoryId, 100, new Date(), 1),
    ).rejects.toThrow('errors.accountNotFound');
  });

  it('should reject invalid category', async () => {
    await expect(
      transactionService.create(accountId, 999, 100, new Date(), 1),
    ).rejects.toThrow('errors.categoryNotFound');
  });

  it('should update a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1,
    );
    const updated = await transactionService.update(t.id!, { amount: 2000, period: 2 });
    expect(updated.amount).toBe(2000);
    expect(updated.period).toBe(2);
  });

  it('should reject invalid update amount', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1,
    );
    await expect(
      transactionService.update(t.id!, { amount: 0 }),
    ).rejects.toThrow('errors.amountPositive');
  });

  it('should delete a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1,
    );
    await transactionService.delete(t.id!);
    const found = await transactionService.getById(t.id!);
    expect(found).toBeUndefined();
  });

  it('should restore a deleted transaction with its original id and fields', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1,
      1.08, 1620, getCurrentYear(), 'Dinner',
    );
    const snapshot = { ...t };
    await transactionService.delete(t.id!);
    expect(await transactionService.getById(t.id!)).toBeUndefined();

    await transactionService.restore(snapshot);

    const restored = await transactionService.getById(t.id!);
    expect(restored).toBeDefined();
    expect(restored!.id).toBe(t.id);
    expect(restored!.accountId).toBe(t.accountId);
    expect(restored!.categoryId).toBe(t.categoryId);
    expect(restored!.amount).toBe(t.amount);
    expect(restored!.period).toBe(t.period);
    expect(restored!.year).toBe(t.year);
    expect(restored!.exchangeRate).toBe(1.08);
    expect(restored!.baseCurrencyAmount).toBe(1620);
    expect(restored!.note).toBe('Dinner');
  });

  it('should reject restoring a transaction that still exists', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 1,
    );
    await expect(
      transactionService.restore(t),
    ).rejects.toThrow('errors.transactionExists');
  });

  it('should get transactions by period', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 1);
    await transactionService.create(accountId, categoryId, 200, new Date(), 2);
    const jan = await transactionService.getByPeriod(1);
    expect(jan.length).toBe(1);
  });

  it('should store exchange rate and base currency amount', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date(), 1, 1.08, 1620,
    );
    expect(t.exchangeRate).toBe(1.08);
    expect(t.baseCurrencyAmount).toBe(1620);
  });

  it('should default the period year to the current year', async () => {
    const t = await transactionService.create(accountId, categoryId, 100, new Date('2025-12-22'), 1);
    expect(t.year).toBe(getCurrentYear());
  });

  it('should store an explicit period year different from the date year', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 100, new Date('2025-12-22'), 1, null, null, 2026,
    );
    expect(t.date.getFullYear()).toBe(2025);
    expect(t.year).toBe(2026);
  });

  it('should filter transactions by period and year', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date('2025-12-22'), 1, null, null, 2026);
    await transactionService.create(accountId, categoryId, 200, new Date('2024-12-22'), 1, null, null, 2025);
    await transactionService.create(accountId, categoryId, 300, new Date('2026-02-10'), 2, null, null, 2026);

    const jan26 = await transactionService.getByPeriod(1, 2026);
    expect(jan26.length).toBe(1);
    expect(jan26[0].amount).toBe(100);

    const janAll = await transactionService.getByPeriod(1);
    expect(janAll.length).toBe(2);
  });

  it('should get transactions for a month scope by period and year', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date('2025-12-22'), 1, null, null, 2026);
    await transactionService.create(accountId, categoryId, 200, new Date('2026-02-10'), 2, null, null, 2026);

    const jan26 = await transactionService.getByScope({ kind: 'month', period: 1, year: 2026 });
    expect(jan26.length).toBe(1);
    expect(jan26[0].amount).toBe(100);
  });

  it('should update the period year', async () => {
    const t = await transactionService.create(accountId, categoryId, 100, new Date('2025-12-22'), 1);
    const updated = await transactionService.update(t.id!, { year: 2025 });
    expect(updated.year).toBe(2025);
  });

  it('should reject an invalid period year on create', async () => {
    await expect(
      transactionService.create(accountId, categoryId, 100, new Date(), 1, null, null, 22),
    ).rejects.toThrow('errors.yearInvalid');
  });

  it('should reject an invalid period year on update', async () => {
    const t = await transactionService.create(accountId, categoryId, 100, new Date(), 1);
    await expect(
      transactionService.update(t.id!, { year: 22 }),
    ).rejects.toThrow('errors.yearInvalid');
  });
});
