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

describe('AccountService - credit cards (ADR 0022)', () => {
  let service: AccountService;
  let cashId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AccountService);
    const cash = await service.create('Cash', 'eur', 10000);
    cashId = cash.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates a card as an account of kind credit-card linked to a cash account', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    expect(card.id).toBeDefined();
    expect(card.kind).toBe('credit-card');
    expect(card.linkedAccountId).toBe(cashId);
    expect(card.currency).toBe('EUR');
    expect(card.initialBalance).toBe(0);
    expect(card.active).toBe(true);
  });

  it('seeds the card currency from the linked account and keeps it after edits', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    const other = await service.create('Savings', 'usd', 0);
    const updated = await service.update(card.id!, { linkedAccountId: other.id! });
    expect(updated.currency).toBe('EUR');
    expect(updated.linkedAccountId).toBe(other.id);
  });

  it('keeps an explicit cash account created with kind cash', async () => {
    const cash = await service.getById(cashId);
    expect(cash!.kind).toBe('cash');
  });

  it('allows a negative initial balance as the starting debt', async () => {
    const card = await service.createCard({
      name: 'Visa',
      linkedAccountId: cashId,
      initialBalance: -50000,
    });
    expect(card.initialBalance).toBe(-50000);
  });

  it('stores an optional limit', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId, limit: 100000 });
    expect(card.limit).toBe(100000);
  });

  it('rejects a blank card name', async () => {
    await expect(service.createCard({ name: '  ', linkedAccountId: cashId }))
      .rejects.toThrow('errors.accountNameRequired');
  });

  it('rejects a duplicate card name', async () => {
    await expect(service.createCard({ name: 'Cash', linkedAccountId: cashId }))
      .rejects.toMatchObject({
        key: 'errors.accountNameTaken',
        params: { name: 'Cash' },
      });
  });

  it('rejects a missing linked account', async () => {
    await expect(service.createCard({ name: 'Visa', linkedAccountId: 0 }))
      .rejects.toThrow('errors.linkedAccountMustBeCash');
  });

  it('rejects a linked account that is itself a card', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    await expect(service.createCard({ name: 'Mastercard', linkedAccountId: card.id! }))
      .rejects.toThrow('errors.linkedAccountMustBeCash');
  });

  it('rejects a negative limit', async () => {
    await expect(service.createCard({ name: 'Visa', linkedAccountId: cashId, limit: -1 }))
      .rejects.toThrow('errors.cardLimitNegative');
  });

  it('creates the payment category with consent and links it to the card', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId }, 'Visa payment');
    const categories = await db.categories.toArray();
    const payment = categories.find((c) => c.name === 'Visa payment')!;
    expect(payment.type).toBe('expense');
    expect(card.paymentCategoryId).toBe(payment.id);
  });

  it('creates nothing when consent is declined', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId }, null);
    expect(await db.categories.count()).toBe(0);
    expect(card.paymentCategoryId).toBeUndefined();
  });

  it('rolls the card back when its payment category already exists', async () => {
    await db.categories.add({
      name: 'Visa payment',
      type: 'expense',
      active: true,
      createdAt: new Date(),
    });
    await expect(
      service.createCard({ name: 'Visa', linkedAccountId: cashId }, 'Visa payment'),
    ).rejects.toThrow('errors.categoryNameTaken');
    expect(await db.accounts.where('kind').equals('credit-card').count()).toBe(0);
  });

  it('edits a card name, starting debt, limit and linked account', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    const other = await service.create('Savings', 'EUR', 0);

    const updated = await service.update(card.id!, {
      name: 'Mastercard',
      initialBalance: -12300,
      limit: 250000,
      linkedAccountId: other.id!,
    });

    expect(updated.name).toBe('Mastercard');
    expect(updated.initialBalance).toBe(-12300);
    expect(updated.limit).toBe(250000);
    expect(updated.linkedAccountId).toBe(other.id);
  });

  it('clears the limit when edited to null', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId, limit: 5000 });
    const updated = await service.update(card.id!, { limit: null });
    expect(updated.limit).toBeUndefined();
  });

  it('still refuses a negative initial balance on a cash account', async () => {
    await expect(service.update(cashId, { initialBalance: -1 }))
      .rejects.toThrow('errors.initialBalanceNegative');
  });

  it('lists cards and cash accounts separately', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    const cash = await service.getCashAccounts();
    const cards = await service.getCards();
    expect(cash.map((a) => a.id)).toEqual([cashId]);
    expect(cards.map((a) => a.id)).toEqual([card.id]);
  });

  it('offers cards and cash accounts to the active capture picker', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    const active = await service.getActive();
    expect(active.map((a) => a.id)).toEqual([cashId, card.id]);
  });



  it('reports the linked account as referenced by a card', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    expect(await service.hasCardReference(cashId)).toBe(true);
    expect(await service.hasCardReference(card.id!)).toBe(false);
  });

  it('refuses to delete a linked account and offers the refusal reason', async () => {
    await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    expect(await service.getDeleteRefusal(cashId)).toBe('linked-card');
    await expect(service.delete(cashId)).rejects.toThrow('errors.accountLinkedToCard');
    expect(await service.getById(cashId)).toBeDefined();
  });

  it('deletes an unused card', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    await service.delete(card.id!);
    expect(await service.getById(card.id!)).toBeUndefined();
  });

  it('refuses to delete a card that has movements', async () => {
    const card = await service.createCard({ name: 'Visa', linkedAccountId: cashId });
    const category = await db.categories.add({
      name: 'Food',
      type: 'expense',
      active: true,
      createdAt: new Date(),
    });
    await db.transactions.add({
      accountId: card.id!,
      categoryId: category,
      amount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
      createdAt: new Date(),
    });

    expect(await service.getDeleteRefusal(card.id!)).toBe('movements');
    await expect(service.delete(card.id!)).rejects.toThrow('errors.accountHasMovements');
  });
});
