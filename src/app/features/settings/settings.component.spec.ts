import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { TransactionService } from '../../core/services/transaction.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { db } from '../../core/db/database';

describe('SettingsComponent - tags', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let transactionService: TransactionService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
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

  it('should load tag counts on init', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'January', ['food']);
    await component.ngOnInit();
    expect(component.tagCounts()).toEqual([
      { tag: 'food', count: 2 },
      { tag: 'weekly', count: 1 },
    ]);
  });

  it('should have empty tagCounts when no tags exist', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January');
    await component.ngOnInit();
    expect(component.tagCounts()).toEqual([]);
  });

  it('should delete a tag and refresh tag counts', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'February', ['food']);
    await component.ngOnInit();
    expect(component.tagCounts().length).toBe(2);

    component.confirmDeleteTag('food');
    await component.deleteTag();

    expect(component.tagCounts()).toEqual([{ tag: 'weekly', count: 1 }]);
    expect(component.tagToDelete()).toBeNull();
  });

  it('should cancel tag deletion', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food']);
    await component.ngOnInit();
    component.confirmDeleteTag('food');
    expect(component.tagToDelete()).toBe('food');
    component.cancelDeleteTag();
    expect(component.tagToDelete()).toBeNull();
  });

  it('should rename a tag and refresh tag counts', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food']);
    await component.ngOnInit();
    component.startEditTag('food');
    component.editingTag.set({ old: 'food', new: 'groceries' });
    await component.saveTagRename();
    expect(component.tagCounts()).toEqual([{ tag: 'groceries', count: 1 }]);
  });
});

describe('SettingsComponent - inline editing', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    const category = await categoryService.create('Food', 'Expense');
    categoryId = category.id!;
    await component.ngOnInit();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should start editing account initialBalance', () => {
    component.startEditAccountBalance(accountId, 100000);
    expect(component.editingAccountBalance()).toEqual({ id: accountId, value: 100000 });
  });

  it('should cancel editing account initialBalance', () => {
    component.startEditAccountBalance(accountId, 100000);
    component.cancelEditAccountBalance();
    expect(component.editingAccountBalance()).toBeNull();
  });

  it('should save account initialBalance', async () => {
    component.startEditAccountBalance(accountId, 100000);
    component.editingAccountBalance.set({ id: accountId, value: 200000 });
    await component.saveAccountBalance();
    expect(component.editingAccountBalance()).toBeNull();
    const updated = await accountService.getById(accountId);
    expect(updated?.initialBalance).toBe(200000);
  });

  it('should validate account initialBalance is not negative', async () => {
    component.startEditAccountBalance(accountId, 100000);
    component.editingAccountBalance.set({ id: accountId, value: -100 });
    await component.saveAccountBalance();
    expect(component.errorMessage()).toContain('cannot be negative');
    expect(component.editingAccountBalance()).not.toBeNull();
  });

  it('should start editing category name', () => {
    component.startEditCategoryName(categoryId, 'Food');
    expect(component.editingCategoryName()).toEqual({ id: categoryId, value: 'Food' });
  });

  it('should cancel editing category name', () => {
    component.startEditCategoryName(categoryId, 'Food');
    component.cancelEditCategoryName();
    expect(component.editingCategoryName()).toBeNull();
  });

  it('should save category name', async () => {
    component.startEditCategoryName(categoryId, 'Food');
    component.editingCategoryName.set({ id: categoryId, value: 'Groceries' });
    await component.saveCategoryName();
    expect(component.editingCategoryName()).toBeNull();
    const updated = await categoryService.getById(categoryId);
    expect(updated?.name).toBe('Groceries');
  });

  it('should validate category name is required', async () => {
    component.startEditCategoryName(categoryId, 'Food');
    component.editingCategoryName.set({ id: categoryId, value: '' });
    await component.saveCategoryName();
    expect(component.errorMessage()).toContain('required');
    expect(component.editingCategoryName()).not.toBeNull();
  });

  it('should validate category name is unique', async () => {
    await categoryService.create('Transport', 'Expense');
    component.startEditCategoryName(categoryId, 'Food');
    component.editingCategoryName.set({ id: categoryId, value: 'Transport' });
    await component.saveCategoryName();
    expect(component.errorMessage()).toContain('unique');
    expect(component.editingCategoryName()).not.toBeNull();
  });
});

describe('SettingsComponent - account deactivation confirmation', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let accountId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    await component.ngOnInit();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should set and clear the deactivation confirmation target', () => {
    component.requestDeactivate(accountId);
    expect(component.confirmingDeactivate()).toBe(accountId);

    component.cancelDeactivate();
    expect(component.confirmingDeactivate()).toBeNull();
  });

  it('should not deactivate an account until confirmed', async () => {
    component.requestDeactivate(accountId);
    component.cancelDeactivate();

    const account = await accountService.getById(accountId);
    expect(account?.active).toBe(true);
  });

  it('should deactivate an account only after confirming and name it inline', async () => {
    expect(component.deactivationConfirmationLabel(accountId)).toContain('Cash');

    component.requestDeactivate(accountId);
    await component.confirmDeactivate();

    const account = await accountService.getById(accountId);
    expect(account?.active).toBe(false);
    expect(component.confirmingDeactivate()).toBeNull();
  });

  it('should do nothing when confirming with no target', async () => {
    await component.confirmDeactivate();
    const account = await accountService.getById(accountId);
    expect(account?.active).toBe(true);
  });
});
