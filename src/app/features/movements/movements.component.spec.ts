import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovementsComponent } from './movements.component';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { db } from '../../core/db/database';
import { getCurrentPeriod } from '../../core/types/period.type';

describe('MovementsComponent - tags integration', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let transactionService: TransactionService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsComponent);
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

  it('should initialize with empty allTags', async () => {
    await component.ngOnInit();
    expect(component.allTags()).toEqual([]);
  });

  it('should load existing tags into allTags', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'January', ['groceries']);
    await component.ngOnInit();
    expect(component.allTags()).toEqual(['food', 'groceries', 'weekly']);
  });

  it('should initialize txForm.tags as empty array', async () => {
    await component.ngOnInit();
    expect(component.txForm().tags).toEqual([]);
  });

  it('should populate tags when editing a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
      ['vacation', 'food'],
    );
    await component.ngOnInit();
    component.openTransactionForm(t.id!);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.txForm().tags).toEqual(['vacation', 'food']);
  });

  it('should save transaction with tags from txForm', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({
      ...f, tags: ['groceries', 'weekly'], accountId, categoryId, amount: 500, date: '2026-01-15',
    }));
    await component.saveTransaction();

    const transactions = await transactionService.getAll();
    expect(transactions.length).toBe(1);
    expect(transactions[0].tags).toEqual(['groceries', 'weekly']);
  });

  it('should update allTags after saving a transaction', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({
      ...f, tags: ['newtag'], accountId, categoryId, amount: 500, date: '2026-01-15',
    }));
    await component.saveTransaction();
    expect(component.allTags()).toEqual(['newtag']);
  });

  it('should reset tags when cancelling form', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({ ...f, tags: ['test'] }));
    component.cancelForm();
    expect(component.txForm().tags).toEqual([]);
  });
});

describe('MovementsComponent - filtering', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let transactionService: TransactionService;
  let transferService: TransferService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId1: number;
  let accountId2: number;
  let categoryId1: number;
  let categoryId2: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsComponent);
    component = fixture.componentInstance;
    transactionService = TestBed.inject(TransactionService);
    transferService = TestBed.inject(TransferService);
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);

    const acc1 = await accountService.create('Cash', 'EUR', 100000);
    accountId1 = acc1.id!;
    const acc2 = await accountService.create('Card', 'EUR', 50000);
    accountId2 = acc2.id!;
    const cat1 = await categoryService.create('Food', 'Expense');
    categoryId1 = cat1.id!;
    const cat2 = await categoryService.create('Transport', 'Expense');
    categoryId2 = cat2.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  async function seedMovements(): Promise<void> {
    const period = getCurrentPeriod();
    await transactionService.create(accountId1, categoryId1, 500, new Date(), period, ['groceries']);
    await transactionService.create(accountId2, categoryId2, 300, new Date(), period, ['commute']);
    await transactionService.create(accountId1, categoryId2, 200, new Date(), period, ['groceries']);
    await transferService.create(accountId1, accountId2, 1000, new Date(), period, 'savings');
    await component.ngOnInit();
  }

  it('should show all movements when no filters are set', async () => {
    await seedMovements();
    expect(component.filteredMovements().length).toBe(4);
  });

  it('should filter by category', async () => {
    await seedMovements();
    component.filterCategory.set(categoryId1);
    expect(component.filteredMovements().length).toBe(1);
    const item = component.filteredMovements()[0];
    expect(item.type).toBe('transaction');
    expect((item.data as any).categoryId).toBe(categoryId1);
  });

  it('should filter by account', async () => {
    await seedMovements();
    component.filterAccount.set(accountId2);
    const filtered = component.filteredMovements();
    expect(filtered.length).toBe(2);
    for (const item of filtered) {
      if (item.type === 'transaction') {
        expect((item.data as any).accountId).toBe(accountId2);
      } else {
        const tr = item.data as any;
        expect(tr.sourceAccountId === accountId2 || tr.destinationAccountId === accountId2).toBe(true);
      }
    }
  });

  it('should filter by tag', async () => {
    await seedMovements();
    component.filterTag.set('groceries');
    const filtered = component.filteredMovements();
    expect(filtered.length).toBe(2);
    for (const item of filtered) {
      expect(item.type).toBe('transaction');
      expect((item.data as any).tags).toContain('groceries');
    }
  });

  it('should compose filters with AND logic', async () => {
    await seedMovements();
    component.filterCategory.set(categoryId2);
    component.filterTag.set('commute');
    expect(component.filteredMovements().length).toBe(1);
    const item = component.filteredMovements()[0];
    expect((item.data as any).categoryId).toBe(categoryId2);
    expect((item.data as any).tags).toContain('commute');
  });

  it('should return empty when no movements match all filters', async () => {
    await seedMovements();
    component.filterCategory.set(categoryId1);
    component.filterTag.set('commute');
    expect(component.filteredMovements().length).toBe(0);
  });

  it('should clear all filters', async () => {
    await seedMovements();
    component.filterCategory.set(categoryId1);
    component.filterTag.set('groceries');
    expect(component.filteredMovements().length).toBe(1);
    component.clearFilters();
    expect(component.filterCategory()).toBeNull();
    expect(component.filterAccount()).toBeNull();
    expect(component.filterTag()).toBeNull();
    expect(component.filteredMovements().length).toBe(4);
  });

  it('should compute activeFilterCount', async () => {
    await seedMovements();
    expect(component.activeFilterCount()).toBe(0);
    component.filterCategory.set(categoryId1);
    expect(component.activeFilterCount()).toBe(1);
    component.filterAccount.set(accountId2);
    expect(component.activeFilterCount()).toBe(2);
    component.filterTag.set('groceries');
    expect(component.activeFilterCount()).toBe(3);
  });
});
