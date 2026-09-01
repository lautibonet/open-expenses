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
import {
  ConversionDegradation,
  noDegradation,
  unconvertedTransactionsAffecting,
} from '../../core/balances/conversion-degradation';
import {
  periodEndBalance,
  periodEndBaseAmount,
  storedBaseAmount,
} from '../../core/balances/period-end-balances';

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
  conversionDegraded = signal<ConversionDegradation>({ ...noDegradation });

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
    this.conversionDegraded.set({ ...noDegradation });
    const txns = await this.transactionService.getByScope(this.scope());
    const transfers = await this.transferService.getByScope(this.scope());

    this.periodTransactions.set(txns);
    this.periodTransfers.set(transfers);
    this.accounts.set(await this.accountService.getAll());

    const allCategories = await this.categoryService.getAll();
    this.categories.set(allCategories);
    const catMap = new Map(allCategories.map(c => [c.id!, c]));
    const base = this.baseCurrency();

    let income = 0;
    let expenses = 0;
    const catTotals = new Map<number, number>();

    for (const t of txns) {
      const amount = storedBaseAmount(t);
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

    const isIncome = (t: Transaction) => isIncomeCategory(catMap.get(t.categoryId)?.type);
    const [allTxns, allTransfers] = await Promise.all([
      this.transactionService.getAll(),
      this.transferService.getAll(),
    ]);

    const scope = this.scope();
    const balances: { account: Account; balance: number }[] = [];
    for (const acc of this.accounts()) {
      const balance = periodEndBalance(
        { account: acc, transactions: allTxns, transfers: allTransfers, isIncome },
        scope,
      );
      balances.push({ account: acc, balance });
    }
    this.accountBalances.set(balances);

    const unconverted = unconvertedTransactionsAffecting(
      allTxns,
      new Map(this.accounts().map(a => [a.id!, a])),
      base,
      scope,
    );
    if (unconverted.length > 0) {
      this.conversionDegraded.update(d => ({ ...d, unconvertedTransactions: true }));
    }

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
      this.excludeForeignAccounts(balances, base);
      return;
    }

    try {
      const rates = await this.exchangeRateService.getRates(base, nonBaseCurrencies);
      const missingRate = balances.some(
        b => b.account.currency !== base && !rates.rates.has(b.account.currency),
      );
      if (missingRate) {
        this.excludeForeignAccounts(balances, base);
        return;
      }

      let total = 0;
      for (const b of balances) {
        const acc = b.account;
        const initialInBase = acc.currency === base
          ? acc.initialBalance
          : Math.round(acc.initialBalance / rates.rates.get(acc.currency)! * 100) / 100;
        total += periodEndBaseAmount(
          { account: acc, transactions: allTxns, transfers: allTransfers, isIncome },
          scope,
          initialInBase,
        );
      }
      this.totalBalanceBaseCurrency.set(Math.round(total * 100) / 100);
    } catch {
      this.excludeForeignAccounts(balances, base);
    }
  }

  /* Foreign accounts whose Exchange Rate cannot be resolved are left out of
     the total balance and surface the conversion warning. */
  private excludeForeignAccounts(
    balances: { account: Account; balance: number }[],
    base: string,
  ): void {
    this.conversionDegraded.update(d => ({ ...d, accountsExcluded: true }));
    this.totalBalanceBaseCurrency.set(this.sumBalances(balances, base));
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

  kpiScopeLabel(): string {
    return this.language.t('stats.kpiScope', { year: this.scope().year });
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

  conversionWarningMessage(): string {
    const degraded = this.conversionDegraded();
    const parts: string[] = [];
    if (degraded.accountsExcluded) {
      parts.push(this.language.t('stats.conversionWarning', { currency: this.baseCurrency() }));
    }
    if (degraded.unconvertedTransactions) {
      parts.push(
        this.language.t('stats.conversionWarningUnconverted', { currency: this.baseCurrency() }),
      );
    }
    return parts.join(' ');
  }

  scopePeriod(): MonthNumber {
    return this.scope().period;
  }

  scopeYearValue(): number {
    return this.scope().year;
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
      const amount = storedBaseAmount(t);
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
