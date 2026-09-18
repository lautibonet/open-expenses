import { TestBed } from '@angular/core/testing';
import { AccountService } from './account.service';
import { LanguageService } from './language.service';
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

  it('creates a card as an account of kind credit-card with an explicit currency', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'eur' });
    expect(card.id).toBeDefined();
    expect(card.kind).toBe('credit-card');
    expect(card.currency).toBe('EUR');
    expect(card.initialBalance).toBe(0);
    expect(card.active).toBe(true);
  });

  it('keeps an explicit cash account created with kind cash', async () => {
    const cash = await service.getById(cashId);
    expect(cash!.kind).toBe('cash');
  });

  it('allows a negative initial balance as the starting debt', async () => {
    const card = await service.createCard({
      name: 'Visa',
      currency: 'EUR',
      initialBalance: -50000,
    });
    expect(card.initialBalance).toBe(-50000);
  });

  it('stores an optional limit', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR', limit: 100000 });
    expect(card.limit).toBe(100000);
  });

  it('rejects a blank card name', async () => {
    await expect(service.createCard({ name: '  ', currency: 'EUR' }))
      .rejects.toThrow('errors.accountNameRequired');
  });

  it('rejects a missing currency', async () => {
    await expect(service.createCard({ name: 'Visa', currency: '  ' }))
      .rejects.toThrow('errors.currencyRequired');
  });

  it('rejects a duplicate card name', async () => {
    await expect(service.createCard({ name: 'Cash', currency: 'EUR' }))
      .rejects.toMatchObject({
        key: 'errors.accountNameTaken',
        params: { name: 'Cash' },
      });
  });

  it('rejects a negative limit', async () => {
    await expect(service.createCard({ name: 'Visa', currency: 'EUR', limit: -1 }))
      .rejects.toThrow('errors.cardLimitNegative');
  });

  it('always creates a payment category and links it to the card', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    const categories = await db.categories.toArray();
    const payment = categories.find((c) => c.name === 'Visa payment')!;
    expect(payment.type).toBe('expense');
    expect(card.paymentCategoryId).toBe(payment.id);
  });

  it('names the payment category in the active language', async () => {
    await TestBed.inject(LanguageService).setLanguage('es');
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    const payment = (await db.categories.get(card.paymentCategoryId!))!;
    expect(payment.name).toBe('Pago Visa');
  });

  it('links the pre-existing category when the payment name is taken', async () => {
    const existingId = await db.categories.add({
      name: 'Visa payment',
      type: 'expense',
      active: true,
      createdAt: new Date(),
    });
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    expect(card.paymentCategoryId).toBe(existingId);
    expect(await db.categories.count()).toBe(1);
    expect(await db.accounts.where('kind').equals('credit-card').count()).toBe(1);
  });

  it('renames the payment category when the card is renamed', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    await service.update(card.id!, { name: 'Amex' });
    const category = await db.categories.get(card.paymentCategoryId!);
    expect(category!.name).toBe('Amex payment');
  });

  it('fails the card rename when the new payment name is taken, leaving both untouched', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    await db.categories.add({
      name: 'Amex payment',
      type: 'expense',
      active: true,
      createdAt: new Date(),
    });

    await expect(service.update(card.id!, { name: 'Amex' })).rejects.toMatchObject({
      key: 'errors.categoryNameTaken',
      params: { name: 'Amex payment' },
    });

    expect((await service.getById(card.id!))!.name).toBe('Visa');
    expect((await db.categories.get(card.paymentCategoryId!))!.name).toBe('Visa payment');
  });

  it('edits a card name, starting debt, limit and currency while it has no movements', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });

    const updated = await service.update(card.id!, {
      name: 'Mastercard',
      currency: 'USD',
      initialBalance: -12300,
      limit: 250000,
    });

    expect(updated.name).toBe('Mastercard');
    expect(updated.currency).toBe('USD');
    expect(updated.initialBalance).toBe(-12300);
    expect(updated.limit).toBe(250000);
  });

  it('clears the limit when edited to null', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR', limit: 5000 });
    const updated = await service.update(card.id!, { limit: null });
    expect(updated.limit).toBeUndefined();
  });

  it('still refuses a negative initial balance on a cash account', async () => {
    await expect(service.update(cashId, { initialBalance: -1 }))
      .rejects.toThrow('errors.initialBalanceNegative');
  });

  it('lets an unused cash account change its currency', async () => {
    const updated = await service.update(cashId, { currency: 'usd' });
    expect(updated.currency).toBe('USD');
  });

  it('refuses to change the currency of an account with movements', async () => {
    const category = await db.categories.add({
      name: 'Food',
      type: 'expense',
      active: true,
      createdAt: new Date(),
    });
    await db.transactions.add({
      accountId: cashId,
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
    await expect(service.update(cashId, { currency: 'USD' }))
      .rejects.toThrow('errors.currencyHasMovements');
    expect((await service.getById(cashId))!.currency).toBe('EUR');
  });

  it('lists cards and cash accounts separately', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    const cash = await service.getCashAccounts();
    const cards = await service.getCards();
    expect(cash.map((a) => a.id)).toEqual([cashId]);
    expect(cards.map((a) => a.id)).toEqual([card.id]);
  });

  it('offers cards and cash accounts to the active capture picker', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    const active = await service.getActive();
    expect(active.map((a) => a.id)).toEqual([cashId, card.id]);
  });



  it('deletes an unused card', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    await service.delete(card.id!);
    expect(await service.getById(card.id!)).toBeUndefined();
  });

  it('refuses to delete a card that has movements', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
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

/* Issue #175: deleting a card also removes its paired payment category in
   the same transaction — but only when the category itself has no
   transactions (deactivated categories included). A category with
   transactions survives, and the caller explains why with a page-level
   notice; a dangling link is a silent no-op. */
describe('AccountService - paired payment category deletion (ADR 0022, issue #175)', () => {
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

  function seedTransactionOn(categoryId: number): Promise<number> {
    /* A far-away accountId: only the categoryId index matters for the guard,
       and the transaction must not make the card itself look used. */
    return db.transactions.add({
      accountId: 9999,
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

  it('pre-checks "delete" when the linked category is unused', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    expect(await service.pairedCategoryDeletion(card.id!)).toBe('delete');
  });

  it('pre-checks "keep" when the linked category has transactions', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    await seedTransactionOn(card.paymentCategoryId!);
    expect(await service.pairedCategoryDeletion(card.id!)).toBe('keep');
  });

  it('pre-checks "keep" even when the linked category is deactivated', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    await seedTransactionOn(card.paymentCategoryId!);
    await db.categories.update(card.paymentCategoryId!, { active: false });
    expect(await service.pairedCategoryDeletion(card.id!)).toBe('keep');
  });

  it('pre-checks "absent" when the linked category no longer exists', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    await db.categories.delete(card.paymentCategoryId!);
    expect(await service.pairedCategoryDeletion(card.id!)).toBe('absent');
  });

  it('pre-checks "absent" for a cash account with no paired category', async () => {
    const cash = await service.create('Cash', 'EUR', 0);
    expect(await service.pairedCategoryDeletion(cash.id!)).toBe('absent');
  });

  it('removes an unused paired category together with the card, reporting "delete"', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    const categoryId = card.paymentCategoryId!;

    expect(await service.delete(card.id!)).toBe('delete');
    expect(await service.getById(card.id!)).toBeUndefined();
    expect(await db.categories.get(categoryId)).toBeUndefined();
  });

  it('removes a deactivated paired category that has no transactions', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    await db.categories.update(card.paymentCategoryId!, { active: false });
    const categoryId = card.paymentCategoryId!;

    expect(await service.delete(card.id!)).toBe('delete');
    expect(await db.categories.get(categoryId)).toBeUndefined();
  });

  it('keeps a paired category that has transactions, reporting "keep"', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    const categoryId = card.paymentCategoryId!;
    const transactionId = await seedTransactionOn(categoryId);

    expect(await service.delete(card.id!)).toBe('keep');
    expect(await service.getById(card.id!)).toBeUndefined();
    expect(await db.categories.get(categoryId)).toBeDefined();
    expect(await db.transactions.get(transactionId)).toBeDefined();
  });

  it('keeps a deactivated paired category that has transactions', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    const categoryId = card.paymentCategoryId!;
    await seedTransactionOn(categoryId);
    await db.categories.update(categoryId, { active: false });

    expect(await service.delete(card.id!)).toBe('keep');
    expect(await db.categories.get(categoryId)).toBeDefined();
  });

  it('treats a dangling link as a silent no-op, deleting only the card', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
    await db.categories.delete(card.paymentCategoryId!);

    expect(await service.delete(card.id!)).toBe('absent');
    expect(await service.getById(card.id!)).toBeUndefined();
  });

  it('still refuses to delete a card that has movements, leaving the category intact', async () => {
    const card = await service.createCard({ name: 'Visa', currency: 'EUR' });
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

    await expect(service.delete(card.id!)).rejects.toThrow('errors.accountHasMovements');
    expect(await service.getById(card.id!)).toBeDefined();
    expect(await db.categories.get(card.paymentCategoryId!)).toBeDefined();
  });
});
