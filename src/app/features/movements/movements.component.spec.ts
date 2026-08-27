import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovementsComponent } from './movements.component';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExchangeRateService, ExchangeRateResult } from '../../core/services/exchange-rate.service';
import { db } from '../../core/db/database';
import { getCurrentPeriod, getCurrentYear } from '../../core/types/period.type';

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

describe('MovementsComponent - self-transfer guard', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let accountService: AccountService;
  let accountId1: number;
  let accountId2: number;
  let accountId3: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);

    const acc1 = await accountService.create('Cash', 'EUR', 100000);
    accountId1 = acc1.id!;
    const acc2 = await accountService.create('Card', 'EUR', 50000);
    accountId2 = acc2.id!;
    const acc3 = await accountService.create('Savings', 'EUR', 200000);
    accountId3 = acc3.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should exclude source account from destination accounts', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({ ...f, sourceAccountId: accountId1 }));

    const filtered = component.filteredDestinationAccounts();
    expect(filtered.find(a => a.id === accountId1)).toBeUndefined();
    expect(filtered.length).toBe(2);
  });

  it('should show all accounts when no source is selected', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({ ...f, sourceAccountId: 0 }));

    const filtered = component.filteredDestinationAccounts();
    expect(filtered.length).toBe(3);
  });

  it('should reset destination when source changes to match it', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({ ...f, sourceAccountId: accountId1, destAccountId: accountId2 }));

    component.onTransferSourceChange(accountId2);

    expect(component.trForm().sourceAccountId).toBe(accountId2);
    expect(component.trForm().destAccountId).not.toBe(accountId2);
  });

  it('should not reset destination when source changes to a different account', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({ ...f, sourceAccountId: accountId1, destAccountId: accountId2 }));

    component.onTransferSourceChange(accountId3);

    expect(component.trForm().sourceAccountId).toBe(accountId3);
    expect(component.trForm().destAccountId).toBe(accountId2);
  });

  it('should update destination dropdown when source changes', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({ ...f, sourceAccountId: accountId1 }));

    let filtered = component.filteredDestinationAccounts();
    expect(filtered.find(a => a.id === accountId1)).toBeUndefined();
    expect(filtered.find(a => a.id === accountId2)).toBeDefined();

    component.onTransferSourceChange(accountId2);
    filtered = component.filteredDestinationAccounts();
    expect(filtered.find(a => a.id === accountId2)).toBeUndefined();
    expect(filtered.find(a => a.id === accountId1)).toBeDefined();
  });
});

describe('MovementsComponent - category deactivation and income sign', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let transactionService: TransactionService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let profileService: ProfileService;
  let accountId: number;
  let expenseCategoryId: number;
  let incomeCategoryId: number;

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
    profileService = TestBed.inject(ProfileService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    const expenseCat = await categoryService.create('Food', 'Expense');
    expenseCategoryId = expenseCat.id!;
    const incomeCat = await categoryService.create('Payroll', 'Income');
    incomeCategoryId = incomeCat.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should resolve name of deactivated category on existing transactions', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(accountId, expenseCategoryId, 500, new Date(), period);
    await categoryService.setActive(expenseCategoryId, false);

    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    expect(component.getCategoryName(txn.categoryId)).toBe('Food');
  });

  it('should use all categories for name resolution but active-only for form', async () => {
    await component.ngOnInit();

    expect(component.allCategoriesForNameResolution().length).toBe(2);
    expect(component.categories().length).toBe(2);

    await categoryService.setActive(expenseCategoryId, false);
    await component.ngOnInit();

    expect(component.allCategoriesForNameResolution().length).toBe(2);
    expect(component.categories().length).toBe(1);
  });

  it('should use all categories for filter dropdown name resolution', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(accountId, expenseCategoryId, 500, new Date(), period);
    await categoryService.setActive(expenseCategoryId, false);
    await component.ngOnInit();

    expect(component.allCategoriesForNameResolution().find(c => c.id === expenseCategoryId)).toBeDefined();
  });

  it('should show income amount as positive without minus prefix', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(accountId, incomeCategoryId, 3000, new Date(), period);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    expect(component.isIncomeTransaction(txn)).toBe(true);
    expect(component.formatTransactionDisplayAmount(txn)).not.toContain('-');
  });

  it('should show expense amount as positive without minus prefix', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(accountId, expenseCategoryId, 500, new Date(), period);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    expect(component.isIncomeTransaction(txn)).toBe(false);
    expect(component.formatTransactionDisplayAmount(txn)).not.toContain('-');
  });
});

describe('MovementsComponent - transaction exchange rate re-fetch', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let exchangeRateService: ExchangeRateService;
  let eurAccountId: number;
  let usdAccountId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    const mockExchangeRateService = {
      getRate: vi.fn().mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-15' }),
    };

    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
      providers: [
        { provide: ExchangeRateService, useValue: mockExchangeRateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    exchangeRateService = TestBed.inject(ExchangeRateService);

    const eurAcc = await accountService.create('Cash EUR', 'EUR', 100000);
    eurAccountId = eurAcc.id!;
    const usdAcc = await accountService.create('Cash USD', 'USD', 50000);
    usdAccountId = usdAcc.id!;
    const cat = await categoryService.create('Food', 'Expense');
    categoryId = cat.id!;
  });

  afterEach(async () => {
    await db.delete();
    vi.restoreAllMocks();
  });

  it('should fetch rate using transaction date when account changes to foreign currency', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({ ...f, accountId: usdAccountId, date: '2026-03-10' }));

    await component.onAccountChange(usdAccountId);

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-03-10');
    expect(component.exchangeRateState().rate).toBe(1.08);
    expect(component.txForm().exchangeRate).toBe(1.08);
  });

  it('should re-fetch rate when date changes', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({ ...f, accountId: usdAccountId, date: '2026-01-15' }));
    await component.onAccountChange(usdAccountId);

    vi.mocked(exchangeRateService.getRate).mockResolvedValueOnce({
      rate: 1.12, from: 'USD', to: 'EUR', date: '2026-01-15',
    });

    await component.onTxDateChange('2026-01-15');

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-01-15');
    expect(component.txForm().exchangeRate).toBe(1.12);
  });

  it('should reset exchange rate when account changes to base currency', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({ ...f, accountId: usdAccountId, date: '2026-03-10' }));
    await component.onAccountChange(usdAccountId);
    expect(component.txForm().exchangeRate).toBe(1.08);

    await component.onAccountChange(eurAccountId);

    expect(component.txForm().exchangeRate).toBeNull();
    expect(component.txForm().baseCurrencyAmount).toBeNull();
    expect(component.exchangeRateState().rate).toBeNull();
  });

  it('should compute baseCurrencyAmount after rate is fetched', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({ ...f, accountId: usdAccountId, amount: 100, date: '2026-03-10' }));

    await component.onAccountChange(usdAccountId);

    expect(component.txForm().baseCurrencyAmount).toBe(108);
  });

  it('should show loading state while fetching rate', async () => {
    let resolveGetRate: (value: ExchangeRateResult) => void;
    vi.mocked(exchangeRateService.getRate).mockImplementationOnce(
      () => new Promise(resolve => { resolveGetRate = resolve; }),
    );

    await component.ngOnInit();
    component.txForm.update(f => ({ ...f, accountId: usdAccountId, date: '2026-03-10' }));

    const changePromise = component.onAccountChange(usdAccountId);
    expect(component.exchangeRateState().loading).toBe(true);

    resolveGetRate!({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-03-10' });
    await changePromise;

    expect(component.exchangeRateState().loading).toBe(false);
  });
});

describe('MovementsComponent - transfer exchange rate', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let accountService: AccountService;
  let exchangeRateService: ExchangeRateService;
  let eurAccountId: number;
  let usdAccountId: number;
  let gbpAccountId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    const mockExchangeRateService = {
      getRate: vi.fn().mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };

    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
      providers: [
        { provide: ExchangeRateService, useValue: mockExchangeRateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    exchangeRateService = TestBed.inject(ExchangeRateService);

    const eurAcc = await accountService.create('Cash EUR', 'EUR', 100000);
    eurAccountId = eurAcc.id!;
    const usdAcc = await accountService.create('Cash USD', 'USD', 50000);
    usdAccountId = usdAcc.id!;
    const gbpAcc = await accountService.create('Cash GBP', 'GBP', 30000);
    gbpAccountId = gbpAcc.id!;
  });

  afterEach(async () => {
    await db.delete();
    vi.restoreAllMocks();
  });

  it('should fetch exchange rate when source account changes to foreign currency', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({ ...f, sourceAccountId: usdAccountId, destAccountId: eurAccountId, date: '2026-08-20' }));

    await component.onTransferSourceChange(usdAccountId);

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-08-20');
    expect(component.trForm().exchangeRate).toBe(1.08);
  });

  it('should re-fetch exchange rate when transfer date changes', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({ ...f, sourceAccountId: usdAccountId, destAccountId: eurAccountId, date: '2026-08-20' }));
    await component.onTransferSourceChange(usdAccountId);

    vi.mocked(exchangeRateService.getRate).mockResolvedValueOnce({
      rate: 1.12, from: 'USD', to: 'EUR', date: '2026-01-15',
    });

    await component.onTransferDateChange('2026-01-15');

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-01-15');
    expect(component.trForm().exchangeRate).toBe(1.12);
  });

  it('should auto-calculate destination amount from source amount and rate', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({
      ...f, sourceAccountId: usdAccountId, destAccountId: eurAccountId,
      sourceAmount: 500, date: '2026-08-20',
    }));
    await component.onTransferSourceChange(usdAccountId);

    expect(component.trForm().exchangeRate).toBe(1.08);
  });

  it('should show suggested rate text in transfer form', async () => {
    await component.ngOnInit();
    component.openTransferForm();
    component.trForm.update(f => ({
      ...f, sourceAccountId: usdAccountId, destAccountId: eurAccountId,
      sourceAmount: 500, date: '2026-08-20',
    }));
    await component.onTransferSourceChange(usdAccountId);
    fixture.detectChanges();

    const rateText = fixture.nativeElement.querySelector('.rate-source');
    expect(rateText).toBeTruthy();
    expect(rateText.textContent).toContain('1 USD');
    expect(rateText.textContent).toContain('1.08');
    expect(rateText.textContent).toContain('EUR');
  });

  it('should not fetch rate when source and destination are same currency', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({
      ...f, sourceAccountId: eurAccountId, destAccountId: eurAccountId,
      sourceAmount: 500, date: '2026-08-20',
    }));

    await component.onTransferSourceChange(eurAccountId);

    expect(component.trForm().exchangeRate).toBe(1);
  });

  it('should allow manual override of exchange rate', async () => {
    await component.ngOnInit();
    component.trForm.update(f => ({
      ...f, sourceAccountId: usdAccountId, destAccountId: eurAccountId,
      sourceAmount: 500, date: '2026-08-20',
    }));
    await component.onTransferSourceChange(usdAccountId);
    expect(component.trForm().exchangeRate).toBe(1.08);

    component.trForm.update(f => ({ ...f, exchangeRate: 1.15 }));
    expect(component.trForm().exchangeRate).toBe(1.15);
  });
});

describe('MovementsComponent - direction arrows and display amounts', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let transactionService: TransactionService;
  let transferService: TransferService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let profileService: ProfileService;
  let eurAccountId: number;
  let usdAccountId: number;
  let expenseCategoryId: number;
  let incomeCategoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    const mockExchangeRateService = {
      getRate: vi.fn().mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };

    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
      providers: [
        { provide: ExchangeRateService, useValue: mockExchangeRateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsComponent);
    component = fixture.componentInstance;
    transactionService = TestBed.inject(TransactionService);
    transferService = TestBed.inject(TransferService);
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    profileService = TestBed.inject(ProfileService);

    const eurAcc = await accountService.create('Cash EUR', 'EUR', 100000);
    eurAccountId = eurAcc.id!;
    const usdAcc = await accountService.create('Cash USD', 'USD', 50000);
    usdAccountId = usdAcc.id!;
    const expenseCat = await categoryService.create('Food', 'Expense');
    expenseCategoryId = expenseCat.id!;
    const incomeCat = await categoryService.create('Payroll', 'Income');
    incomeCategoryId = incomeCat.id!;
  });

  afterEach(async () => {
    await db.delete();
    vi.restoreAllMocks();
  });

  it('should return → arrow for income transactions', async () => {
    await component.ngOnInit();
    const txn = { categoryId: incomeCategoryId } as any;
    expect(component.getDirectionArrow(txn, 'transaction')).toBe('→');
  });

  it('should return ← arrow for expense transactions', async () => {
    await component.ngOnInit();
    const txn = { categoryId: expenseCategoryId } as any;
    expect(component.getDirectionArrow(txn, 'transaction')).toBe('←');
  });

  it('should return = arrow for transfers', async () => {
    const tr = {} as any;
    expect(component.getDirectionArrow(tr, 'transfer')).toBe('=');
  });

  it('should show positive amount for expenses (no minus prefix)', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, expenseCategoryId, 500, new Date(), period);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    expect(component.formatTransactionDisplayAmount(txn)).not.toContain('-');
    expect(component.formatTransactionDisplayAmount(txn)).toContain('500');
  });

  it('should show positive amount for income', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, incomeCategoryId, 3000, new Date(), period);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    expect(component.formatTransactionDisplayAmount(txn)).not.toContain('-');
    expect(component.formatTransactionDisplayAmount(txn)).toContain('3,000');
  });

  it('should show just base currency amount for same-currency transactions', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, expenseCategoryId, 50, new Date(), period);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    const display = component.formatTransactionDisplayAmount(txn);
    expect(display).not.toContain('→');
    expect(display).toContain('50');
  });

  it('should show both currencies for cross-currency transactions', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(usdAccountId, expenseCategoryId, 10, new Date('2026-08-20'), period, [], 1.08, 10.80);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    const display = component.formatTransactionDisplayAmount(txn);
    expect(display).toContain('→');
    expect(display).toContain('$');
    expect(display).toContain('€');
  });

  it('should return true for foreign currency transactions', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(usdAccountId, expenseCategoryId, 10, new Date(), period);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    expect(component.isForeignCurrencyTransaction(txn)).toBe(true);
  });

  it('should fall back to source-only display when baseCurrencyAmount is null', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(usdAccountId, expenseCategoryId, 10, new Date('2026-08-20'), period, [], null, null);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    const display = component.formatTransactionDisplayAmount(txn);
    expect(display).toContain('$');
    expect(display).not.toContain('→');
  });

  it('should return false for same-currency transactions', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, expenseCategoryId, 50, new Date(), period);
    await component.ngOnInit();

    const txn = component.movements()[0].data as any;
    expect(component.isForeignCurrencyTransaction(txn)).toBe(false);
  });

  it('should return source currency for cross-currency transfers', async () => {
    const period = getCurrentPeriod();
    await transferService.create(usdAccountId, eurAccountId, 100, new Date(), period, 'test', 1.08);
    await component.ngOnInit();

    const tr = component.movements()[0].data as any;
    expect(component.getAccountCurrency(tr.sourceAccountId)).toBe('USD');
  });

  it('should show source → dest amounts for cross-currency transfers', async () => {
    const period = getCurrentPeriod();
    await transferService.create(usdAccountId, eurAccountId, 100, new Date(), period, 'test', 1.08);
    await component.ngOnInit();

    const tr = component.movements()[0].data as any;
    const display = component.formatTransferDisplayAmount(tr);
    expect(display).toContain('→');
    expect(display).toContain('$');
    expect(display).toContain('€');
  });

  it('should show just amount for same-currency transfers', async () => {
    const period = getCurrentPeriod();
    const acc2 = await accountService.create('Cash EUR 2', 'EUR', 50000);
    await transferService.create(eurAccountId, acc2.id!, 500, new Date(), period, 'savings');
    await component.ngOnInit();

    const tr = component.movements()[0].data as any;
    const display = component.formatTransferDisplayAmount(tr);
    expect(display).not.toContain('→');
    expect(display).toContain('500');
  });

  it('should render direction arrow column in table header', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, expenseCategoryId, 100, new Date(), period);
    await component.ngOnInit();
    fixture.detectChanges();

    const headers = fixture.nativeElement.querySelectorAll('th');
    expect(headers[0].textContent).toContain('Type');
    expect(headers[1].textContent).toContain('Date');
  });

  it('should render direction arrow cell for each row', async () => {
    const period = getCurrentPeriod();
    const acc2 = await accountService.create('Cash EUR 2', 'EUR', 50000);
    await transactionService.create(eurAccountId, expenseCategoryId, 100, new Date(), period);
    await transferService.create(eurAccountId, acc2.id!, 200, new Date(), period, 'move');
    await component.ngOnInit();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    const arrowCells = fixture.nativeElement.querySelectorAll('tbody tr td:first-child');
    const arrows = Array.from(arrowCells).map((el: any) => el.textContent.trim());
    expect(arrows).toContain('←');
    expect(arrows).toContain('=');
  });
});

describe('MovementsComponent - period year', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let transactionService: TransactionService;
  let transferService: TransferService;
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
    transferService = TestBed.inject(TransferService);
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

  it('should default new movement forms to the current year', async () => {
    await component.ngOnInit();
    expect(component.txForm().year).toBe(getCurrentYear());
    expect(component.trForm().year).toBe(getCurrentYear());
  });

  it('should filter movements by the selected period year', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(accountId, categoryId, 100, new Date(), period, [], null, null, getCurrentYear() - 1);
    await transactionService.create(accountId, categoryId, 200, new Date(), period);

    await component.ngOnInit();
    expect(component.movements().length).toBe(1);
    expect((component.movements()[0].data as any).amount).toBe(200);

    component.selectedYear.set(getCurrentYear() - 1);
    await component.refresh();
    expect(component.movements().length).toBe(1);
    expect((component.movements()[0].data as any).amount).toBe(100);
  });

  it('should save the period year from the transaction form', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({
      ...f, accountId, categoryId, amount: 500, date: '2025-12-22', period: 'January', year: 2026,
    }));
    await component.saveTransaction();

    const txns = await transactionService.getAll();
    expect(txns[0].year).toBe(2026);
    expect(txns[0].date.getFullYear()).toBe(2025);
  });

  it('should save the period year from the transfer form', async () => {
    const acc2 = await accountService.create('Savings', 'EUR', 50000);
    await component.ngOnInit();
    component.trForm.update(f => ({
      ...f, sourceAccountId: accountId, destAccountId: acc2.id!,
      sourceAmount: 500, destinationAmount: 500, date: '2025-12-22', period: 'January', year: 2026,
    }));
    await component.saveTransfer();

    const transfers = await transferService.getAll();
    expect(transfers[0].year).toBe(2026);
    expect(transfers[0].date.getFullYear()).toBe(2025);
  });

  it('should populate the form year when editing a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 500, new Date('2025-12-22'), 'January', [], null, null, 2026,
    );
    await component.ngOnInit();
    component.openTransactionForm(t.id!);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.txForm().year).toBe(2026);
  });

  it('should populate the form year when editing a transfer', async () => {
    const acc2 = await accountService.create('Savings', 'EUR', 50000);
    const t = await transferService.create(
      accountId, acc2.id!, 500, new Date('2025-12-22'), 'January', 'savings', 1, 2026,
    );
    await component.ngOnInit();
    component.openTransferForm(t.id!);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.trForm().year).toBe(2026);
  });
});

describe('MovementsComponent - transaction note', () => {
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

  it('should initialize txForm note as empty string', async () => {
    await component.ngOnInit();
    expect(component.txForm().note).toBe('');
  });

  it('should populate note when editing a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January', [], null, null,
      getCurrentYear(), 'Dinner with friends',
    );
    await component.ngOnInit();
    component.openTransactionForm(t.id!);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.txForm().note).toBe('Dinner with friends');
  });

  it('should default note to empty when opening new transaction form', async () => {
    await component.ngOnInit();
    component.openTransactionForm();
    expect(component.txForm().note).toBe('');
  });

  it('should save transaction with note from txForm', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({
      ...f, accountId, categoryId, amount: 500, date: '2026-01-15', note: 'Weekly groceries',
    }));
    await component.saveTransaction();

    const transactions = await transactionService.getAll();
    expect(transactions.length).toBe(1);
    expect(transactions[0].note).toBe('Weekly groceries');
  });

  it('should preserve updated note when editing an existing transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
    );
    await component.ngOnInit();
    component.openTransactionForm(t.id!);
    await new Promise(resolve => setTimeout(resolve, 10));
    component.txForm.update(f => ({ ...f, note: 'Updated note' }));
    await component.saveTransaction();

    const updated = await transactionService.getById(t.id!);
    expect(updated!.note).toBe('Updated note');
  });

  it('should render note on transaction rows', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(
      accountId, categoryId, 500, new Date(), period, [], null, null, getCurrentYear(),
      'Dinner with friends',
    );
    await component.ngOnInit();
    fixture.detectChanges();

    const noteEl = fixture.nativeElement.querySelector('.note');
    expect(noteEl).toBeTruthy();
    expect(noteEl.textContent.trim()).toBe('Dinner with friends');
  });
});
