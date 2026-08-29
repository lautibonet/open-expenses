import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { NetworkService } from '../../core/services/network.service';
import { db } from '../../core/db/database';
import { defaultScope, getCurrentPeriod, getCurrentYear } from '../../core/types/period.type';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    transactionService = TestBed.inject(TransactionService);
  });

  afterEach(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    await db.delete();
  });

  it('titles the surface Stats, not Dashboard', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading.textContent?.trim()).toBe('Stats');
  });

  it('should format account balance with the account currency', async () => {
    const eur = await accountService.create('Cash', 'EUR', 100000);
    const usd = await accountService.create('USD Account', 'USD', 50000);

    await component.ngOnInit();

    const balances = component.accountBalances();
    const eurBalance = balances.find(b => b.account.id === eur.id);
    const usdBalance = balances.find(b => b.account.id === usd.id);

    expect(eurBalance).toBeDefined();
    expect(usdBalance).toBeDefined();
    expect(component.formatAccountBalance(eurBalance!.balance, eurBalance!.account.currency)).toContain('€');
    expect(component.formatAccountBalance(usdBalance!.balance, usdBalance!.account.currency)).toContain('$');
  });

  it('should keep period totals in base currency', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const cat = await categoryService.create('Payroll', 'Income');
    const period = getCurrentPeriod();
    await transactionService.create(acc.id!, cat.id!, 3000, new Date(), period);

    await component.ngOnInit();

    expect(component.formatMoney(3000)).toContain('€');
    expect(component.totalIncome()).toBe(3000);
  });

  it('should include a Dec-dated movement in the January report of its period year', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 'January', [], null, null, 2026);

    await component.ngOnInit();
    await component.onScopeYearChange(2026);
    await component.onScopeMonthChange('January');

    expect(component.totalIncome()).toBe(3000);
  });

  it('should exclude a Dec-dated movement from the date year report', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 'January', [], null, null, 2026);

    await component.ngOnInit();
    await component.onScopeYearChange(2025);
    await component.onScopeMonthChange('January');

    expect(component.totalIncome()).toBe(0);
  });

  describe('monthly averages follow the page scope', () => {
    it('should derive average income across the months of the scope year', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'Income');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 'January');
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-02-15`), 'February');

      await component.ngOnInit();

      expect(component.avgMonthlyIncome()).toBe(3000);
    });

    it('should keep averaging across the scope year when the scope month changes', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'Income');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 'January');
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-02-15`), 'February');

      await component.ngOnInit();
      await component.onScopeMonthChange('August');

      expect(component.avgMonthlyIncome()).toBe(3000);
    });

    it('should compute average expenses across the scope year', async () => {
      const acc = await accountService.create('Cash', 'EUR', 100000);
      const expenseCat = await categoryService.create('Food', 'Expense');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-01-15`), 'January');
      await transactionService.create(acc.id!, expenseCat.id!, 700, new Date(`${year}-03-15`), 'March');

      await component.ngOnInit();

      expect(component.avgMonthlyExpenses()).toBe(600);
    });

    it('should compute average savings as income minus expenses', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'Income');
      const expenseCat = await categoryService.create('Food', 'Expense');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 'January');
      await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-01-15`), 'January');
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-02-15`), 'February');
      await transactionService.create(acc.id!, expenseCat.id!, 700, new Date(`${year}-02-15`), 'February');

      await component.ngOnInit();

      expect(component.avgMonthlySavings()).toBe(2400);
    });

    it('should compute all-time averages across all months with data', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'Income');

      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-01-15'), 'January');
      await transactionService.create(acc.id!, incomeCat.id!, 4000, new Date('2026-03-15'), 'March');
      await transactionService.create(acc.id!, incomeCat.id!, 2500, new Date('2026-06-15'), 'June');

      await component.ngOnInit();
      await component.onScopeYearChange('all-time');

      expect(component.avgMonthlyIncome()).toBeCloseTo(3166.67, 0);
    });

    it('should show zero averages when no data exists', async () => {
      await component.ngOnInit();
      await component.refreshAverages();

      expect(component.avgMonthlyIncome()).toBe(0);
      expect(component.avgMonthlyExpenses()).toBe(0);
      expect(component.avgMonthlySavings()).toBe(0);
    });

    it('should compute yearly averages against the period year, not the date year', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'Income');
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 'January', [], null, null, 2026);

      await component.ngOnInit();
      await component.onScopeYearChange(2026);

      expect(component.avgMonthlyIncome()).toBe(3000);
    });

    it('should exclude a Dec-dated movement from yearly averages of its date year', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'Income');
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 'January', [], null, null, 2026);

      await component.ngOnInit();
      await component.onScopeYearChange(2025);

      expect(component.avgMonthlyIncome()).toBe(0);
    });
  });

  describe('totalBalanceBaseCurrency', () => {
    let networkService: NetworkService;

    beforeEach(() => {
      networkService = TestBed.inject(NetworkService);
    });

    it('should sum all account balances when all are in base currency', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('Savings', 'EUR', 500000);

      await component.ngOnInit();

      expect(component.totalBalanceBaseCurrency()).toBe(600000);
    });

    it('should convert non-base currency accounts using latest exchange rate', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('USD Account', 'USD', 50000);

      const mockResponse = {
        ok: true,
        json: async () => [
          { base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 1.08 },
        ],
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

      await component.ngOnInit();

      // USD 50000 converted to EUR: 50000 / 1.08 = 46296.30
      const expected = 100000 + Math.round(50000 / 1.08 * 100) / 100;
      expect(component.totalBalanceBaseCurrency()).toBeCloseTo(expected, 0);
    });

    it('should format total balance in base currency', async () => {
      await accountService.create('Cash', 'EUR', 100000);

      await component.ngOnInit();

      expect(component.formatMoney(component.totalBalanceBaseCurrency())).toContain('€');
    });

    it('should handle initial balance conversion in multi-currency scenario', async () => {
      const usd = await accountService.create('USD Account', 'USD', 100000);

      const mockResponse = {
        ok: true,
        json: async () => [
          { base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 1.1 },
        ],
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

      const period = getCurrentPeriod();
      const incomeCat = await categoryService.create('Payroll', 'Income');
      await transactionService.create(usd.id!, incomeCat.id!, 5000, new Date(), period);

      await component.ngOnInit();

      // baseAmount = 100000/1.1 + 5000/1.1 = 105000/1.1
      const expected = Math.round(105000 / 1.1 * 100) / 100;
      expect(component.totalBalanceBaseCurrency()).toBeCloseTo(expected, 0);
    });

    it('should return 0 when offline and no base currency accounts exist', async () => {
      await accountService.create('USD Account', 'USD', 50000);
      networkService.isOnline.set(false);

      await component.ngOnInit();

      expect(component.totalBalanceBaseCurrency()).toBe(0);
    });

    it('should still include base currency accounts when offline', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('USD Account', 'USD', 50000);
      networkService.isOnline.set(false);

      await component.ngOnInit();

      // Only the EUR account contributes when offline
      expect(component.totalBalanceBaseCurrency()).toBe(100000);
    });

    it('should set conversionFailed when offline with multi-currency accounts', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('USD Account', 'USD', 50000);
      networkService.isOnline.set(false);

      await component.ngOnInit();

      expect(component.conversionFailed()).toBe(true);
    });

    it('should set conversionFailed when API call fails', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('USD Account', 'USD', 50000);

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await component.ngOnInit();

      expect(component.conversionFailed()).toBe(true);
    });

    it('should not set conversionFailed when all accounts are base currency', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('Savings', 'EUR', 50000);

      await component.ngOnInit();

      expect(component.conversionFailed()).toBe(false);
    });

    it('should not set conversionFailed when conversion succeeds', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('USD Account', 'USD', 50000);

      const mockResponse = {
        ok: true,
        json: async () => [
          { base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 1.08 },
        ],
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

      await component.ngOnInit();

      expect(component.conversionFailed()).toBe(false);
    });
  });
});

describe('DashboardComponent - shared scope', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    transactionService = TestBed.inject(TransactionService);
  });

  afterEach(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    await db.delete();
  });

  it('should default to the current month scope', async () => {
    await component.ngOnInit();
    expect(component.scope()).toEqual(defaultScope());
  });

  it('should derive year options from the data range, not a fixed window', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2012-01-15'), 'January', [], null, null, 2012);
    await transactionService.create(acc.id!, incomeCat.id!, 5000, new Date('2016-03-15'), 'March', [], null, null, 2016);

    await component.ngOnInit();

    expect(component.scopeYears()).toEqual(expect.arrayContaining([2012, 2016, getCurrentYear()]));
  });

  it('should derive month options from the months actually present in data', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2026-01-15'), 'January');
    await transactionService.create(acc.id!, incomeCat.id!, 5000, new Date('2026-05-15'), 'May');

    await component.ngOnInit();

    expect(component.scopeMonths()).toContain('January');
    expect(component.scopeMonths()).toContain('May');
  });

  it('should compute All time totals across every period present in the data', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2012-01-15'), 'January', [], null, null, 2012);
    await transactionService.create(acc.id!, incomeCat.id!, 4000, new Date('2026-03-15'), 'March');

    await component.ngOnInit();
    expect(component.totalIncome()).toBe(0);

    await component.onScopeYearChange('all-time');

    expect(component.scope().kind).toBe('all-time');
    expect(component.totalIncome()).toBe(7000);
  });

  it('should include movements older than ten years in All time totals', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    const oldYear = getCurrentYear() - 20;
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${oldYear}-01-15`), 'January', [], null, null, oldYear);

    await component.ngOnInit();
    await component.onScopeYearChange('all-time');

    expect(component.totalIncome()).toBe(3000);
  });

  it('should announce the scope to assistive tech on change', async () => {
    await component.ngOnInit();
    expect(component.scopeAnnouncement()).toBe('');

    await component.onScopeYearChange('all-time');
    expect(component.scopeAnnouncement()).toBe('All time');
  });

  it('should label the totals card with the current scope', async () => {
    await component.ngOnInit();
    expect(component.scopeLabelText()).toBe(`${getCurrentPeriod()} ${getCurrentYear()}`);

    await component.onScopeYearChange('all-time');
    expect(component.scopeLabelText()).toBe('All time');
  });

  it('should render exactly two scope selects and no extra averages dropdown', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('select');
    expect(selects.length).toBe(2);

    const labels = Array.from(selects as NodeListOf<HTMLSelectElement>).map(s => s.getAttribute('aria-label'));
    expect(labels).toContain('Scope year');
    expect(labels).toContain('Scope month');
  });

  it('should hide the month selector for All time when month adds no meaning', async () => {
    await component.ngOnInit();
    await component.onScopeYearChange('all-time');
    fixture.detectChanges();

    const monthSelect = fixture.nativeElement.querySelector('select[aria-label="Scope month"]');
    expect(monthSelect).toBeNull();
  });

  it('should name the scope in every card heading', async () => {
    await component.ngOnInit();
    await component.onScopeYearChange('all-time');
    fixture.detectChanges();

    const headings = Array.from(fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>);
    expect(headings.length).toBeGreaterThan(0);
    for (const h of headings) {
      expect(h.textContent).toContain('All time');
    }
  });

  it('should render the page heading as an h1', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    const headings = fixture.nativeElement.querySelectorAll('h1');
    expect(headings.length).toBe(1);
  });

  it('should color Net with the information ink, not income or expense green', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const net = fixture.nativeElement.querySelector('.stat .value.information');
    expect(net).toBeTruthy();
    expect(component.netIncome()).toBe(3000);
  });

  it('should color Avg Monthly Savings with the information ink, not income or expense green', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const savingsValues = fixture.nativeElement.querySelectorAll('.stat .value.information');
    expect(savingsValues.length).toBeGreaterThanOrEqual(1);
  });

  it('should compute all-time balances across every period present in the data', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    const expenseCat = await categoryService.create('Food', 'Expense');

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2012-01-15'), 'January', [], null, null, 2012);
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date('2026-03-15'), 'March');

    await component.ngOnInit();
    await component.onScopeYearChange('all-time');

    expect(component.totalIncome()).toBe(3000);
    expect(component.totalExpenses()).toBe(500);
    expect(component.netIncome()).toBe(2500);
  });

  it('should keep a numeric year scope when switching from All time back to a year', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    const year = getCurrentYear();
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const yearSelect = fixture.nativeElement.querySelector('select[aria-label="Scope year"]') as HTMLSelectElement;
    const flush = () => new Promise<void>(resolve => setTimeout(resolve, 10));

    const allTimeOption = Array.from(yearSelect.options).find(o => o.textContent?.trim() === 'All time')!;
    yearSelect.value = allTimeOption.value;
    yearSelect.dispatchEvent(new Event('change'));
    await flush();
    fixture.detectChanges();
    expect(component.scope().kind).toBe('all-time');
    expect(component.totalIncome()).toBe(3000);

    const yearOption = Array.from(yearSelect.options).find(o => o.textContent?.trim() === String(year))!;
    yearSelect.value = yearOption.value;
    yearSelect.dispatchEvent(new Event('change'));
    await flush();
    fixture.detectChanges();

    expect(component.scope()).toEqual({ kind: 'month', period: getCurrentPeriod(), year });
    expect(component.totalIncome()).toBe(3000);
    expect(component.totalExpenses()).toBe(0);
    expect(component.netIncome()).toBe(3000);
  });
});
