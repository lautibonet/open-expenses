import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { NetworkService } from '../../core/services/network.service';
import { LanguageService } from '../../core/services/language.service';
import { DataVersionService } from '../../core/services/data-version.service';
import {
  MONTH_NUMBERS,
  MonthNumber,
  PeriodScope,
  defaultScope,
  getCurrentPeriod,
  getPeriodYear,
  isMonthNumber,
  scopeOptionsFromMovements,
} from '../../core/types/period.type';
import { Transaction } from '../../core/models/transaction.model';
import { Transfer } from '../../core/models/transfer.model';
import { Account } from '../../core/models/account.model';
import { Category, isIncomeCategory } from '../../core/models/category.model';
import { DismissibleAlertComponent } from '../../shared/components/dismissible-alert/dismissible-alert.component';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, DismissibleAlertComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private transactionService = inject(TransactionService);
  private transferService = inject(TransferService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);
  private exchangeRateService = inject(ExchangeRateService);
  private networkService = inject(NetworkService);
  private dataVersion = inject(DataVersionService);
  language = inject(LanguageService);

  scope = signal<PeriodScope>(defaultScope());
  scopeYears = signal<number[]>([]);
  scopeMonths = signal<MonthNumber[]>([]);
  scopeAnnouncement = signal('');

  periodTransactions = signal<Transaction[]>([]);
  periodTransfers = signal<Transfer[]>([]);
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  baseCurrency = signal('EUR');

  yearTotalIncome = signal(0);
  yearTotalExpenses = signal(0);
  yearTotalNet = signal(0);
  yearHasData = signal(false);
  categoryBreakdown = signal<{ name: string; total: number }[]>([]);
  accountBalances = signal<{ account: Account; balance: number }[]>([]);
  totalBalanceBaseCurrency = signal(0);
  conversionFailed = signal(false);

  avgMonthlyIncome = signal(0);
  avgMonthlyExpenses = signal(0);
  avgMonthlyNet = signal(0);

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    await this.refresh();
    await this.refreshAverages();
    await this.applyScopeOptions();
  }

  private reloadDataOnVersionChange = this.dataVersion.reloadOnChange(() => this.loadAll());

  async refresh(): Promise<void> {
    this.conversionFailed.set(false);
    const txns = await this.transactionService.getByScope(this.scope());
    const transfers = await this.transferService.getByScope(this.scope());

    this.periodTransactions.set(txns);
    this.periodTransfers.set(transfers);
    this.accounts.set(await this.accountService.getAll());

    const allCategories = await this.categoryService.getAll();
    this.categories.set(allCategories);
    const catMap = new Map(allCategories.map(c => [c.id!, c]));

    let income = 0;
    let expenses = 0;
    const catTotals = new Map<number, number>();

    for (const t of txns) {
      const amount = t.baseCurrencyAmount ?? t.amount;
      const cat = catMap.get(t.categoryId);
      if (isIncomeCategory(cat?.type)) {
        income += amount;
      } else {
        expenses += amount;
        catTotals.set(t.categoryId, (catTotals.get(t.categoryId) ?? 0) + amount);
      }
    }

    const breakdown: { name: string; total: number }[] = [];
    for (const [catId, total] of catTotals) {
      const cat = catMap.get(catId);
      if (cat) {
        breakdown.push({ name: cat.name, total });
      }
    }
    this.categoryBreakdown.set(breakdown.sort((a, b) => b.total - a.total));

    const balances: { account: Account; balance: number }[] = [];
    for (const acc of this.accounts()) {
      const txnsAll = await this.transactionService.getByAccount(acc.id!);
      const transfersAll = await this.transferService.getAll();
      let balance = acc.initialBalance;
      for (const t of txnsAll) {
        const cat = catMap.get(t.categoryId);
        balance += isIncomeCategory(cat?.type) ? t.amount : -t.amount;
      }
      for (const tr of transfersAll) {
        if (tr.sourceAccountId === acc.id) balance -= tr.sourceAmount;
        if (tr.destinationAccountId === acc.id) balance += tr.destinationAmount;
      }
      balances.push({ account: acc, balance });
    }
    this.accountBalances.set(balances);

    const base = this.baseCurrency();
    const nonBaseCurrencies = [...new Set(
      balances
        .map(b => b.account.currency)
        .filter(c => c !== base),
    )];

    if (nonBaseCurrencies.length === 0) {
      this.totalBalanceBaseCurrency.set(this.sumBalances(balances));
      return;
    }

    if (!this.networkService.isOnline()) {
      this.conversionFailed.set(true);
      this.totalBalanceBaseCurrency.set(this.sumBalances(balances, base));
      return;
    }

    try {
      const rates = await this.exchangeRateService.getRates(base, nonBaseCurrencies);
      const baseAmounts = await this.computeBaseAmounts(balances, catMap, rates, base);
      this.totalBalanceBaseCurrency.set(baseAmounts.reduce((sum, b) => sum + b.amount, 0));
    } catch {
      this.conversionFailed.set(true);
      this.totalBalanceBaseCurrency.set(this.sumBalances(balances, base));
    }
  }

  async onScopeYearChange(value: number): Promise<void> {
    const current = this.scope();
    const period = current.year === value ? current.period : getCurrentPeriod();
    await this.setScope({ kind: 'month', period, year: value });
  }

  async onScopeMonthChange(period: number): Promise<void> {
    const current = this.scope();
    await this.setScope({ ...current, period: period as MonthNumber });
  }

  private async setScope(scope: PeriodScope): Promise<void> {
    this.scope.set(scope);
    this.scopeAnnouncement.set(this.language.scopeLabel(scope));
    await Promise.all([this.refresh(), this.refreshAverages()]);
    await this.applyScopeOptions();
  }

  private async applyScopeOptions(): Promise<void> {
    const txns = await this.transactionService.getAll();
    const transfers = await this.transferService.getAll();
    const all = [
      ...txns.map(t => ({ period: t.period, year: t.year, date: t.date })),
      ...transfers.map(t => ({ period: t.period, year: t.year, date: t.date })),
    ];
    const options = scopeOptionsFromMovements(all);
    this.scopeYears.set(options.years);
    this.scopeMonths.set(options.months);
  }

  scopeLabelText(): string {
    return this.language.scopeLabel(this.scope());
  }

  savingsRate(): number | null {
    const income = this.avgMonthlyIncome();
    if (income <= 0) return null;
    return Math.round((this.avgMonthlyNet() / income) * 100);
  }

  categoryBarWidth(total: number): number {
    const breakdown = this.categoryBreakdown();
    const max = breakdown.length > 0 ? Math.max(...breakdown.map(b => b.total)) : 0;
    if (max <= 0) return 0;
    return Math.round((total / max) * 10000) / 100;
  }

  scopePeriod(): MonthNumber {
    return this.scope().period;
  }

  scopeYearValue(): number {
    return this.scope().year;
  }

  private async computeBaseAmounts(
    balances: { account: Account; balance: number }[],
    catMap: Map<number, Category>,
    rates: { rates: Map<string, number> },
    base: string,
  ): Promise<{ account: Account; amount: number }[]> {
    const results: { account: Account; amount: number }[] = [];

    for (const b of balances) {
      if (b.account.currency === base) {
        results.push({ account: b.account, amount: b.balance });
        continue;
      }

      const rate = rates.rates.get(b.account.currency);
      if (!rate) continue;

      const txnsAll = await this.transactionService.getByAccount(b.account.id!);
      const transfersAll = await this.transferService.getAll();

      let baseAmount = Math.round(b.account.initialBalance / rate * 100) / 100;

      for (const t of txnsAll) {
        const cat = catMap.get(t.categoryId);
        const sign = isIncomeCategory(cat?.type) ? 1 : -1;
        baseAmount += sign * (t.baseCurrencyAmount ?? Math.round(t.amount / rate * 100) / 100);
      }
      for (const tr of transfersAll) {
        if (tr.sourceAccountId === b.account.id) baseAmount -= tr.baseCurrencyAmount;
        if (tr.destinationAccountId === b.account.id) baseAmount += tr.baseCurrencyAmount;
      }

      results.push({ account: b.account, amount: Math.round(baseAmount * 100) / 100 });
    }

    return results;
  }

  private sumBalances(
    balances: { account: Account; balance: number }[],
    currency?: string,
  ): number {
    return balances
      .filter(b => !currency || b.account.currency === currency)
      .reduce((sum, b) => sum + b.balance, 0);
  }

  async refreshAverages(): Promise<void> {
    const allTxns = await this.transactionService.getAll();
    const allCategories = await this.categoryService.getAll();
    const catMap = new Map(allCategories.map(c => [c.id!, c]));

    const scope = this.scope();
    const selectedYear = String(scope.year);

    const filteredTxns = allTxns.filter(t => String(getPeriodYear(t)) === selectedYear);

    const monthsWithData = new Set(filteredTxns.map(t => t.period));

    if (monthsWithData.size === 0) {
      this.yearTotalIncome.set(0);
      this.yearTotalExpenses.set(0);
      this.yearTotalNet.set(0);
      this.yearHasData.set(false);
      this.avgMonthlyIncome.set(0);
      this.avgMonthlyExpenses.set(0);
      this.avgMonthlyNet.set(0);
      return;
    }

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of filteredTxns) {
      const amount = t.baseCurrencyAmount ?? t.amount;
      const cat = catMap.get(t.categoryId);
      if (isIncomeCategory(cat?.type)) {
        totalIncome += amount;
      } else {
        totalExpenses += amount;
      }
    }

    const months = monthsWithData.size;
    this.yearTotalIncome.set(totalIncome);
    this.yearTotalExpenses.set(totalExpenses);
    this.yearTotalNet.set(totalIncome - totalExpenses);
    this.yearHasData.set(true);
    this.avgMonthlyIncome.set(Math.round(totalIncome / months * 100) / 100);
    this.avgMonthlyExpenses.set(Math.round(totalExpenses / months * 100) / 100);
    this.avgMonthlyNet.set(Math.round((totalIncome - totalExpenses) / months * 100) / 100);
  }

  formatMoney(amount: number): string {
    return this.language.formatMoney(amount, this.baseCurrency());
  }

  avgCaption(amount: number): string {
    return this.language.t('stats.avgCaption', { amount: this.formatMoney(amount) });
  }

  formatAccountBalance(amount: number, currency: string): string {
    return this.language.formatMoney(amount, currency);
  }
}
