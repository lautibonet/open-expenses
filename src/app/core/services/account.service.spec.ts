import { TestBed } from '@angular/core/testing';
import { AccountService } from './account.service';
import { db } from '../db/database';
import { TranslationError } from '../models/translation-error';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AccountService);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should create an account', async () => {
    const account = await service.create('Cash', 'EUR', 10000);
    expect(account.id).toBeDefined();
    expect(account.name).toBe('Cash');
    expect(account.currency).toBe('EUR');
    expect(account.initialBalance).toBe(10000);
    expect(account.active).toBe(true);
  });

  it('should trim and uppercase currency', async () => {
    const account = await service.create('  savings  ', 'eur', 5000);
    expect(account.name).toBe('savings');
    expect(account.currency).toBe('EUR');
  });

  it('should reject empty name', async () => {
    await expect(service.create('', 'EUR', 0))
      .rejects.toThrow('errors.accountNameRequired');
  });

  it('should reject whitespace-only name', async () => {
    await expect(service.create('   ', 'EUR', 0))
      .rejects.toThrow('errors.accountNameRequired');
  });

  it('should reject negative initial balance', async () => {
    await expect(service.create('Cash', 'EUR', -100))
      .rejects.toThrow('errors.initialBalanceNegative');
  });

  it('should reject duplicate account names with the offending name', async () => {
    await service.create('Cash', 'EUR', 0);
    await expect(service.create('Cash', 'USD', 0))
      .rejects.toMatchObject({
        key: 'errors.accountNameTaken',
        params: { name: 'Cash' },
      });
    await expect(service.create('Cash', 'USD', 0)).rejects.toBeInstanceOf(TranslationError);
  });

  it('should allow zero initial balance', async () => {
    const account = await service.create('Empty', 'EUR', 0);
    expect(account.initialBalance).toBe(0);
  });

  it('should update account name', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    const updated = await service.update(account.id!, { name: 'Wallet' });
    expect(updated.name).toBe('Wallet');
  });

  it('should update initial balance', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    const updated = await service.update(account.id!, { initialBalance: 5000 });
    expect(updated.initialBalance).toBe(5000);
  });

  it('should reject duplicate name on update', async () => {
    await service.create('Cash', 'EUR', 0);
    const savings = await service.create('Savings', 'EUR', 0);
    await expect(service.update(savings.id!, { name: 'Cash' }))
      .rejects.toMatchObject({
        key: 'errors.accountNameTaken',
        params: { name: 'Cash' },
      });
  });

  it('should allow keeping same name on update', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    const updated = await service.update(account.id!, { name: 'Cash' });
    expect(updated.name).toBe('Cash');
  });

  it('should deactivate an account', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    await service.setActive(account.id!, false);
    const updated = await service.getById(account.id!);
    expect(updated!.active).toBe(false);
  });

  it('should reactivate an account', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    await service.setActive(account.id!, false);
    await service.setActive(account.id!, true);
    const updated = await service.getById(account.id!);
    expect(updated!.active).toBe(true);
  });

  it('should get all accounts', async () => {
    await service.create('Cash', 'EUR', 0);
    await service.create('Savings', 'USD', 1000);
    const all = await service.getAll();
    expect(all.length).toBe(2);
  });

  it('should get active accounts', async () => {
    const cash = await service.create('Cash', 'EUR', 0);
    await service.create('Savings', 'USD', 1000);
    await service.setActive(cash.id!, false);
    const active = await service.getActive();
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('Savings');
  });
});

describe('AccountService - delete-if-unused (ADR 0018)', () => {
  let service: AccountService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AccountService);
  });

  afterEach(async () => {
    await db.delete();
  });

  function seedTransaction(accountId: number, categoryId: number): Promise<number> {
    return db.transactions.add({
      accountId,
      categoryId,
      amount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
      createdAt: new Date(),
    });
  }

  function seedTransfer(sourceAccountId: number, destinationAccountId: number): Promise<number> {
    return db.transfers.add({
      sourceAccountId,
      destinationAccountId,
      sourceAmount: 1000,
      destinationAmount: 1000,
      exchangeRate: 1,
      baseCurrencyAmount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      note: '',
      createdAt: new Date(),
    });
  }

  it('reports an unused account as having no movements', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    expect(await service.hasMovements(account.id!)).toBe(false);
  });

  it('reports an account with a transaction as having movements', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    const category = await db.categories.add({
      name: 'Food',
      type: 'expense',
      active: true,
      createdAt: new Date(),
    });
    await seedTransaction(account.id!, category);
    expect(await service.hasMovements(account.id!)).toBe(true);
  });

  it('reports an account referenced as transfer source as having movements', async () => {
    const source = await service.create('Cash', 'EUR', 0);
    const destination = await service.create('Bank', 'EUR', 0);
    await seedTransfer(source.id!, destination.id!);
    expect(await service.hasMovements(source.id!)).toBe(true);
  });

  it('reports an account referenced as transfer destination as having movements', async () => {
    const source = await service.create('Cash', 'EUR', 0);
    const destination = await service.create('Bank', 'EUR', 0);
    await seedTransfer(source.id!, destination.id!);
    expect(await service.hasMovements(destination.id!)).toBe(true);
  });

  it('permanently deletes an unused account', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    await service.delete(account.id!);
    expect(await service.getById(account.id!)).toBeUndefined();
    expect((await service.getAll()).length).toBe(0);
  });

  it('allows deleting the last remaining account', async () => {
    const only = await service.create('Cash', 'EUR', 0);
    await service.delete(only.id!);
    expect((await service.getAll()).length).toBe(0);
  });

  it('keeps a deleted account gone after reopening the database', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    await service.delete(account.id!);

    db.close();
    await db.open();

    expect(await service.getById(account.id!)).toBeUndefined();
    expect((await service.getAll()).length).toBe(0);
  });

  it('refuses to delete an account referenced by a transaction, leaving it intact', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    const category = await db.categories.add({
      name: 'Food',
      type: 'expense',
      active: true,
      createdAt: new Date(),
    });
    const transactionId = await seedTransaction(account.id!, category);

    await expect(service.delete(account.id!)).rejects.toMatchObject({
      key: 'errors.accountHasMovements',
    });

    expect(await service.getById(account.id!)).toBeDefined();
    expect(await db.transactions.get(transactionId)).toBeDefined();
  });

  it('refuses to delete an account referenced by a transfer, leaving it intact', async () => {
    const source = await service.create('Cash', 'EUR', 0);
    const destination = await service.create('Bank', 'EUR', 0);
    const transferId = await seedTransfer(source.id!, destination.id!);

    await expect(service.delete(source.id!)).rejects.toBeInstanceOf(TranslationError);

    expect(await service.getById(source.id!)).toBeDefined();
    expect(await db.transfers.get(transferId)).toBeDefined();
  });

  it('throws accountNotFound when deleting a missing account', async () => {
    await expect(service.delete(999)).rejects.toThrow('errors.accountNotFound');
  });
});
