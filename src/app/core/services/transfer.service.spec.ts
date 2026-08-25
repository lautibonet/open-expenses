import { TestBed } from '@angular/core/testing';
import { TransferService } from './transfer.service';
import { AccountService } from './account.service';
import { db } from '../db/database';

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
    expect(t.amount).toBe(50000);
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
    const updated = await transferService.update(t.id!, { amount: 60000, note: 'Updated' });
    expect(updated.amount).toBe(60000);
    expect(updated.note).toBe('Updated');
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
});
