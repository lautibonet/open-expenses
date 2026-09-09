import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
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

  describe('KPI trio follows the selected month (year-to-period)', () => {
    async function seedIncome(period: number, year: number = getCurrentYear()): Promise<void> {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const cat = await categoryService.create('Payroll', 'income');
      await transactionService.create(
        acc.id!, cat.id!, 3000, new Date(`${year}-${String(period).padStart(2, '0')}-15`), period, null, null, year,
      );
    }

    async function seedYearSpread(): Promise<{ incomeCat: number; expenseCat: number }> {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const incomeCat = await categoryService.create('Payroll', 'income');
      const expenseCat = await categoryService.create('Food', 'expense');
      const year = getCurrentYear();

      await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1);
      await transactionService.create(acc.id!, incomeCat.id!, 1000, new Date(`${year}-02-15`), 2);
      await transactionService.create(acc.id!, incomeCat.id!, 2000, new Date(`${year}-09-15`), 9);
      await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-02-15`), 2);
      await transactionService.create(acc.id!, expenseCat.id!, 700, new Date(`${year}-09-15`), 9);

      return { incomeCat: incomeCat.id!, expenseCat: expenseCat.id! };
    }

    it('shows totals from January through the selected month of the selected year', async () => {
      await seedYearSpread();

      await component.ngOnInit();
      await component.onScopeMonthChange(2);

      expect(component.yearTotalIncome()).toBe(4000);
      expect(component.yearTotalExpenses()).toBe(500);
      expect(component.yearTotalNet()).toBe(3500);
    });

    it('excludes later months of the same year from the selected period', async () => {
      await seedYearSpread();

      await component.ngOnInit();
      await component.onScopeMonthChange(1);

      expect(component.yearTotalIncome()).toBe(3000);
      expect(component.yearTotalExpenses()).toBe(0);
    });

    it('shows the same figures as the old year-to-date when the latest month with data is selected', async () => {
      await seedYearSpread();

      await component.ngOnInit();
      await component.onScopeMonthChange(getCurrentPeriod());

      expect(component.yearTotalIncome()).toBe(6000);
      expect(component.yearTotalExpenses()).toBe(1200);
      expect(component.yearTotalNet()).toBe(4800);
    });

    it('averages across the months with data through the selected month', async () => {
      await seedYearSpread();

      await component.ngOnInit();
      await component.onScopeMonthChange(2);

      expect(component.avgMonthlyIncome()).toBe(2000);
      expect(component.avgMonthlyExpenses()).toBe(250);
      expect(component.avgMonthlyNet()).toBe(1750);
    });

    it('visually states the covered range as a caps label over the KPI ledger', async () => {
      const acc = await accountService.create('Cash', 'EUR', 0);
      const cat = await categoryService.create('Payroll', 'income');
      const year = getCurrentYear();
      for (const period of [1, 8]) {
        await transactionService.create(
          acc.id!, cat.id!, 3000, new Date(`${year}-${String(period).padStart(2, '0')}-15`), period,
        );
      }

      await component.ngOnInit();
      await component.onScopeMonthChange(8);
      fixture.detectChanges();

      const scopes = Array.from(
        fixture.nativeElement.querySelectorAll('.kpi-scope') as NodeListOf<HTMLElement>,
      );
      expect(scopes.length).toBe(1);
      expect(scopes[0].textContent).toContain(String(getCurrentYear()));
      expect(scopes[0].textContent).toContain('JAN');
      expect(scopes[0].textContent).toContain('AUG');
    });

    it('shows the KPI empty state when the selected month has no data, keeping the year net strip', async () => {
      await seedIncome(getCurrentPeriod());
      await component.ngOnInit();
      await component.onScopeMonthChange(2);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.kpi-ledger')).toBeNull();
      const empty = fixture.nativeElement.querySelector('.kpi-card .empty-state');
      expect(empty).toBeTruthy();
      expect(empty.textContent).toContain('February');

      expect(fixture.nativeElement.querySelector('.year-overview .overview-tracks')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.overview-zero')).toBeNull();
      expect(
        component.yearOverviewData().find(o => o.period === getCurrentPeriod())!.net,
      ).toBe(3000);
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

  let seedCounter = 0;

  async function seedIncome(period: number, year: number = getCurrentYear()): Promise<void> {
    const acc = await accountService.create(`Cash ${++seedCounter}`, 'EUR', 0);
    const cat = await categoryService.create(`Payroll ${seedCounter}`, 'income');
    await transactionService.create(
      acc.id!, cat.id!, 3000, new Date(`${year}-${String(period).padStart(2, '0')}-15`), period, null, null, year,
    );
  }

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

  it('should name the scope in every month-scoped card heading', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const expectedLabel = `${MONTH_NAMES[getCurrentPeriod() - 1]} ${getCurrentYear()}`;
    const monthHeadings = Array.from(
      fixture.nativeElement.querySelectorAll(
        'section.card:not(.year-overview-card) h2',
      ) as NodeListOf<HTMLElement>,
    );
    expect(monthHeadings.length).toBeGreaterThan(0);
    for (const h of monthHeadings) {
      expect(h.textContent).toContain(expectedLabel);
    }

    // The year overview covers the whole scope year, so its heading states
    // the year scope instead of the month scope.
    const stripHeading = fixture.nativeElement.querySelector('.year-overview-card h2');
    expect(stripHeading.textContent).toContain(String(getCurrentYear()));
  });

  it('should render the page heading as an h1', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    const headings = fixture.nativeElement.querySelectorAll('h1');
    expect(headings.length).toBe(1);
  });

  it('renders Net as the ledger\'s last ink line', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const net = fixture.nativeElement.querySelector('.kpi-line.kpi-net .value');
    expect(net).toBeTruthy();
    expect(net.textContent).toContain(component.formatMoney(component.yearTotalNet()));
    expect(component.yearTotalNet()).toBe(2500);
  });

  it('renders the KPI ledger as three striped lines: income, expenses, net', async () => {
    await seedIncome(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.kpi-line.kpi-income')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kpi-line.kpi-expense')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kpi-line.kpi-net')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kpi-line.kpi-income .value')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kpi-line.kpi-expense .value')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.kpi-line.kpi-net .value')).toBeTruthy();
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

    const incomeValue = fixture.nativeElement.querySelector('.kpi-line.kpi-income .value');
    expect(incomeValue.textContent).toContain(component.formatMoney(5000));

    const incomeSecondary = fixture.nativeElement.querySelector('.kpi-line.kpi-income .secondary');
    expect(incomeSecondary.textContent).toContain('AVG');
    expect(incomeSecondary.textContent).toContain(component.formatMoney(2500));

    const netValue = fixture.nativeElement.querySelector('.kpi-line.kpi-net .value');
    expect(netValue.textContent).toContain(component.formatMoney(4500));
  });

  it('shows the KPI empty state, not the ledger, when the scope year has no movements', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.kpi-ledger')).toBeNull();
    const empty = fixture.nativeElement.querySelector('.kpi-card .empty-state');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain(String(getCurrentYear()));
  });

  it('keeps the KPI scope label in sync when the scope year changes', async () => {
    await seedIncome(getCurrentPeriod());
    const previousYear = getCurrentYear() - 1;
    await seedIncome(1, previousYear);
    await component.ngOnInit();
    fixture.detectChanges();
    await component.onScopeYearChange(previousYear);
    fixture.detectChanges();

    const scope = fixture.nativeElement.querySelector('.kpi-scope');
    expect(scope.textContent).toContain(String(previousYear));
  });

  it('associates each KPI label, value and average in one ledger definition list', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const ledger = fixture.nativeElement.querySelector('dl.kpi-ledger');
    expect(ledger).toBeTruthy();

    const incomeLine = ledger.querySelector('.kpi-line.kpi-income');
    expect(incomeLine.querySelector('dt').textContent).toContain('Income');
    expect(incomeLine.querySelector('dd .value').textContent).toContain(
      component.formatMoney(component.yearTotalIncome()),
    );
    expect(incomeLine.querySelector('dd .secondary').textContent).toContain('AVG');
  });

  it('hides the savings rate when there is no income', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kpi-savings')).toBeNull();
  });

  it('shows the savings rate as the ledger footer line when there is income', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kpi-savings .savings-rate')).toBeTruthy();
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

  function cardByHeading(text: string): HTMLElement | null {
    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>,
    );
    const heading = headings.find(h => h.textContent?.includes(text));
    return heading ? (heading.closest('section') as HTMLElement | null) : null;
  }

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

  it('refreshes averages when the scope month changes, following the covered period', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1);
    await transactionService.create(acc.id!, incomeCat.id!, 6000, new Date(`${year}-02-15`), 2);

    await component.ngOnInit();
    await scopeTo(1, year);
    expect(component.avgMonthlyIncome()).toBe(3000);

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

  it('keeps the category card, showing the empty state, when the Period has no expenses', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const card = cardByHeading('Expenses by Category');
    expect(card).toBeTruthy();
    expect(card!.querySelector('.category-bars')).toBeNull();
    const empty = card!.querySelector('.empty-state');
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toContain(String(getCurrentYear()));
  });

  it('shows the empty state in the balances card when there are no accounts', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const card = cardByHeading('Account Balances');
    expect(card).toBeTruthy();
    expect(card!.querySelector('.balance-list')).toBeNull();
    const empty = card!.querySelector('.empty-state');
    expect(empty).toBeTruthy();
  });

  it('styles the Stats empty states with the shared empty-state pattern', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const css = Array.from(document.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
    expect(css).toMatch(/\.empty-state[^{]*\{[^}]*border:\s*1px dashed var\(--outline\)/);
    expect(css).toMatch(/\.empty-state[^{]*\{[^}]*color:\s*var\(--on-surface-variant\)/);
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

  // jsdom does no layout, so the ledger alignment can't be asserted
  // geometrically; the compiled stylesheet declarations are the seam.
  it('right-aligns the KPI figures into one ledger column with directional stripes', async () => {
    await renderWithData();

    const css = compiledComponentCss();
    expect(css).toMatch(/\.figures[^{]*\{[^}]*text-align:\s*right/);
    expect(css).toMatch(/\.kpi-income[^{]*\{[^}]*border-left:\s*var\(--stripe-income\)/);
    expect(css).toMatch(/\.kpi-expense[^{]*\{[^}]*border-left:\s*var\(--stripe-expense\)/);
    expect(css).toMatch(/\.kpi-net[^{]*\{[^}]*border-left:\s*var\(--stripe-transfer\)/);
  });

  // The KPI ledger presents as the page's shared card (Background section
  // rhythm via the .card margin) with zero padding of its own: the stripes
  // touch the card edge and the rows carry the 1rem gutter instead. jsdom
  // does no layout, so the compiled declarations are the seam; --space-lg's
  // own value is asserted so the 24px section rhythm cannot silently drift.
  it('presents the KPI ledger as a shared card whose rows carry the 1rem gutter', async () => {
    await renderWithData();

    const tokens = readFileSync('src/styles.scss', 'utf-8');
    expect(tokens).toMatch(/--space-lg:\s*1\.5rem/);

    const css = compiledComponentCss();
    expect(css).toMatch(/\.card[^{]*\{[^}]*margin-bottom:\s*var\(--space-lg\)/);
    expect(css).toMatch(/\.card\.kpi-card[^{]*\{[^}]*padding:\s*0/);
    expect(css).toMatch(/\.kpi-line[^{]*\{[^}]*padding:\s*var\(--space-sm\)\s+var\(--space-md\)/);
  });

  it('renders every mono figure on Stats at the data spec weight (500, no faux bold)', async () => {
    await renderWithData();

    const figures = [
      '.kpi-line.kpi-income .value',
      '.kpi-line.kpi-expense .value',
      '.kpi-line.kpi-net .value',
      '.kpi-line .secondary',
      '.kpi-line.kpi-savings .savings-rate',
      '.stat .value',
      '.category-bar-row .cat-amount',
      '.overview-caption .value',
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

describe('DashboardComponent - year overview (12-month graph)', () => {
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

  function tracks(): NodeListOf<HTMLElement> {
    return fixture.nativeElement.querySelectorAll('.overview-track');
  }

  it('renders one track for each of the 12 Periods of the scope year', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    expect(tracks().length).toBe(12);
  });

  it('renders three columns rising from the midline, only net crossing it', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 1500, new Date(`${year}-02-15`), 2, null, null, year);
    await transactionService.create(acc.id!, incomeCat.id!, 1000, new Date(`${year}-03-15`), 3, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 3000, new Date(`${year}-03-15`), 3, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    const [january, february, march] = Array.from(tracks());

    expect(january.querySelector('.income .cell-fill')).toBeTruthy();
    expect(january.querySelector('.expense .cell-fill')).toBeNull();
    expect(january.querySelector('.net .cell-fill.up')).toBeTruthy();

    expect(february.querySelector('.expense .cell-fill')).toBeTruthy();
    expect(february.querySelector('.net .cell-fill.down')).toBeTruthy();

    expect(march.querySelector('.net .cell-fill.down')).toBeTruthy();
  });

  it('scales columns against the year extremes with the zero line raised by the negative share', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 1500, new Date(`${year}-02-15`), 2, null, null, year);
    await transactionService.create(acc.id!, incomeCat.id!, 1000, new Date(`${year}-03-15`), 3, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 3000, new Date(`${year}-03-15`), 3, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    // Year extremes: up 3000 (peak income), down 2000 (March's overdrawn net).
    // The zero line rises to 40% of the track; up fills share the 60% above it,
    // the down fill takes the 40% below it.
    expect(component.yearOverviewZeroPct()).toBe(40);
    const [january, february, march] = Array.from(tracks());
    expect((january.querySelector('.income .cell-fill') as HTMLElement).style.height).toBe('60%');
    expect((february.querySelector('.expense .cell-fill') as HTMLElement).style.height).toBe('30%');
    expect((march.querySelector('.net .cell-fill.down') as HTMLElement).style.height).toBe('40%');
  });

  it('pins the zero line to the bottom edge when every month is positive, giving the fills the full track', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.yearOverviewZeroPct()).toBe(0);
    const overview = fixture.nativeElement.querySelector('.year-overview') as HTMLElement;
    expect(overview.style.getPropertyValue('--zero-pct')).toBe('0%');
    const january = tracks()[0];
    expect((january.querySelector('.income .cell-fill') as HTMLElement).style.height).toBe('100%');
  });

  it('never grows Income or Expense columns below the zero line; only Net does', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 1000, new Date(`${year}-01-15`), 1, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 3000, new Date(`${year}-02-15`), 2, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    const [january, february] = Array.from(tracks());
    expect(january.querySelector('.income .cell-fill.down')).toBeNull();
    expect(january.querySelector('.expense .cell-fill.down')).toBeNull();
    expect(february.querySelector('.expense .cell-fill.down')).toBeNull();
    expect(february.querySelector('.net .cell-fill.down')).toBeTruthy();
  });

  it('leaves zero-figure Periods visible as empty tracks', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    const emptyTrack = tracks()[6];
    expect(emptyTrack).toBeTruthy();
    expect(emptyTrack.querySelector('.cell-fill')).toBeNull();
  });

  it('colors the columns by direction and keeps Net ink at every sign', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const css = compiledComponentCss();
    expect(css).toMatch(/\.income[^{]*\.cell-fill[^{]*\{[^}]*background:\s*var\(--income\)/);
    expect(css).toMatch(/\.expense[^{]*\.cell-fill[^{]*\{[^}]*background:\s*var\(--error\)/);
    expect(css).toMatch(/\.net[^{]*\.cell-fill[^{]*\{[^}]*background:\s*var\(--on-surface\)/);
    expect(css).toMatch(/\.balance-fill[^{]*\{[^}]*background:\s*var\(--on-surface\)/);
  });

  it('paints the midline above the fills at the data-driven zero position in both graphs', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const css = compiledComponentCss();
    expect(css).toMatch(/\.overview-track[^{]*::before\s*\{[^}]*bottom:\s*var\(--zero-pct/);
    expect(css).toMatch(/\.balance-track[^{]*::before\s*\{[^}]*bottom:\s*var\(--zero-pct/);
    expect(css).toMatch(/\.cell-fill[^{]*\{[^}]*bottom:\s*var\(--zero-pct/);
  });

  it('builds both graphs from the same contiguous shared-border track grammar', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const css = compiledComponentCss();

    // One construction for both graphs: twelve equal columns, contiguous —
    // a single plot each, not a strip of separated tiles.
    for (const selector of ['overview-tracks', 'balance-tracks', 'overview-initials', 'balance-initials']) {
      const rule = css.match(new RegExp(`\\.${selector}[^{]*\\{([^}]*)\\}`))!;
      expect(rule[1]).toContain('repeat(12, minmax(0, 1fr))');
      // A declared gap must be zero; separated tiles are the other grammar.
      expect(rule[1]).not.toMatch(/gap:(?!\s*0)/);
    }

    // Shared borders: every track drops its left border, the first keeps one,
    // so adjacent tracks collapse to a single hairline.
    expect(css).toMatch(/\.overview-track[^{]*\{[^}]*border-left:\s*0/);
    expect(css).toMatch(/\.balance-track[^{]*\{[^}]*border-left:\s*0/);
    expect(css).toMatch(/\.balance-track[^{]*:first-child\s*\{[^}]*border-left:\s*1px/);
  });

  it('keeps the size hierarchy between the two graphs', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const css = compiledComponentCss();
    expect(css).toMatch(/\.overview-track[^{]*\{[^}]*height:\s*7rem/);
    expect(css).toMatch(/\.balance-track[^{]*\{[^}]*height:\s*4\.5rem/);
  });

  it('heads the year overview with the year scope, not the month scope', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('.year-overview-card h2');
    expect(heading.textContent).toContain(String(getCurrentYear()));
    expect(heading.textContent).not.toContain(MONTH_NAMES[getCurrentPeriod() - 1]);
  });

  it('marks the scope Period as the current one', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const currentPeriod = getCurrentPeriod();
    const all = Array.from(tracks());
    expect(all[currentPeriod - 1].classList).toContain('current');
    for (const [index, other] of all.entries()) {
      if (index !== currentPeriod - 1) {
        expect(other.classList).not.toContain('current');
      }
    }
  });

  it('shows the zero state, not an empty block, when the scope year has no movements', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.overview-tracks')).toBeNull();
    const zero = fixture.nativeElement.querySelector('.overview-zero');
    expect(zero).toBeTruthy();
    expect(zero.textContent).toContain(String(getCurrentYear()));
  });

  function balanceTracks(): NodeListOf<HTMLElement> {
    return fixture.nativeElement.querySelectorAll('.balance-track');
  }

  it('renders the balance strip inside the total balance card when the scope year has movements', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.total-balance-card');
    expect(card.querySelector('.balance-strip')).toBeTruthy();
    expect(balanceTracks().length).toBe(12);
    expect(card.querySelector('.balance-initials .balance-initial')).toBeTruthy();

    const list = card.querySelector('.balance-figures');
    expect(list).toBeTruthy();
    expect(list.classList).toContain('visually-hidden');

    const items = Array.from(list.querySelectorAll('li') as NodeListOf<HTMLLIElement>);
    expect(items.length).toBe(12);
    expect(items[getCurrentPeriod() - 1].textContent).toContain(
      languageService.monthName(getCurrentPeriod()),
    );
    expect(items[getCurrentPeriod() - 1].textContent).toContain(component.formatMoney(3000));
  });

  it('marks the scope Period on the strip and freezes the tail at the last known balance', async () => {
    const acc = await accountService.create('Cash', 'EUR', 1000);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    const currentPeriod = getCurrentPeriod();
    const all = Array.from(balanceTracks());
    expect(all[currentPeriod - 1].classList).toContain('current');
    expect(all[11].classList).not.toContain('current');

    // No movements after the seed Period: every later track freezes at the
    // same balance — same fill height as the current month.
    const currentFill = all[currentPeriod - 1].querySelector('.balance-fill') as HTMLElement;
    const decemberFill = all[11].querySelector('.balance-fill') as HTMLElement;
    expect(decemberFill).toBeTruthy();
    expect(decemberFill.style.height).toBe(currentFill.style.height);
  });

  it('grows an overdrawn month down from the zero line, in ink', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const expenseCat = await categoryService.create('Food', 'expense');
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(), 2);

    await component.ngOnInit();
    fixture.detectChanges();

    // January: zero balance, bare track. February: overdrawn, fills downward.
    // A never-positive year raises the line to the top edge: the negative
    // share is the whole track.
    const [january, february] = Array.from(balanceTracks());
    expect(january.querySelector('.balance-fill')).toBeNull();
    expect(component.balanceZeroPct()).toBe(100);
    const down = february.querySelector('.balance-fill.down') as HTMLElement;
    expect(down).toBeTruthy();
    expect(down.style.height).toBe('100%');
  });

  it('pins the strip zero line to the bottom edge when the year never goes negative', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.balanceZeroPct()).toBe(0);
    const strip = fixture.nativeElement.querySelector('.balance-strip') as HTMLElement;
    expect(strip.style.getPropertyValue('--zero-pct')).toBe('0%');
    const fill = balanceTracks()[getCurrentPeriod() - 1].querySelector('.balance-fill.up') as HTMLElement;
    expect(fill.style.height).toBe('100%');
  });

  it('raises the strip zero line in proportion to the negative share of the year extremes', async () => {
    const acc = await accountService.create('Cash', 'EUR', 1000);
    const expenseCat = await categoryService.create('Food', 'expense');
    await transactionService.create(acc.id!, expenseCat.id!, 3000, new Date(), 2);

    await component.ngOnInit();
    fixture.detectChanges();

    // January 1000, February -2000, tail frozen at -2000: up extreme 1000,
    // down extreme 2000 — the line sits at two thirds of the track, the
    // positive fill shares the third above it.
    expect(component.balanceZeroPct()).toBe(66.67);
    const [january, february] = Array.from(balanceTracks());
    expect((january.querySelector('.balance-fill.up') as HTMLElement).style.height).toBe('33.33%');
    expect((february.querySelector('.balance-fill.down') as HTMLElement).style.height).toBe('66.67%');
  });

  it('shows no balance strip, legend or figures when the scope year has no movements', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.balance-strip')).toBeNull();
    expect(fixture.nativeElement.querySelector('.balance-legend')).toBeNull();
    expect(fixture.nativeElement.querySelector('.balance-figures')).toBeNull();
  });

  it('explains the strip convention with a one-line caps legend', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const legend = fixture.nativeElement.querySelector('.balance-legend');
    expect(legend).toBeTruthy();
    expect(legend.textContent).toContain('balance');

    const css = compiledComponentCss();
    expect(css).toMatch(/\.balance-legend[^{]*\{[^}]*text-transform:\s*uppercase/);
  });

  it('keeps the balance strip matching the total balance figure at the Scope Period', async () => {
    const acc = await accountService.create('Cash', 'EUR', 1000);
    const incomeCat = await categoryService.create('Payroll', 'income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(), getCurrentPeriod());

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.accumulated()[getCurrentPeriod() - 1]).toBe(
      component.totalBalanceBaseCurrency(),
    );
  });

  it('degrades the balance series to base-currency accounts when offline, still matching the card', async () => {
    await accountService.create('Cash', 'EUR', 100000);
    await accountService.create('USD Account', 'USD', 50000);
    TestBed.inject(NetworkService).isOnline.set(false);

    await component.ngOnInit();

    expect(component.conversionDegraded().accountsExcluded).toBe(true);
    expect(component.accumulated()[getCurrentPeriod() - 1]).toBe(
      component.totalBalanceBaseCurrency(),
    );
    expect(component.accumulated()[getCurrentPeriod() - 1]).toBe(100000);
  });

  it('announces Income, Expenses and Net per Period in an accessible equivalent', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-02-15`), 2, null, null, year);

    await component.ngOnInit();
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('.overview-figures');
    expect(list).toBeTruthy();
    expect(list.classList).toContain('visually-hidden');

    const items = Array.from(list.querySelectorAll('li') as NodeListOf<HTMLLIElement>);
    expect(items.length).toBe(12);
    expect(items[0].textContent).toContain('January');
    expect(items[0].textContent).toContain(component.formatMoney(3000));
    expect(items[1].textContent).toContain('February');
    expect(items[1].textContent).toContain(component.formatMoney(-500));
  });

  it('shows the scope Period\'s Net figure as a visible mono caption on the card', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('.overview-caption');
    expect(caption).toBeTruthy();

    const value = caption.querySelector('.value');
    expect(value).toBeTruthy();
    expect(value.textContent).toContain(
      component.formatMoney(
        component.yearOverviewData().find(o => o.period === getCurrentPeriod())!.net,
      ),
    );

    const label = caption.querySelector('.label');
    expect(label).toBeTruthy();
    expect(label.textContent).toContain(languageService.monthName(getCurrentPeriod()));
  });

  it('keeps the caption figure in the mono data voice', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const css = compiledComponentCss();
    expect(css).toMatch(/\.overview-caption[^{]*\.value[^{]*\{[^}]*font-family:\s*var\(--font-data\)/);
    expect(css).toMatch(/\.overview-caption[^{]*\.value[^{]*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });

  it('explains the color grammar with a one-line caps legend', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const legend = fixture.nativeElement.querySelector('.overview-legend');
    expect(legend).toBeTruthy();

    const css = compiledComponentCss();
    expect(css).toMatch(/\.overview-legend[^{]*\{[^}]*text-transform:\s*uppercase/);
  });

  it('keeps the decorative graph aria-hidden and the screen-reader figure list beside the caption', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const graph = fixture.nativeElement.querySelector('.year-overview');
    expect(graph).toBeTruthy();
    expect(graph.getAttribute('aria-hidden')).toBe('true');

    const list = fixture.nativeElement.querySelector('.overview-figures');
    expect(list).toBeTruthy();
    expect(list.classList).toContain('visually-hidden');
    expect(list.querySelectorAll('li').length).toBe(12);
  });

  it('follows the scope month: the caption figure updates when the Scope changes', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'income');
    const expenseCat = await categoryService.create('Food', 'expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 1, null, null, year);
    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-02-15`), 2, null, null, year);

    await component.ngOnInit();
    await component.onScopeMonthChange(1);
    fixture.detectChanges();

    let value = fixture.nativeElement.querySelector('.overview-caption .value');
    expect(value.textContent).toContain(component.formatMoney(3000));
    expect(fixture.nativeElement.querySelector('.overview-caption .label').textContent)
      .toContain(languageService.monthName(1));

    await component.onScopeMonthChange(2);
    fixture.detectChanges();

    value = fixture.nativeElement.querySelector('.overview-caption .value');
    expect(value.textContent).toContain(component.formatMoney(-500));
    expect(fixture.nativeElement.querySelector('.overview-caption .label').textContent)
      .toContain(languageService.monthName(2));
  });

  it('shows no caption or legend in the zero state', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.overview-tracks')).toBeNull();
    expect(fixture.nativeElement.querySelector('.overview-caption')).toBeNull();
    expect(fixture.nativeElement.querySelector('.overview-legend')).toBeNull();
  });

  it('takes month initials from the Language service, correct in both Languages', async () => {
    await seedMovement(getCurrentPeriod());
    await component.ngOnInit();
    fixture.detectChanges();

    const readInitials = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll('.overview-initial') as NodeListOf<HTMLElement>,
      ).map(el => el.textContent?.trim());

    expect(readInitials()).toEqual(['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']);

    await languageService.setLanguage('es');
    fixture.detectChanges();

    expect(readInitials()).toEqual(['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']);
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

    expect(component.yearOverviewData().find(o => o.period === 3)!.net).toBe(4000);
    expect(component.yearOverviewData().find(o => o.period === 1)!.net).toBe(0);
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
    const kpiIndex = children.findIndex(el => el.classList.contains('kpi-card'));
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

describe('DashboardComponent - Stats design-spec conformance', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let accountService: AccountService;

  beforeEach(async () => {
    await resetDb();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
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

  // DESIGN.md Cards & Containers: white surface, 1px hard border, 1rem
  // horizontal padding. The KPI ledger is the one exception: the card's own
  // padding drops to 0 so the direction stripes touch its edge, and the rows
  // carry the 1rem horizontal gutter instead. jsdom does no layout, so the
  // compiled declaration is the seam; the token's own value is asserted so
  // the var cannot silently drift away from the spec.
  it('pads every Stats card to the 1rem design-spec padding', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const tokens = readFileSync('src/styles.scss', 'utf-8');
    expect(tokens).toMatch(/--space-md:\s*1rem/);

    const css = compiledComponentCss();
    expect(css).toMatch(/\.card\.kpi-card[^{]*\{[^}]*padding:\s*0/);
    expect(css).toMatch(/\.kpi-line[^{]*\{[^}]*padding:\s*var\(--space-sm\)\s+var\(--space-md\)/);
    expect(css).toMatch(/\.card[^{]*\{[^}]*padding:\s*var\(--space-md\)/);
  });

  /* The mono tile is the row's single currency display; the amount renders
     the locale symbol (€/$) as part of the monetary figure. What must appear
     once is the currency code, so this counts code occurrences in the row. */
  it('shows each balance row its currency exactly once', async () => {
    await accountService.create('Cash', 'EUR', 100000);
    await accountService.create('Credit Card', 'EUR', 0);

    await component.ngOnInit();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.balance-row');
    expect(rows.length).toBe(2);

    for (const row of rows) {
      const text = (row as HTMLElement).textContent ?? '';
      expect(text.split('EUR').length - 1, text).toBe(1);
    }
  });
});
