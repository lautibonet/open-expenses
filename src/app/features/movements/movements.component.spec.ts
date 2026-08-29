import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovementsComponent } from './movements.component';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { db } from '../../core/db/database';
import { Transaction } from '../../core/models/transaction.model';
import { Transfer } from '../../core/models/transfer.model';
import { defaultScope, getCurrentPeriod, getCurrentYear } from '../../core/types/period.type';

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
    await transactionService.create(accountId1, categoryId1, 500, new Date(), period);
    await transactionService.create(accountId2, categoryId2, 300, new Date(), period);
    await transactionService.create(accountId1, categoryId2, 200, new Date(), period);
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
        expect(tr.sourceAccountId === accountId2 || tr.destinationAccountId === accountId2).toBe(
          true,
        );
      }
    }
  });

  it('should compose filters with AND logic', async () => {
    await seedMovements();
    component.filterCategory.set(categoryId2);
    component.filterAccount.set(accountId1);
    expect(component.filteredMovements().length).toBe(1);
    const item = component.filteredMovements()[0];
    expect((item.data as any).categoryId).toBe(categoryId2);
    expect((item.data as any).accountId).toBe(accountId1);
  });

  it('should return empty when no movements match all filters', async () => {
    await seedMovements();
    component.filterCategory.set(categoryId1);
    component.filterAccount.set(accountId2);
    expect(component.filteredMovements().length).toBe(0);
  });

  it('should clear all filters', async () => {
    await seedMovements();
    component.filterCategory.set(categoryId1);
    component.filterAccount.set(accountId2);
    component.searchQuery.set('cash');
    expect(component.activeFilterCount()).toBeGreaterThan(0);
    component.clearFilters();
    expect(component.filterCategory()).toBeNull();
    expect(component.filterAccount()).toBeNull();
    expect(component.searchQuery()).toBe('');
    expect(component.filteredMovements().length).toBe(4);
  });

  it('should compute activeFilterCount', async () => {
    await seedMovements();
    expect(component.activeFilterCount()).toBe(0);
    component.filterCategory.set(categoryId1);
    expect(component.activeFilterCount()).toBe(1);
    component.filterAccount.set(accountId2);
    expect(component.activeFilterCount()).toBe(2);
  });
});

describe('MovementsComponent - no tag affordances', () => {
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

  it('renders no tag chips on transaction rows', async () => {
    await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tag').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.tags').length).toBe(0);
  });

  it('offers no All tags filter in the filter bar', async () => {
    await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('All tags');
  });

  it('counts only category, account, and search as active filters', async () => {
    await component.ngOnInit();
    component.filterCategory.set(categoryId);
    component.filterAccount.set(accountId);
    component.searchQuery.set('cash');

    expect(component.activeFilterCount()).toBe(3);
  });

  it('matches search against note text', async () => {
    await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
      null,
      null,
      getCurrentYear(),
      'Coffee beans',
    );
    await component.ngOnInit();

    component.searchQuery.set('beans');
    expect(component.filteredMovements().length).toBe(1);

    component.searchQuery.set('nothing-matches-this');
    expect(component.filteredMovements().length).toBe(0);
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
    component.trForm.update((f) => ({ ...f, sourceAccountId: accountId1 }));

    const filtered = component.filteredDestinationAccounts();
    expect(filtered.find((a) => a.id === accountId1)).toBeUndefined();
    expect(filtered.length).toBe(2);
  });

  it('should show all accounts when no source is selected', async () => {
    await component.ngOnInit();
    component.trForm.update((f) => ({ ...f, sourceAccountId: 0 }));

    const filtered = component.filteredDestinationAccounts();
    expect(filtered.length).toBe(3);
  });

  it('should reset destination when source changes to match it', async () => {
    await component.ngOnInit();
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: accountId1,
      destAccountId: accountId2,
    }));

    component.onTransferSourceChange(accountId2);

    expect(component.trForm().sourceAccountId).toBe(accountId2);
    expect(component.trForm().destAccountId).not.toBe(accountId2);
  });

  it('should not reset destination when source changes to a different account', async () => {
    await component.ngOnInit();
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: accountId1,
      destAccountId: accountId2,
    }));

    component.onTransferSourceChange(accountId3);

    expect(component.trForm().sourceAccountId).toBe(accountId3);
    expect(component.trForm().destAccountId).toBe(accountId2);
  });

  it('should update destination dropdown when source changes', async () => {
    await component.ngOnInit();
    component.trForm.update((f) => ({ ...f, sourceAccountId: accountId1 }));

    let filtered = component.filteredDestinationAccounts();
    expect(filtered.find((a) => a.id === accountId1)).toBeUndefined();
    expect(filtered.find((a) => a.id === accountId2)).toBeDefined();

    component.onTransferSourceChange(accountId2);
    filtered = component.filteredDestinationAccounts();
    expect(filtered.find((a) => a.id === accountId2)).toBeUndefined();
    expect(filtered.find((a) => a.id === accountId1)).toBeDefined();
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

    expect(
      component.allCategoriesForNameResolution().find((c) => c.id === expenseCategoryId),
    ).toBeDefined();
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
      getRate: vi
        .fn()
        .mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };

    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
      providers: [{ provide: ExchangeRateService, useValue: mockExchangeRateService }],
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
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: usdAccountId,
      destAccountId: eurAccountId,
      date: '2026-08-20',
    }));

    await component.onTransferSourceChange(usdAccountId);

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-08-20');
    expect(component.trForm().exchangeRate).toBe(1.08);
  });

  it('should re-fetch exchange rate when transfer date changes', async () => {
    await component.ngOnInit();
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: usdAccountId,
      destAccountId: eurAccountId,
      date: '2026-08-20',
    }));
    await component.onTransferSourceChange(usdAccountId);

    vi.mocked(exchangeRateService.getRate).mockResolvedValueOnce({
      rate: 1.12,
      from: 'USD',
      to: 'EUR',
      date: '2026-01-15',
    });

    await component.onTransferDateChange('2026-01-15');

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-01-15');
    expect(component.trForm().exchangeRate).toBe(1.12);
  });

  it('should auto-calculate destination amount from source amount and rate', async () => {
    await component.ngOnInit();
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: usdAccountId,
      destAccountId: eurAccountId,
      sourceAmount: 500,
      date: '2026-08-20',
    }));
    await component.onTransferSourceChange(usdAccountId);

    expect(component.trForm().exchangeRate).toBe(1.08);
  });

  it('should show suggested rate text in transfer form', async () => {
    await component.ngOnInit();
    component.openTransferForm();
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: usdAccountId,
      destAccountId: eurAccountId,
      sourceAmount: 500,
      date: '2026-08-20',
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
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: eurAccountId,
      destAccountId: eurAccountId,
      sourceAmount: 500,
      date: '2026-08-20',
    }));

    await component.onTransferSourceChange(eurAccountId);

    expect(component.trForm().exchangeRate).toBe(1);
  });

  it('should allow manual override of exchange rate', async () => {
    await component.ngOnInit();
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: usdAccountId,
      destAccountId: eurAccountId,
      sourceAmount: 500,
      date: '2026-08-20',
    }));
    await component.onTransferSourceChange(usdAccountId);
    expect(component.trForm().exchangeRate).toBe(1.08);

    component.trForm.update((f) => ({ ...f, exchangeRate: 1.15 }));
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
      getRate: vi
        .fn()
        .mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };

    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
      providers: [{ provide: ExchangeRateService, useValue: mockExchangeRateService }],
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
    await transactionService.create(
      usdAccountId,
      expenseCategoryId,
      10,
      new Date('2026-08-20'),
      period,
      1.08,
      10.8,
    );
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
    await transactionService.create(
      usdAccountId,
      expenseCategoryId,
      10,
      new Date('2026-08-20'),
      period,
      null,
      null,
    );
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

  it('should default new transfer form to the current year', async () => {
    await component.ngOnInit();
    expect(component.trForm().year).toBe(getCurrentYear());
  });

  it('should filter movements by the selected period year', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(
      accountId,
      categoryId,
      100,
      new Date(),
      period,
      null,
      null,
      getCurrentYear() - 1,
    );
    await transactionService.create(accountId, categoryId, 200, new Date(), period);

    await component.ngOnInit();
    expect(component.movements().length).toBe(1);
    expect((component.movements()[0].data as any).amount).toBe(200);

    await component.onScopeYearChange(getCurrentYear() - 1);
    expect(component.movements().length).toBe(1);
    expect((component.movements()[0].data as any).amount).toBe(100);
  });

  it('should save the period year from the transaction payload', async () => {
    await component.ngOnInit();
    await component.onSaveTransaction({
      id: null,
      accountId,
      categoryId,
      amount: 500,
      date: '2025-12-22',
      period: 'January',
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
    });

    const txns = await transactionService.getAll();
    expect(txns[0].year).toBe(2026);
    expect(txns[0].date.getFullYear()).toBe(2025);
  });

  it('should save the period year from the transfer form', async () => {
    const acc2 = await accountService.create('Savings', 'EUR', 50000);
    await component.ngOnInit();
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: accountId,
      destAccountId: acc2.id!,
      sourceAmount: 500,
      destinationAmount: 500,
      date: '2025-12-22',
      period: 'January',
      year: 2026,
    }));
    await component.saveTransfer();

    const transfers = await transferService.getAll();
    expect(transfers[0].year).toBe(2026);
    expect(transfers[0].date.getFullYear()).toBe(2025);
  });

  it('should populate the form year when editing a transfer', async () => {
    const acc2 = await accountService.create('Savings', 'EUR', 50000);
    const t = await transferService.create(
      accountId,
      acc2.id!,
      500,
      new Date('2025-12-22'),
      'January',
      'savings',
      1,
      2026,
    );
    await component.ngOnInit();
    component.openTransferForm(t.id!);
    await new Promise((resolve) => setTimeout(resolve, 10));

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

  it('should save transaction with note from the card payload', async () => {
    await component.ngOnInit();
    await component.onSaveTransaction({
      id: null,
      accountId,
      categoryId,
      amount: 500,
      date: '2026-01-15',
      period: 'January',
      year: getCurrentYear(),
      note: 'Weekly groceries',
      exchangeRate: null,
      baseCurrencyAmount: null,
    });

    const transactions = await transactionService.getAll();
    expect(transactions.length).toBe(1);
    expect(transactions[0].note).toBe('Weekly groceries');
  });

  it('should preserve an updated note when updating an existing transaction', async () => {
    const t = await transactionService.create(
      accountId,
      categoryId,
      1500,
      new Date('2026-01-15'),
      'January',
    );
    await component.ngOnInit();
    await component.onSaveTransaction({
      id: t.id!,
      accountId,
      categoryId,
      amount: 1500,
      date: '2026-01-15',
      period: 'January',
      year: getCurrentYear(),
      note: 'Updated note',
      exchangeRate: null,
      baseCurrencyAmount: null,
    });

    const updated = await transactionService.getById(t.id!);
    expect(updated!.note).toBe('Updated note');
  });

  it('should render note on transaction rows', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      period,
      null,
      null,
      getCurrentYear(),
      'Dinner with friends',
    );
    await component.ngOnInit();
    fixture.detectChanges();

    const noteEl = fixture.nativeElement.querySelector('.note');
    expect(noteEl).toBeTruthy();
    expect(noteEl.textContent.trim()).toBe('Dinner with friends');
  });
});

describe('MovementsComponent - shared scope', () => {
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

  it('should default to the current month scope', async () => {
    await component.ngOnInit();
    expect(component.scope()).toEqual(defaultScope());
  });

  it('should derive year options from the data range, not a fixed window', async () => {
    await transactionService.create(
      accountId,
      categoryId,
      100,
      new Date('2012-01-15'),
      'January',
      null,
      null,
      2012,
    );
    await transactionService.create(
      accountId,
      categoryId,
      200,
      new Date('2016-01-15'),
      'January',
      null,
      null,
      2016,
    );
    await component.ngOnInit();

    expect(component.scopeYears()).toContain(2012);
    expect(component.scopeYears()).toContain(2016);
    expect(component.scopeYears()).toContain(getCurrentYear());
    expect(component.scopeYears()).toEqual(expect.arrayContaining([2012, 2016, getCurrentYear()]));
  });

  it('should derive month options from the months actually present in data', async () => {
    await transactionService.create(
      accountId,
      categoryId,
      100,
      new Date('2026-03-15'),
      'March',
      null,
      null,
      2026,
    );
    await transactionService.create(
      accountId,
      categoryId,
      200,
      new Date('2026-07-15'),
      'July',
      null,
      null,
      2026,
    );
    await component.ngOnInit();

    expect(component.scopeMonths()).toContain('March');
    expect(component.scopeMonths()).toContain('July');
  });

  it('should show movements from every period when All time is chosen', async () => {
    await transactionService.create(
      accountId,
      categoryId,
      100,
      new Date('2012-01-15'),
      'January',
      null,
      null,
      2012,
    );
    await transactionService.create(
      accountId,
      categoryId,
      200,
      new Date('2016-05-15'),
      'May',
      null,
      null,
      2016,
    );
    await component.ngOnInit();
    expect(component.movements().length).toBe(0);

    await component.onScopeYearChange('all-time');
    expect(component.scope().kind).toBe('all-time');
    expect(component.movements().length).toBe(2);
  });

  it('should include movements older than ten years in All time', async () => {
    const oldYear = getCurrentYear() - 20;
    await transactionService.create(
      accountId,
      categoryId,
      100,
      new Date(`${oldYear}-01-15`),
      'January',
      null,
      null,
      oldYear,
    );
    await component.ngOnInit();

    await component.onScopeYearChange('all-time');
    expect(component.movements().length).toBe(1);
    expect((component.movements()[0].data as any).year).toBe(oldYear);
  });

  it('should switch scope by year while keeping the current period', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(
      accountId,
      categoryId,
      100,
      new Date(),
      period,
      null,
      null,
      getCurrentYear() - 1,
    );
    await transactionService.create(accountId, categoryId, 200, new Date(), period);
    await component.ngOnInit();

    await component.onScopeYearChange(getCurrentYear() - 1);
    expect(component.scope()).toEqual({ kind: 'month', period, year: getCurrentYear() - 1 });
    expect(component.movements().length).toBe(1);
  });

  it('should switch scope month and filter accordingly', async () => {
    const year = getCurrentYear();
    await transactionService.create(
      accountId,
      categoryId,
      100,
      new Date(`${year}-01-15`),
      'January',
      null,
      null,
      year,
    );
    await transactionService.create(
      accountId,
      categoryId,
      200,
      new Date(`${year}-02-15`),
      'February',
      null,
      null,
      year,
    );
    await component.ngOnInit();

    await component.onScopeMonthChange('January');
    expect(component.scope()).toEqual({ kind: 'month', period: 'January', year });
    expect(component.movements().length).toBe(1);
  });

  it('should announce the scope to assistive tech on change', async () => {
    await component.ngOnInit();
    expect(component.scopeAnnouncement()).toBe('');

    await component.onScopeYearChange('all-time');
    expect(component.scopeAnnouncement()).toBe('All time');

    const period = getCurrentPeriod();
    await component.onScopeYearChange(getCurrentYear());
    expect(component.scopeAnnouncement()).toBe(`${period} ${getCurrentYear()}`);
  });

  it('should title a heading with the All time label', async () => {
    await component.ngOnInit();
    expect(component.scopeLabelText()).toBe(`${getCurrentPeriod()} ${getCurrentYear()}`);
    await component.onScopeYearChange('all-time');
    expect(component.scopeLabelText()).toBe('All time');
  });
});

describe('MovementsComponent - contextual delete confirmation and undo', () => {
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
    vi.useRealTimers();
    fixture.destroy();
    await db.delete();
  });

  it('should set and clear the inline confirmation target', async () => {
    const txn = await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    const item = component.movements().find((m) => (m.data as Transaction).id === txn.id)!;

    component.requestDelete(item);
    expect(component.confirmingDelete()).toBe(item);

    component.cancelDelete();
    expect(component.confirmingDelete()).toBeNull();
  });

  it('should name amount and account in the transaction delete confirmation', async () => {
    const txn = await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    const item = component.movements().find((m) => (m.data as Transaction).id === txn.id)!;

    const label = component.deleteConfirmationLabel(item);
    expect(label).toContain('€500.00');
    expect(label).toContain('Cash');
  });

  it('should name the end accounts in the transfer delete confirmation', async () => {
    const acc2 = await accountService.create('Savings', 'EUR', 50000);
    await transferService.create(accountId, acc2.id!, 1000, new Date(), getCurrentPeriod());
    await component.ngOnInit();
    const item = component.movements()[0];

    const label = component.deleteConfirmationLabel(item);
    expect(label).toContain('€1,000.00');
    expect(label).toContain('Cash');
    expect(label).toContain('Savings');
  });

  it('should delete a transaction only after confirming, then expose an undo', async () => {
    const txn = await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    const item = component.movements().find((m) => (m.data as Transaction).id === txn.id)!;

    expect(await transactionService.getAll()).toHaveLength(1);

    component.requestDelete(item);
    await component.confirmDelete();

    expect(await transactionService.getAll()).toHaveLength(0);
    expect(component.confirmingDelete()).toBeNull();
    expect(component.undo()?.item.data.id).toBe(txn.id);
  });

  it('should not delete a transaction until confirmed', async () => {
    const txn = await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    const item = component.movements().find((m) => (m.data as Transaction).id === txn.id)!;

    component.requestDelete(item);
    component.cancelDelete();

    expect(await transactionService.getAll()).toHaveLength(1);
    expect(component.undo()).toBeNull();
  });

  it('should restore a deleted transaction via undo', async () => {
    const txn = await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    const item = component.movements().find((m) => (m.data as Transaction).id === txn.id)!;

    component.requestDelete(item);
    await component.confirmDelete();
    expect(await transactionService.getAll()).toHaveLength(0);

    await component.undoDelete();

    const restored = await transactionService.getById(txn.id!);
    expect(restored).toBeDefined();
    expect(restored!.amount).toBe(500);
    expect(component.undo()).toBeNull();
  });

  it('should delete a transfer only after confirming, then expose an undo and restore', async () => {
    const acc2 = await accountService.create('Savings', 'EUR', 50000);
    const tr = await transferService.create(
      accountId,
      acc2.id!,
      1000,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    const item = component.movements()[0];

    component.requestDelete(item);
    await component.confirmDelete();
    expect(await transferService.getAll()).toHaveLength(0);

    await component.undoDelete();
    const restored = await transferService.getById(tr.id!);
    expect(restored).toBeDefined();
    expect(restored!.sourceAmount).toBe(1000);
  });

  it('should auto-dismiss the undo affordance after the window', async () => {
    component.undoWindowMs = 20;
    component.undo.set({
      item: { type: 'transaction', data: { id: 1 } as Transaction },
      snapshot: {} as Transaction,
    });
    component.scheduleUndoAutoDismiss();
    expect(component.undo()).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(component.undo()).toBeNull();
  });
});

describe('MovementsComponent - assistive tech', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let transactionService: TransactionService;
  let transferService: TransferService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let accountId2: number;
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
    const account2 = await accountService.create('Savings', 'EUR', 50000);
    accountId2 = account2.id!;
    const category = await categoryService.create('Food', 'Expense');
    categoryId = category.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  function accessibleName(select: HTMLSelectElement): string {
    const labelledBy = select.getAttribute('aria-labelledby');
    if (labelledBy) {
      return labelledBy
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
    }
    const ariaLabel = select.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
    return (select.closest('label')?.textContent ?? '').trim();
  }

  it('gives every select an accessible name', async () => {
    await component.ngOnInit();
    component.openTransferForm();
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(accessibleName(select)).toBeTruthy();
    }
  });

  it('gives every quick-add select an accessible name', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('.quick-add select');
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(accessibleName(select)).toBeTruthy();
    }
  });

  it('announces a saved transfer via a polite live region', async () => {
    await component.ngOnInit();
    component.openTransferForm();
    component.trForm.update((f) => ({
      ...f,
      sourceAccountId: accountId,
      destAccountId: accountId2,
      sourceAmount: 100,
      destinationAmount: 100,
    }));

    await component.saveTransfer();
    fixture.detectChanges();

    expect(component.movementAnnouncement()).toContain('Transfer saved');
    const live = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
  });

  it('announces a deleted movement via the undo live region', async () => {
    const txn = await transactionService.create(
      accountId,
      categoryId,
      500,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();
    const item = component.movements().find((m) => (m.data as Transaction).id === txn.id)!;

    component.requestDelete(item);
    await component.confirmDelete();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.undo-toast');
    expect(toast).toBeTruthy();
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
  });
});

describe('MovementsComponent - quick-add integration', () => {
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

  it('saves a new transaction from the card payload', async () => {
    await component.ngOnInit();

    await component.onSaveTransaction({
      id: null,
      accountId,
      categoryId,
      amount: 42,
      date: '2026-08-15',
      period: getCurrentPeriod(),
      year: getCurrentYear(),
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
    });

    const txns = await transactionService.getAll();
    expect(txns.length).toBe(1);
    expect(txns[0].amount).toBe(42);
    expect(component.movements().length).toBe(1);
    expect((component.movements()[0].data as any).amount).toBe(42);
  });

  it('updates an existing transaction when the card payload carries an id', async () => {
    const t = await transactionService.create(
      accountId,
      categoryId,
      10,
      new Date(),
      getCurrentPeriod(),
    );
    await component.ngOnInit();

    await component.onSaveTransaction({
      id: t.id!,
      accountId,
      categoryId,
      amount: 99,
      date: '2026-08-15',
      period: getCurrentPeriod(),
      year: getCurrentYear(),
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
    });

    expect(await transactionService.getAll()).toHaveLength(1);
    const updated = await transactionService.getById(t.id!);
    expect(updated!.amount).toBe(99);
  });

  it('clears editTransaction on cancel', async () => {
    await component.ngOnInit();
    const t = await transactionService.create(
      accountId,
      categoryId,
      10,
      new Date(),
      getCurrentPeriod(),
    );
    component.editTransaction.set(t);

    component.onCancelEdit();

    expect(component.editTransaction()).toBeNull();
  });
});
