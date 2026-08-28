import { TestBed } from '@angular/core/testing';
import { TransferService } from './transfer.service';
import { AccountService } from './account.service';
import { db } from '../db/database';
import { getCurrentYear } from '../types/period.type';

describe('TransferService', () => {
  let transferService: TransferService;
  let accountService: AccountService;
  let cashId: number;
  let savingsId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    transferService = TestBed.inject(TransferService);
    accountService = TestBed.inject(AccountService);

    const cash = await accountService.create('Cash', 'EUR', 100000);
    cashId = cash.id!;
    const savings = await accountService.create('Savings', 'EUR', 500000);
    savingsId = savings.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should create a transfer', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 'January');
    expect(t.id).toBeDefined();
    expect(t.sourceAccountId).toBe(cashId);
    expect(t.destinationAccountId).toBe(savingsId);
    expect(t.sourceAmount).toBe(50000);
    expect(t.destinationAmount).toBe(50000);
    expect(t.exchangeRate).toBe(1);
    expect(t.baseCurrencyAmount).toBe(50000);
  });

  it('should create transfer with note', async () => {
    const t = await transferService.create(
      cashId, savingsId, 50000, new Date(), 'January', 'Monthly savings',
    );
    expect(t.note).toBe('Monthly savings');
  });

  it('should reject self-transfer', async () => {
    await expect(
      transferService.create(cashId, cashId, 50000, new Date(), 'January'),
    ).rejects.toThrow('Source and destination accounts must be different');
  });

  it('should reject zero amount', async () => {
    await expect(
      transferService.create(cashId, savingsId, 0, new Date(), 'January'),
    ).rejects.toThrow('Amount must be positive');
  });

  it('should reject negative amount', async () => {
    await expect(
      transferService.create(cashId, savingsId, -100, new Date(), 'January'),
    ).rejects.toThrow('Amount must be positive');
  });

  it('should reject missing period', async () => {
    await expect(
      transferService.create(cashId, savingsId, 100, new Date(), ''),
    ).rejects.toThrow('Period is required');
  });

  it('should reject invalid source account', async () => {
    await expect(
      transferService.create(999, savingsId, 100, new Date(), 'January'),
    ).rejects.toThrow('Source account not found');
  });

  it('should reject invalid destination account', async () => {
    await expect(
      transferService.create(cashId, 999, 100, new Date(), 'January'),
    ).rejects.toThrow('Destination account not found');
  });

  it('should update a transfer', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 'January');
    const updated = await transferService.update(t.id!, { sourceAmount: 60000, destinationAmount: 60000, note: 'Updated' });
    expect(updated.sourceAmount).toBe(60000);
    expect(updated.destinationAmount).toBe(60000);
    expect(updated.note).toBe('Updated');
  });

  it('should create a cross-currency transfer with explicit rate', async () => {
    const usd = await accountService.create('USD Account', 'USD', 100000);
    const t = await transferService.create(
      cashId, usd.id!, 1000, new Date('2026-01-15'), 'January', '', 1.08,
    );
    expect(t.sourceAmount).toBe(1000);
    expect(t.destinationAmount).toBe(1080);
    expect(t.exchangeRate).toBe(1.08);
    expect(t.baseCurrencyAmount).toBe(1080);
  });

  it('should update a cross-currency transfer and recalculate amounts', async () => {
    const usd = await accountService.create('USD Account', 'USD', 100000);
    const t = await transferService.create(
      cashId, usd.id!, 1000, new Date('2026-01-15'), 'January', '', 1.08,
    );
    const updated = await transferService.update(t.id!, { sourceAmount: 2000, exchangeRate: 1.1 });
    expect(updated.sourceAmount).toBe(2000);
    expect(updated.destinationAmount).toBe(2200);
    expect(updated.exchangeRate).toBe(1.1);
    expect(updated.baseCurrencyAmount).toBe(2200);
  });

  it('should reject self-transfer on update (both fields)', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 'January');
    await expect(
      transferService.update(t.id!, { sourceAccountId: savingsId, destinationAccountId: savingsId }),
    ).rejects.toThrow('Source and destination accounts must be different');
  });

  it('should reject self-transfer on update (single field change)', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 'January');
    await expect(
      transferService.update(t.id!, { sourceAccountId: savingsId }),
    ).rejects.toThrow('Source and destination accounts must be different');
  });

  it('should delete a transfer', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 'January');
    await transferService.delete(t.id!);
    const found = await transferService.getById(t.id!);
    expect(found).toBeUndefined();
  });

  it('should get transfers by period', async () => {
    await transferService.create(cashId, savingsId, 100, new Date(), 'January');
    await transferService.create(cashId, savingsId, 200, new Date(), 'February');
    const jan = await transferService.getByPeriod('January');
    expect(jan.length).toBe(1);
  });

  it('should default the period year to the current year', async () => {
    const t = await transferService.create(cashId, savingsId, 100, new Date('2025-12-22'), 'January');
    expect(t.year).toBe(getCurrentYear());
  });

  it('should store an explicit period year different from the date year', async () => {
    const t = await transferService.create(
      cashId, savingsId, 100, new Date('2025-12-22'), 'January', '', 1, 2026,
    );
    expect(t.date.getFullYear()).toBe(2025);
    expect(t.year).toBe(2026);
  });

  it('should filter transfers by period and year', async () => {
    await transferService.create(cashId, savingsId, 100, new Date('2025-12-22'), 'January', '', 1, 2026);
    await transferService.create(cashId, savingsId, 200, new Date('2024-12-22'), 'January', '', 1, 2025);
    await transferService.create(cashId, savingsId, 300, new Date('2026-02-10'), 'February', '', 1, 2026);

    const jan26 = await transferService.getByPeriod('January', 2026);
    expect(jan26.length).toBe(1);
    expect(jan26[0].sourceAmount).toBe(100);

    const janAll = await transferService.getByPeriod('January');
    expect(janAll.length).toBe(2);
  });

  it('should get transfers for a month scope by period and year', async () => {
    await transferService.create(cashId, savingsId, 100, new Date('2025-12-22'), 'January', '', 1, 2026);
    await transferService.create(cashId, savingsId, 200, new Date('2026-02-10'), 'February', '', 1, 2026);

    const jan26 = await transferService.getByScope({ kind: 'month', period: 'January', year: 2026 });
    expect(jan26.length).toBe(1);
    expect(jan26[0].sourceAmount).toBe(100);
  });

  it('should get all transfers for the all-time scope', async () => {
    await transferService.create(cashId, savingsId, 100, new Date('2010-05-01'), 'May', '', 1, 2010);
    await transferService.create(cashId, savingsId, 200, new Date('2026-06-01'), 'June', '', 1, 2026);

    const all = await transferService.getByScope({ kind: 'all-time' });
    expect(all.length).toBe(2);
  });

  it('should update the period year', async () => {
    const t = await transferService.create(cashId, savingsId, 100, new Date('2025-12-22'), 'January');
    const updated = await transferService.update(t.id!, { year: 2025 });
    expect(updated.year).toBe(2025);
  });

  it('should reject an invalid period year on create', async () => {
    await expect(
      transferService.create(cashId, savingsId, 100, new Date(), 'January', '', 1, 22),
    ).rejects.toThrow('Year must be a valid 4-digit year');
  });

  it('should reject an invalid period year on update', async () => {
    const t = await transferService.create(cashId, savingsId, 100, new Date(), 'January');
    await expect(
      transferService.update(t.id!, { year: 22 }),
    ).rejects.toThrow('Year must be a valid 4-digit year');
  });
});
