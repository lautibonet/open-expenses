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
import { getCurrentPeriod, getCurrentYear } from '../../core/types/period.type';

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

  it('should default averages year selector to current calendar year', async () => {
    await component.ngOnInit();
    expect(component.averagesYear()).toBe(String(getCurrentYear()));
  });

  it('should have all time option in years list', async () => {
    await component.ngOnInit();
    expect(component.averagesYears).toContain('All time');
  });

  it('should compute average income for current year', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-01-15`), 'January');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date(`${year}-02-15`), 'February');

    await component.ngOnInit();
    component.averagesYear.set(String(year));
    await component.refreshAverages();

    expect(component.avgMonthlyIncome()).toBe(3000);
  });

  it('should compute average expenses for current year', async () => {
    const acc = await accountService.create('Cash', 'EUR', 100000);
    const expenseCat = await categoryService.create('Food', 'Expense');
    const year = getCurrentYear();

    await transactionService.create(acc.id!, expenseCat.id!, 500, new Date(`${year}-01-15`), 'January');
    await transactionService.create(acc.id!, expenseCat.id!, 700, new Date(`${year}-03-15`), 'March');

    await component.ngOnInit();
    component.averagesYear.set(String(year));
    await component.refreshAverages();

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
    component.averagesYear.set(String(year));
    await component.refreshAverages();

    expect(component.avgMonthlySavings()).toBe(2400);
  });

  it('should compute all-time averages across all months with data', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');

    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-01-15'), 'January');
    await transactionService.create(acc.id!, incomeCat.id!, 4000, new Date('2026-03-15'), 'March');
    await transactionService.create(acc.id!, incomeCat.id!, 2500, new Date('2026-06-15'), 'June');

    await component.ngOnInit();
    component.averagesYear.set('All time');
    await component.refreshAverages();

    expect(component.avgMonthlyIncome()).toBeCloseTo(3166.67, 0);
  });

  it('should show zero averages when no data exists', async () => {
    await component.ngOnInit();
    await component.refreshAverages();

    expect(component.avgMonthlyIncome()).toBe(0);
    expect(component.avgMonthlyExpenses()).toBe(0);
    expect(component.avgMonthlySavings()).toBe(0);
  });

  it('should include a Dec-dated movement in the January report of its period year', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 'January', [], null, null, 2026);

    await component.ngOnInit();
    component.selectedYear.set(2026);
    component.selectedPeriod.set('January');
    await component.refresh();

    expect(component.totalIncome()).toBe(3000);
  });

  it('should exclude a Dec-dated movement from the date year report', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 'January', [], null, null, 2026);

    await component.ngOnInit();
    component.selectedYear.set(2025);
    component.selectedPeriod.set('January');
    await component.refresh();

    expect(component.totalIncome()).toBe(0);
  });

  it('should compute yearly averages against the period year, not the date year', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 'January', [], null, null, 2026);

    await component.ngOnInit();
    component.averagesYear.set('2026');
    await component.refreshAverages();

    expect(component.avgMonthlyIncome()).toBe(3000);
  });

  it('should exclude a Dec-dated movement from yearly averages of its date year', async () => {
    const acc = await accountService.create('Cash', 'EUR', 0);
    const incomeCat = await categoryService.create('Payroll', 'Income');
    await transactionService.create(acc.id!, incomeCat.id!, 3000, new Date('2025-12-22'), 'January', [], null, null, 2026);

    await component.ngOnInit();
    component.averagesYear.set('2025');
    await component.refreshAverages();

    expect(component.avgMonthlyIncome()).toBe(0);
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
