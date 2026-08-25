import { TestBed } from '@angular/core/testing';
import { AccountService } from './account.service';
import { db } from '../db/database';

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
      .rejects.toThrow('Account name is required');
  });

  it('should reject whitespace-only name', async () => {
    await expect(service.create('   ', 'EUR', 0))
      .rejects.toThrow('Account name is required');
  });

  it('should reject negative initial balance', async () => {
    await expect(service.create('Cash', 'EUR', -100))
      .rejects.toThrow('Initial balance cannot be negative');
  });

  it('should reject duplicate account names', async () => {
    await service.create('Cash', 'EUR', 0);
    await expect(service.create('Cash', 'USD', 0))
      .rejects.toThrow('Account name must be unique');
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
      .rejects.toThrow('Account name must be unique');
  });

  it('should allow keeping same name on update', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    const updated = await service.update(account.id!, { name: 'Cash' });
    expect(updated.name).toBe('Cash');
  });

  it('should deactivate an account', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    await service.deactivate(account.id!);
    const updated = await service.getById(account.id!);
    expect(updated!.active).toBe(false);
  });

  it('should reactivate an account', async () => {
    const account = await service.create('Cash', 'EUR', 0);
    await service.deactivate(account.id!);
    await service.reactivate(account.id!);
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
    await service.deactivate(cash.id!);
    const active = await service.getActive();
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('Savings');
  });
});
