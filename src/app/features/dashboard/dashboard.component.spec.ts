import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { NetworkService } from '../../core/services/network.service';
import { LanguageService } from '../../core/services/language.service';
import { DataVersionService } from '../../core/services/data-version.service';
import { db } from '../../core/db/database';
import { MONTH_NAMES, defaultScope, getCurrentPeriod, getCurrentYear } from '../../core/types/period.type';

/** Keep the Dexie connection open for the whole file and just clear the
 * tables between tests. Closing/recreating the db (delete + open) aborts
 * whatever component chain Angular's change detection started but the test
 * never awaited (ngOnInit is also invoked by the first detectChanges), and
 * that abort surfaces as an unhandled DatabaseClosedError. */
async function resetDb(): Promise<void> {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;

  beforeEach(async () => {
    await resetDb();
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
    await resetDb();
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

  it('should keep year totals in base currency', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const cat = await categoryService.create('Payroll', 'income');
    const period = getCurrentPeriod();
    await transactionService.create(acc.id!, cat.id!, 3000, new Date(), period);

    await component.ngOnInit();

    expect(component.formatMoney(3000)).toContain('€');
    expect(component.yearTotalIncome()).toBe(3000);
  });

  it('should include a Dec-dated movement in the selected year report of its period year', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 1, null, null, 2026);

    await component.ngOnInit();
    await component.onScopeYearChange(2026);
    await component.onScopeMonthChange(1);

    expect(component.yearTotalIncome()).toBe(3000);
  });

  it('should exclude a Dec-dated movement from the date year report', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 1, null, null, 2026);

    await component.ngOnInit();
    await component.onScopeYearChange(2025);
    await component.onScopeMonthChange(1);

    expect(component.yearTotalIncome()).toBe(0);
  });

  describe('monthly averages follow the page scope', () => {
    it('should derive average income across the months of the scope year', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'income');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1);
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-02-15`), 2);

      await component.ngOnInit();

      expect(component.avgMonthlyIncome()).toBe(3000);
    });

    it('should keep averaging across the scope year when the scope month changes', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'income');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1);
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-02-15`), 2);

      await component.ngOnInit();
      await component.onScopeMonthChange(8);

      expect(component.avgMonthlyIncome()).toBe(3000);
    });

    it('should compute average expenses across the scope year', async () => {
      const acc = await accountService.create('Cash', 'EUR', 100000);
      const expenseCat = await categoryService.create('Food', 'expense');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-01-15`), 1);
      await transactionService.create(acc.id!, expenseCat.id!, 700, new Date(`${year}-03-15`), 3);

      await component.ngOnInit();

      expect(component.avgMonthlyExpenses()).toBe(600);
    });

    it('should compute average savings as income minus expenses', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'income');
      const expenseCat = await categoryService.create('Food', 'expense');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1);
      await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-01-15`), 1);
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-02-15`), 2);
      await transactionService.create(acc.id!, expenseCat.id!, 700, new Date(`${year}-02-15`), 2);

      await component.ngOnInit();

      expect(component.avgMonthlyNet()).toBe(2400);
    });

    it('should show zero averages when no data exists', async () => {
      await component.ngOnInit();
      await component.refreshAverages();

      expect(component.avgMonthlyIncome()).toBe(0);
      expect(component.avgMonthlyExpenses()).toBe(0);
      expect(component.avgMonthlyNet()).toBe(0);
    });

    it('should compute yearly averages against the period year, not the date year', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'income');
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 1, null, null, 2026);

      await component.ngOnInit();
      await component.onScopeYearChange(2026);

      expect(component.avgMonthlyIncome()).toBe(3000);
    });

    it('should exclude a Dec-dated movement from yearly averages of its date year', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'income');
      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 1, null, null, 2026);

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
      const incomeCat = await categoryService.create('Payroll', 'income');
      await transactionService.create(usd.id!, incomeCat.id!, 5000, new Date(), period);

      await component.ngOnInit();

      // Initial balance converts at the latest rate; the movement without a
      // stored conversion counts at its face amount (no read-time conversion).
      const expected = Math.round(100000 / 1.1 * 100) / 100 + 5000;
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

    it('should flag excluded accounts when offline with multi-currency accounts', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('USD Account', 'USD', 50000);
      networkService.isOnline.set(false);

      await component.ngOnInit();

      expect(component.conversionDegraded().accountsExcluded).toBe(true);
    });

    it('should flag excluded accounts when API call fails', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('USD Account', 'USD', 50000);

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await component.ngOnInit();

      expect(component.conversionDegraded().accountsExcluded).toBe(true);
    });

    it('should flag no degradation when all accounts are base currency', async () => {
      await accountService.create('Cash', 'EUR', 100000);
      await accountService.create('Savings', 'EUR', 50000);

      await component.ngOnInit();

      expect(component.conversionDegraded()).toEqual({
        accountsExcluded: false,
        unconvertedTransactions: false,
      });
    });

    it('should flag no degradation when conversion succeeds', async () => {
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

      expect(component.conversionDegraded()).toEqual({
        accountsExcluded: false,
        unconvertedTransactions: false,
      });
    });
  });
});

describe('DashboardComponent - period-end balances', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;
  let transferService: TransferService;

  beforeEach(async () => {
    await resetDb();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    transactionService = TestBed.inject(TransactionService);
    transferService = TestBed.inject(TransferService);
  });

  afterEach(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    await resetDb();
  });

  it('shows balances as of the end of the selected Period', async () => {
    const acc = await accountService.create('Cash', 'EUR', 1000);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod(), null, null, year);
    await transactionService.create(acc.id!, incomeCat.id!, 700, new Date(), 12, null, null, year);

    await component.ngOnInit();
    expect(component.accountBalances().find(b => b.account.id === acc.id)!.balance).toBe(4000);
    expect(component.totalBalanceBaseCurrency()).toBe(4000);

    await component.onScopeMonthChange(12);
    expect(component.accountBalances().find(b => b.account.id === acc.id)!.balance).toBe(4700);
    expect(component.totalBalanceBaseCurrency()).toBe(4700);
  });

  it('shows initial balances only for Periods before any movement', async () => {
    const acc = await accountService.create('Cash', 'EUR', 100000);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod(), null, null, year);

    await component.ngOnInit();
    await component.onScopeYearChange(year - 1);
    await component.onScopeMonthChange(1);

    expect(component.accountBalances().find(b => b.account.id === acc.id)!.balance).toBe(100000);
    expect(component.totalBalanceBaseCurrency()).toBe(100000);
  });

  it('keeps an empty future Period at the last non-empty balance', async () => {
    const acc = await accountService.create('Cash', 'EUR', 1000);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), 1, null, null, year);

    await component.ngOnInit();
    const atCurrent = component.totalBalanceBaseCurrency();

    await component.onScopeMonthChange(12);
    expect(component.accountBalances().find(b => b.account.id === acc.id)!.balance).toBe(4000);
    expect(component.totalBalanceBaseCurrency()).toBe(atCurrent);
  });

  it('reproduces the all-time figure when the latest Period is selected (regression)', async () => {
    const a = await accountService.create('Cash', 'EUR', 1000);
    const b = await accountService.create('Savings', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(a.id!, incomeCat.id!, 3000, new Date(), 1, null, null, year - 1);
    await transactionService.create(a.id!, expenseCat.id!, 500, new Date(), 6, null, null, year);
    await transferService.create(a.id!, b.id!, 300, new Date(), 3, '', 1, year);

    await component.ngOnInit();
    await component.onScopeYearChange(year);
    await component.onScopeMonthChange(getCurrentPeriod());

    const balances = component.accountBalances();
    expect(balances.find(x => x.account.id === a.id)!.balance).toBe(3200);
    expect(balances.find(x => x.account.id === b.id)!.balance).toBe(300);
    expect(component.totalBalanceBaseCurrency()).toBe(3500);
  });

  it('reproduces the all-time figure for cross-currency accounts via stored conversions', async () => {
    const eur = await accountService.create('Cash', 'EUR', 1000);
    const usd = await accountService.create('USD Account', 'USD', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    // Stored at capture time: 100 USD at 1.08 = 108 EUR.
    await transactionService.create(usd.id!, incomeCat.id!, 100, new Date(), 2, 1.08, 108, year);
    await transactionService.create(eur.id!, expenseCat.id!, 200, new Date(), 5, null, null, year);

    const mockResponse = {
      ok: true,
      json: async () => [
        { base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 2.0 },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    await component.ngOnInit();
    await component.onScopeMonthChange(getCurrentPeriod());

    // All-time: 1000 - 200 + 108 (stored) = 908, not 1000 - 200 + 50 (read-time).
    expect(component.totalBalanceBaseCurrency()).toBe(908);
  });

  it('totals cross-currency balances using stored conversions, not read-time re-conversion', async () => {
    const usd = await accountService.create('USD Account', 'USD', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const period = getCurrentPeriod();

    // Stored at capture time: 100 USD at 1.08 = 108 EUR.
    await transactionService.create(usd.id!, incomeCat.id!, 100, new Date(), period, 1.08, 108);

    // Latest rate would re-convert 100 USD at 2.0 = 50; the stored 108 must win.
    const mockResponse = {
      ok: true,
      json: async () => [
        { base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 2.0 },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    await component.ngOnInit();

    expect(component.totalBalanceBaseCurrency()).toBe(108);
  });
});

describe('DashboardComponent - shared scope', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;

  beforeEach(async () => {
    await resetDb();
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
    await resetDb();
  });

  it('should default to the current month scope', async () => {
    await component.ngOnInit();
    expect(component.scope()).toEqual(defaultScope());
  });

  it('should derive year options from the data range, not a fixed window', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2012-01-15'), 1, null, null, 2012);
    await transactionService.create(acc.id!, incomeCat.id!, 5000, new Date('2016-03-15'), 3, null, null, 2016);

    await component.ngOnInit();

    expect(component.scopeYears()).toEqual(expect.arrayContaining([2012, 2016, getCurrentYear()]));
  });

  it('should derive month options from the months actually present in data', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2026-01-15'), 1);
    await transactionService.create(acc.id!, incomeCat.id!, 5000, new Date('2026-05-15'), 5);

    await component.ngOnInit();

    expect(component.scopeMonths()).toContain(1);
    expect(component.scopeMonths()).toContain(5);
  });

  it('should show only the selected year totals', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2012-01-15'), 1, null, null, 2012);
    await transactionService.create(acc.id!, incomeCat.id!, 4000, new Date(`${year}-03-15`), 3);

    await component.ngOnInit();
    expect(component.yearTotalIncome()).toBe(4000);

    await component.onScopeYearChange(2012);
    await component.onScopeMonthChange(1);

    expect(component.scope()).toEqual({ kind: 'month', period: 1, year: 2012 });
    expect(component.yearTotalIncome()).toBe(3000);
  });

  it('should include movements older than ten years when their year is selected', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const oldYear = getCurrentYear() - 20;
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${oldYear}-01-15`), 1, null, null, oldYear);

    await component.ngOnInit();
    await component.onScopeYearChange(oldYear);
    await component.onScopeMonthChange(1);

    expect(component.yearTotalIncome()).toBe(3000);
  });

  it('should announce the scope to assistive tech on change', async () => {
    await component.ngOnInit();
    expect(component.scopeAnnouncement()).toBe('');

    const period = getCurrentPeriod();
    await component.onScopeYearChange(getCurrentYear() - 1);
    expect(component.scopeAnnouncement()).toBe(
      `${MONTH_NAMES[period - 1]} ${getCurrentYear() - 1}`,
    );
  });

  it('should label the totals card with the current scope', async () => {
    await component.ngOnInit();
    expect(component.scopeLabelText()).toBe(
      `${MONTH_NAMES[getCurrentPeriod() - 1]} ${getCurrentYear()}`,
    );
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

  it('should name the scope in every card heading', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const expectedLabel = `${MONTH_NAMES[getCurrentPeriod() - 1]} ${getCurrentYear()}`;
    const headings = Array.from(fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>);
    expect(headings.length).toBeGreaterThan(0);
    for (const h of headings) {
      expect(h.textContent).toContain(expectedLabel);
    }
  });

  it('should render the page heading as an h1', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    const headings = fixture.nativeElement.querySelectorAll('h1');
    expect(headings.length).toBe(1);
  });

  it('renders Net as the inverted savings KPI card', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const net = fixture.nativeElement.querySelector('.kpi-card.kpi-net .value');
    expect(net).toBeTruthy();
    expect(net.textContent).toContain(component.formatMoney(component.yearTotalNet()));
    expect(component.yearTotalNet()).toBe(2500);
  });

  it('renders the KPI row as three cards: income, expenses, net', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.kpi-row .kpi-card');
    expect(cards.length).toBe(3);
    expect(fixture.nativeElement.querySelector('.kpi-card.kpi-income .value')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kpi-card.kpi-expense .value')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kpi-card.kpi-net .value')).toBeTruthy();
  });

  it('renders the year total as the KPI headline with the monthly average beneath', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1);
    await transactionService.create(acc.id!, incomeCat.id!, 2000, new Date(`${year}-02-15`), 2);
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-01-15`), 1);

    await component.ngOnInit();
    fixture.detectChanges();

    const incomeValue = fixture.nativeElement.querySelector('.kpi-card.kpi-income .value');
    expect(incomeValue.textContent).toContain(component.formatMoney(5000));

    const incomeSecondary = fixture.nativeElement.querySelector('.kpi-card.kpi-income .secondary');
    expect(incomeSecondary.textContent).toContain('AVG');
    expect(incomeSecondary.textContent).toContain(component.formatMoney(2500));

    const netValue = fixture.nativeElement.querySelector('.kpi-card.kpi-net .value');
    expect(netValue.textContent).toContain(component.formatMoney(4500));
  });

  it('hides the average line when the scope year has no data', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const incomeValue = fixture.nativeElement.querySelector('.kpi-card.kpi-income .value');
    expect(incomeValue.textContent).toContain(component.formatMoney(0));
    expect(fixture.nativeElement.querySelector('.kpi-card.kpi-income .secondary')).toBeNull();
    expect(fixture.nativeElement.querySelector('.kpi-card.kpi-net .secondary')).toBeNull();
  });

  it('visually states the scope year as a caps label on every KPI card', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const scopes = Array.from(
      fixture.nativeElement.querySelectorAll('.kpi-card dt .scope') as NodeListOf<HTMLElement>,
    );
    expect(scopes.length).toBe(3);
    for (const scope of scopes) {
      expect(scope.textContent).toContain(String(getCurrentYear()));
      expect(scope.textContent).toContain('YEAR TO DATE');
    }
  });

  it('keeps the KPI scope label in sync when the scope year changes', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    const previousYear = getCurrentYear() - 1;
    await component.onScopeYearChange(previousYear);
    fixture.detectChanges();

    const scope = fixture.nativeElement.querySelector('.kpi-card.kpi-income dt .scope');
    expect(scope.textContent).toContain(String(previousYear));
  });

  it('associates each KPI label, year and value in a definition list per card', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('dl.kpi-card') as NodeListOf<HTMLDListElement>,
    );
    expect(cards.length).toBe(3);

    for (const card of cards) {
      const terms = card.querySelectorAll('dt');
      expect(terms.length).toBe(1);
      const term = terms[0];
      expect(term.textContent).toContain(String(getCurrentYear()));

      const value = card.querySelector('dd.value');
      expect(value).toBeTruthy();
      expect(value!.textContent?.trim()).not.toBe('');
    }

    const incomeCard = fixture.nativeElement.querySelector('dl.kpi-card.kpi-income');
    expect(incomeCard.querySelector('dt').textContent).toContain('Income');
    expect(incomeCard.querySelector('dd.value').textContent).toContain(
      component.formatMoney(component.yearTotalIncome()),
    );
  });

  it('hides the savings rate when there is no income', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kpi-net .savings-rate')).toBeNull();
  });

  it('shows the savings rate in the net average card when there is income', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kpi-net .savings-rate')).toBeTruthy();
  });

  it('computes the savings rate from the existing monthly averages', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(), getCurrentPeriod());

    await component.ngOnInit();

    expect(component.savingsRate()).toBe(83);
  });

  it('returns a null savings rate when there is no income', async () => {
    await component.ngOnInit();
    expect(component.savingsRate()).toBeNull();
  });

  it('should switch scope by year via the select', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const yearSelect = fixture.nativeElement.querySelector('select[aria-label="Scope year"]') as HTMLSelectElement;
    const flush = () => new Promise<void>(resolve => setTimeout(resolve, 10));

    const yearOption = Array.from(yearSelect.options).find(o => o.textContent?.trim() === String(year))!;
    yearSelect.value = yearOption.value;
    yearSelect.dispatchEvent(new Event('change'));
    await flush();
    fixture.detectChanges();

    expect(component.scope()).toEqual({ kind: 'month', period: getCurrentPeriod(), year });
    expect(component.yearTotalIncome()).toBe(3000);
    expect(component.yearTotalExpenses()).toBe(0);
    expect(component.yearTotalNet()).toBe(3000);
  });
});

describe('DashboardComponent - page header, scope control and restyled cards', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;
  let networkService: NetworkService;

  beforeEach(async () => {
    await resetDb();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    transactionService = TestBed.inject(TransactionService);
    networkService = TestBed.inject(NetworkService);
  });

  afterEach(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    await resetDb();
  });

  async function scopeTo(period: number, year: number): Promise<void> {
    await component.onScopeYearChange(year);
    await component.onScopeMonthChange(period);
  }

  it('renders the display headline with its subtitle', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const h1 = fixture.nativeElement.querySelector('.page-header h1');
    expect(h1).toBeTruthy();
    expect(h1.textContent.trim()).toBe('Stats');

    const subtitle = fixture.nativeElement.querySelector('.page-header .subtitle');
    expect(subtitle.textContent.trim()).toBe('Your totals, averages and balances at a glance.');
  });

  it('keeps accessible names on the year and month scope selects', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('select[aria-label="Scope year"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('select[aria-label="Scope month"]')).toBeTruthy();
  });

  it('renders plain month and year selects with no chevron stepper', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.step-btn').length).toBe(0);
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Previous month"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Next month"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.scope-selects select')).toBeTruthy();
  });

  it('refreshes averages when the scope month changes, keeping the year-average semantics', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1);
    await transactionService.create(acc.id!, incomeCat.id!, 6000, new Date(`${year}-02-15`), 2);

    await component.ngOnInit();
    await scopeTo(1, year);
    expect(component.avgMonthlyIncome()).toBe(4500);

    await component.onScopeMonthChange(2);
    expect(component.scope()).toEqual({ kind: 'month', period: 2, year });
    expect(component.avgMonthlyIncome()).toBe(4500);
  });

  it('renders category totals as pure CSS horizontal bars', async () => {
    const acc = await accountService.create('Cash', 'EUR', 100000);
    const food = await categoryService.create('Food', 'expense');
    const rent = await categoryService.create('Rent', 'expense');
    const period = getCurrentPeriod();

    await transactionService.create(acc.id!, rent.id!, 1500, new Date(), period);
    await transactionService.create(acc.id!, food.id!, 500, new Date(), period);

    await component.ngOnInit();
    fixture.detectChanges();

    const tracks = fixture.nativeElement.querySelectorAll('.category-bar-row .bar-track');
    const fills = fixture.nativeElement.querySelectorAll('.category-bar-row .bar-fill');
    expect(tracks.length).toBe(2);
    expect(fills.length).toBe(2);

    // Largest category first, bar at 100%; the second at its relative share.
    expect(fills[0].style.width).toBe('100%');
    expect(Number.parseFloat(fills[1].style.width)).toBeCloseTo(33.33, 1);

    // No chart dependency: bars are plain divs.
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
  });

  it('computes category bar widths relative to the largest category', async () => {
    await component.categoryBreakdown.set([
      { name: 'Rent', total: 1500 },
      { name: 'Food', total: 500 },
    ]);

    expect(component.categoryBarWidth(1500)).toBe(100);
    expect(component.categoryBarWidth(500)).toBeCloseTo(33.33, 2);
  });

  it('shows negative account balances on error tiles', async () => {
    await accountService.create('Cash', 'EUR', 100000);
    const credit = await accountService.create('Credit Card', 'EUR', 0);
    const expenseCat = await categoryService.create('Card Spend', 'expense');
    await transactionService.create(credit.id!, expenseCat.id!, 124000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.balance-row');
    expect(rows.length).toBe(2);

    const negative = fixture.nativeElement.querySelectorAll('.balance-row.negative');
    expect(negative.length).toBe(1);
    expect(negative[0].querySelector('.balance-tile')).toBeTruthy();
    expect(negative[0].textContent).toContain('Credit Card');
    expect(component.accountBalances().find(b => b.account.id === credit.id)!.balance).toBeLessThan(0);
  });

  it('keeps positive balances off the error tiles', async () => {
    await accountService.create('Cash', 'EUR', 100000);

    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.balance-row').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.balance-row.negative')).toBeNull();
  });

  it('renders the conversion-failure warning on the error ramp when offline', async () => {
    await accountService.create('Cash', 'EUR', 100000);
    await accountService.create('USD Account', 'USD', 50000);
    networkService.isOnline.set(false);

    await component.ngOnInit();
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.conversion-warning');
    expect(warning).toBeTruthy();
    expect(warning.textContent).toContain('EUR');
  });

  it('hides the conversion warning when every account is in base currency', async () => {
    await accountService.create('Cash', 'EUR', 100000);

    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.conversion-warning .alert')).toBeNull();
  });

  it('dismisses the conversion warning and keeps it hidden while the failure persists', async () => {
    await accountService.create('Cash', 'EUR', 100000);
    await accountService.create('USD Account', 'USD', 50000);
    networkService.isOnline.set(false);

    await component.ngOnInit();
    fixture.detectChanges();

    const dismiss = fixture.nativeElement.querySelector(
      '.conversion-warning .alert-dismiss',
    ) as HTMLButtonElement;
    expect(dismiss).toBeTruthy();
    dismiss.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.conversion-warning .alert')).toBeNull();
  });
});

describe('DashboardComponent - translations', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  beforeEach(async () => {
    await resetDb();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    await resetDb();
  });

  it('renders in Spanish when the active Language is Spanish', async () => {
    const acc = await TestBed.inject(AccountService).create('Cash', 'EUR', 100000);
    const cat = await TestBed.inject(CategoryService).create('Comida', 'expense');
    await TestBed.inject(TransactionService).create(acc.id!, cat.id!, 500, new Date(), getCurrentPeriod());

    await TestBed.inject(LanguageService).setLanguage('es');
    await component.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Estadísticas');
    expect(text).toContain('Tus totales, medias y saldos de un vistazo.');
    expect(text).toContain('Gastos de');
    expect(text).toContain('Ingresos');
    expect(text).toContain('Gastos');
    expect(text).toContain('Neto');
    expect(text).toContain('MEDIA');
    expect(text).toContain('Saldo total de');
    expect(text).toContain('Saldos de cuentas de');
    expect(fixture.nativeElement.querySelector('[aria-label="Ámbito: año"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Ámbito: mes"]')).toBeTruthy();
  });

  it('re-renders in Spanish immediately when the Language changes after render', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Stats');

    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Estadísticas');
  });
});

describe('DashboardComponent - KPI row layout and mono weights', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;

  beforeEach(async () => {
    await resetDb();
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
    await resetDb();
  });

  async function renderWithData(): Promise<void> {
    const acc = await accountService.create('Cash', 'EUR', 100000);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    // Six-figure yearly total: "1.234.567,89 EUR" — the widest headline the
    // grid must absorb without widening the row.
    await transactionService.create(acc.id!, incomeCat.id!, 123456789, new Date(), getCurrentPeriod());
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();
  }

  function compiledComponentCss(): string {
    return Array.from(document.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
  }

  // jsdom does no layout, so row alignment can't be asserted geometrically;
  // the shrinkable-track declaration in the compiled stylesheet is the seam.
  it('keeps the KPI row tracks shrinkable so wide figures cannot widen the row', async () => {
    await renderWithData();

    const css = compiledComponentCss();
    expect(css).toMatch(/\.kpi-row[^{]*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/@media[^{]*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('renders every mono figure on Stats at the data spec weight (500, no faux bold)', async () => {
    await renderWithData();

    const figures = [
      '.kpi-card.kpi-income .value',
      '.kpi-card.kpi-expense .value',
      '.kpi-card.kpi-net .value',
      '.kpi-card .secondary',
      '.kpi-card .savings-rate',
      '.stat .value',
      '.category-bar-row .cat-amount',
      '.balance-tile',
      '.balance-amount',
    ] as const;

    for (const selector of figures) {
      const el = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
      expect(el, selector).toBeTruthy();
      expect(getComputedStyle(el!).fontWeight, selector).toBe('500');
    }
  });
});

describe('DashboardComponent - year spine (12-month Net strip)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;
  let languageService: LanguageService;

  beforeEach(async () => {
    await resetDb();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    transactionService = TestBed.inject(TransactionService);
    languageService = TestBed.inject(LanguageService);
  });

  afterEach(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    await resetDb();
  });

  function compiledComponentCss(): string {
    return Array.from(document.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
  }

  async function seedMovement(period: number, amount = 3000): Promise<void> {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(
      acc.id!, incomeCat.id!, amount, new Date(), period, null, null, getCurrentYear(),
    );
  }

  it('renders one track for each of the 12 Periods of the scope year', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const months = fixture.nativeElement.querySelectorAll('.net-strip .net-strip-month');
    expect(months.length).toBe(12);
  });

  it('scales both fills against the year max magnitude, positive up and negative down', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 1500, new Date(`${year}-02-15`), 2, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    const january = fixture.nativeElement.querySelector('.net-strip-month:nth-child(1)');
    const janFill = january.querySelector('.net-fill.up');
    expect(janFill).toBeTruthy();
    expect(janFill.style.height).toBe('50%');

    const february = fixture.nativeElement.querySelector('.net-strip-month:nth-child(2)');
    const febFill = february.querySelector('.net-fill.down');
    expect(febFill).toBeTruthy();
    expect(febFill.style.height).toBe('25%');
  });

  it('leaves zero-Net Periods visible as empty tracks', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    const emptyTrack = fixture.nativeElement.querySelector(
      '.net-strip-month:nth-child(7) .net-track',
    );
    expect(emptyTrack).toBeTruthy();
    expect(emptyTrack.querySelector('.net-fill')).toBeNull();
  });

  it('keeps negative Periods in ink — the strip never reaches for the error ramp', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const css = compiledComponentCss();
    expect(css).toMatch(/\.net-fill[^{]*\{[^}]*background:\s*var\(--on-surface\)/);

    const stripRules = css.match(/\.net-strip[^{]*\{[^}]*\}/g)?.join('\n') ?? '';
    expect(stripRules).not.toContain('--error');
  });

  it('marks the scope Period as the current one', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const currentPeriod = getCurrentPeriod();
    const current = fixture.nativeElement.querySelector(
      `.net-strip .net-strip-month:nth-child(${currentPeriod})`,
    );
    expect(current.classList).toContain('current');

    const others = fixture.nativeElement.querySelectorAll(
      '.net-strip .net-strip-month:not(:nth-child(' + currentPeriod + '))',
    );
    for (const other of others) {
      expect(other.classList).not.toContain('current');
    }
  });

  it('shows the strip zero state, not an empty block, when the scope year has no movements', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.net-strip')).toBeNull();
    const zero = fixture.nativeElement.querySelector('.net-strip-zero');
    expect(zero).toBeTruthy();
    expect(zero.textContent).toContain(String(getCurrentYear()));
  });

  it('announces month + Net per Period in an accessible equivalent', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-02-15`), 2, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('.net-strip-figures');
    expect(list).toBeTruthy();
    expect(list.classList).toContain('visually-hidden');

    const items = Array.from(list.querySelectorAll('li') as NodeListOf<HTMLLIElement>);
    expect(items.length).toBe(12);
    expect(items[0].textContent).toContain('January');
    expect(items[0].textContent).toContain(component.formatMoney(3000));
    expect(items[1].textContent).toContain('February');
    expect(items[1].textContent).toContain(component.formatMoney(-500));
  });

  it('takes month initials from the Language service, correct in both Languages', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    let initials = Array.from(
      fixture.nativeElement.querySelectorAll('.net-strip .net-initial') as NodeListOf<HTMLElement>,
    ).map(el => el.textContent?.trim());
    expect(initials).toEqual(['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']);

    await languageService.setLanguage('es');
    fixture.detectChanges();

    initials = Array.from(
      fixture.nativeElement.querySelectorAll('.net-strip .net-initial') as NodeListOf<HTMLElement>,
    ).map(el => el.textContent?.trim());
    expect(initials).toEqual(['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']);
  });

  it('follows the scope year when the Scope changes', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);
    await transactionService.create(acc.id!, incomeCat.id!, 4000, new Date('2012-03-15'), 3, null, null, 2012);

    await component.ngOnInit();
    await component.onScopeYearChange(2012);
    await component.onScopeMonthChange(3);

    expect(component.yearNets().find(n => n.period === 3)!.net).toBe(4000);
    expect(component.yearNets().find(n => n.period === 1)!.net).toBe(0);
  });
});

describe('DashboardComponent - conversion degradation warnings', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;
  let networkService: NetworkService;

  beforeEach(async () => {
    await resetDb();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    transactionService = TestBed.inject(TransactionService);
    networkService = TestBed.inject(NetworkService);
  });

  afterEach(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    await resetDb();
  });

  function mockRates(rate: number): void {
    const mockResponse = {
      ok: true,
      json: async () => [
        { base: 'EUR', quote: 'USD', date: '2026-01-15', rate },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);
  }

  it('surfaces the warning when an offline-captured foreign transaction has no stored conversion', async () => {
    const usd = await accountService.create('USD Account', 'USD', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const period = getCurrentPeriod();

    // Captured offline: no exchange rate, no base amount.
    await transactionService.create(usd.id!, incomeCat.id!, 100, new Date(), period);
    mockRates(1.08);

    await component.ngOnInit();
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.conversion-warning .alert');
    expect(warning).toBeTruthy();
    expect(warning.textContent).toContain('EUR');
  });

  it('keeps the warning hidden when the unconverted transaction sits on a base-currency account', async () => {
    const eur = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');

    await transactionService.create(eur.id!, incomeCat.id!, 100, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.conversion-warning .alert')).toBeNull();
  });

  it('completes yearly KPI sums from the stored exchange rate instead of warning', async () => {
    const usd = await accountService.create('USD Account', 'USD', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const period = getCurrentPeriod();

    // Stored at capture time: 100 USD at 1.08; base amount never persisted.
    await transactionService.create(usd.id!, incomeCat.id!, 100, new Date(), period, 1.08, null);
    mockRates(1.08);

    await component.ngOnInit();

    expect(component.yearTotalIncome()).toBe(108);
    expect(component.conversionDegraded().unconvertedTransactions).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.conversion-warning .alert')).toBeNull();
  });

  it('completes category breakdown totals from the stored exchange rate', async () => {
    const usd = await accountService.create('USD Account', 'USD', 0);
    const food = await categoryService.create('Food', 'expense');
    const period = getCurrentPeriod();

    await transactionService.create(usd.id!, food.id!, 100, new Date(), period, 1.08, null);
    mockRates(1.08);

    await component.ngOnInit();

    expect(component.categoryBreakdown()).toEqual([{ name: 'Food', total: 108 }]);
  });

  it('covers Period-end balances when the unconverted transaction predates the scope', async () => {
    const usd = await accountService.create('USD Account', 'USD', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');

    // Prior year: reaches the Period-end total (cumulative) but is outside
    // the scope year, so only the at-or-before branch can flag it.
    await transactionService.create(usd.id!, incomeCat.id!, 100, new Date(), 1, null, null, getCurrentYear() - 2);
    mockRates(1.08);

    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.conversion-warning .alert')).toBeTruthy();
  });

  it('produces one warning, not a stack, when accounts are dropped and conversions are missing', async () => {
    const usd = await accountService.create('USD Account', 'USD', 50000);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const period = getCurrentPeriod();

    await transactionService.create(usd.id!, incomeCat.id!, 100, new Date(), period);
    networkService.isOnline.set(false);

    await component.ngOnInit();
    fixture.detectChanges();

    const warnings = fixture.nativeElement.querySelectorAll('.conversion-warning');
    expect(warnings.length).toBe(1);

    const message = warnings[0].textContent;
    expect(message).toContain('EUR');
    expect(message).toContain('face amount');
  });

  it('renders the warning strip above the KPI row so it vouches for every figure', async () => {
    const usd = await accountService.create('USD Account', 'USD', 50000);
    networkService.isOnline.set(false);

    await component.ngOnInit();
    fixture.detectChanges();

    const dashboard = fixture.nativeElement.querySelector('.dashboard');
    const children = Array.from(dashboard.children) as HTMLElement[];
    const kpiIndex = children.findIndex(el => el.classList.contains('kpi-row'));
    const warningIndex = children.findIndex(el => el.classList.contains('conversion-warning'));

    expect(warningIndex).toBeGreaterThan(-1);
    expect(kpiIndex).toBeGreaterThan(-1);
    expect(warningIndex).toBeLessThan(kpiIndex);
  });
});

describe('DashboardComponent - data version refresh', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;
  let dataVersion: DataVersionService;

  beforeEach(async () => {
    await resetDb();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    dataVersion = TestBed.inject(DataVersionService);

    await accountService.create('Cash', 'EUR', 100000);
    await component.ngOnInit();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    await resetDb();
  });

  it('reloads accounts when the data version changes while mounted', async () => {
    expect(component.accounts().some((a) => a.name === 'Bank')).toBe(false);

    await accountService.create('Bank', 'EUR', 0);

    dataVersion.bump();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    fixture.detectChanges();

    expect(component.accounts().some((a) => a.name === 'Bank')).toBe(true);
  });

  it('does not reload while the data version stays unchanged', async () => {
    await accountService.create('Bank', 'EUR', 0);
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    fixture.detectChanges();

    expect(component.accounts().some((a) => a.name === 'Bank')).toBe(false);
  });
});
