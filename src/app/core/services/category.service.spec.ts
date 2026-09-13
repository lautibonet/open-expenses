import { TestBed } from '@angular/core/testing';
import { CategoryService } from './category.service';
import { db } from '../db/database';

describe('CategoryService', () => {
  let service: CategoryService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CategoryService);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should create a category', async () => {
    const category = await service.create('Food', 'expense');
    expect(category.id).toBeDefined();
    expect(category.name).toBe('Food');
    expect(category.type).toBe('expense');
    expect(category.active).toBe(true);
  });

  it('should create income category', async () => {
    const category = await service.create('Payroll', 'income');
    expect(category.type).toBe('income');
  });

  it('should trim category name', async () => {
    const category = await service.create('  Transport  ', 'expense');
    expect(category.name).toBe('Transport');
  });

  it('should reject empty name', async () => {
    await expect(service.create('', 'expense'))
      .rejects.toThrow('errors.categoryNameRequired');
  });

  it('should reject duplicate names with the offending name', async () => {
    await service.create('Food', 'expense');
    await expect(service.create('Food', 'income'))
      .rejects.toMatchObject({
        key: 'errors.categoryNameTaken',
        params: { name: 'Food' },
      });
  });

  it('should update category name', async () => {
    const category = await service.create('Food', 'expense');
    const updated = await service.update(category.id!, { name: 'Groceries' });
    expect(updated.name).toBe('Groceries');
  });

  it('should update category type', async () => {
    const category = await service.create('Misc', 'expense');
    const updated = await service.update(category.id!, { type: 'income' });
    expect(updated.type).toBe('income');
  });

  it('should reject an unknown category type on create', async () => {
    await expect(service.create('Food', 'checking' as never))
      .rejects.toThrow('errors.categoryTypeInvalid');
  });

  it('should reject an unknown category type on update', async () => {
    const category = await service.create('Food', 'expense');
    await expect(service.update(category.id!, { type: 'Checking' as never }))
      .rejects.toThrow('errors.categoryTypeInvalid');
    const reloaded = await service.getById(category.id!);
    expect(reloaded!.type).toBe('expense');
  });

  it('should reject duplicate name on update', async () => {
    await service.create('Food', 'expense');
    const transport = await service.create('Transport', 'expense');
    await expect(service.update(transport.id!, { name: 'Food' }))
      .rejects.toMatchObject({
        key: 'errors.categoryNameTaken',
        params: { name: 'Food' },
      });
  });

  it('should deactivate a category', async () => {
    const category = await service.create('Food', 'expense');
    await service.setActive(category.id!, false);
    const updated = await service.getById(category.id!);
    expect(updated!.active).toBe(false);
  });

  it('should reactivate a category', async () => {
    const category = await service.create('Food', 'expense');
    await service.setActive(category.id!, false);
    await service.setActive(category.id!, true);
    const updated = await service.getById(category.id!);
    expect(updated!.active).toBe(true);
  });

  it('should seed default categories in English by default', async () => {
    await service.seedDefaults();
    const all = await service.getAll();
    expect(all.length).toBe(9);
    expect(all.map(c => c.name)).toContain('Food');
    expect(all.map(c => c.name)).toContain('Payroll');
  });

  it('should seed default categories in Spanish', async () => {
    await service.seedDefaults('es');
    const all = await service.getAll();
    expect(all.length).toBe(9);
    expect(all.map(c => c.name)).toContain('Comida');
    expect(all.map(c => c.name)).toContain('Transporte');
    expect(all.map(c => c.name)).not.toContain('Food');
  });

  it('should not re-seed if categories exist', async () => {
    await service.create('Custom', 'expense');
    await service.seedDefaults();
    const all = await service.getAll();
    expect(all.length).toBe(1);
  });

  it('should get active categories', async () => {
    const food = await service.create('Food', 'expense');
    await service.create('Transport', 'expense');
    await service.setActive(food.id!, false);
    const active = await service.getActive();
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('Transport');
  });
});

describe('CategoryService - delete-if-unused (ADR 0018)', () => {
  let service: CategoryService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CategoryService);
  });

  afterEach(async () => {
    await db.delete();
  });

  async function seedTransaction(categoryId: number): Promise<number> {
    const accountId = await db.accounts.add({
      name: 'Cash',
      currency: 'EUR',
      initialBalance: 0,
      active: true,
      kind: 'cash',
      createdAt: new Date(),
    });
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

  it('reports an unused category as having no movements', async () => {
    const category = await service.create('Food', 'expense');
    expect(await service.hasMovements(category.id!)).toBe(false);
  });

  it('reports a category referenced by a transaction as having movements', async () => {
    const category = await service.create('Food', 'expense');
    await seedTransaction(category.id!);
    expect(await service.hasMovements(category.id!)).toBe(true);
  });

  it('permanently deletes an unused category', async () => {
    const category = await service.create('Food', 'expense');
    await service.delete(category.id!);
    expect(await service.getById(category.id!)).toBeUndefined();
    expect((await service.getAll()).length).toBe(0);
  });

  it('refuses to delete a category referenced by a transaction, leaving it intact', async () => {
    const category = await service.create('Food', 'expense');
    const transactionId = await seedTransaction(category.id!);

    await expect(service.delete(category.id!)).rejects.toMatchObject({
      key: 'errors.categoryHasMovements',
    });

    expect(await service.getById(category.id!)).toBeDefined();
    expect(await db.transactions.get(transactionId)).toBeDefined();
  });

  it('throws categoryNotFound when deleting a missing category', async () => {
    await expect(service.delete(999)).rejects.toThrow('errors.categoryNotFound');
  });
});
