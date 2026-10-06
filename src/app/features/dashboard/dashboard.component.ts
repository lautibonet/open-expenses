import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { LanguageService } from '../../core/services/language.service';
import { DataVersionService } from '../../core/services/data-version.service';
import { MonthNumber } from '../../core/types/period.type';
import {
  MonthScope,
  ScopeOptions,
  changeMonth,
  changeYear,
  defaultScope,
  scopeOptions,
} from '../../core/scope/scope';
import { DismissibleAlertComponent } from '../../shared/components/dismissible-alert/dismissible-alert.component';
import { FitTextDirective } from '../../shared/directives/fit-text.directive';
import { CashBasisSnapshot, PeriodCashFlow } from '../../core/stats/cash-basis';
import { CategorySpending, spendingShare } from '../../core/stats/category-spending';
import {
  AccountBalance,
  RateOutcome,
  StatsReport,
  currenciesNeedingRates,
  statsReport,
} from '../../core/stats/stats-report';
import {
  balanceExtremes,
  categoryBarWidth,
  fillPct,
  overviewExtremes,
  stripScaleAnchor,
  zeroPct,
} from '../../core/stats/chart-scale';

const noRatesNeeded: RateOutcome = { kind: 'rates', rates: new Map() };

/* What the screen shows before the first load. */
const emptySnapshot: CashBasisSnapshot = {
  accounts: [],
  categories: [],
  transactions: [],
  transfers: [],
  baseCurrency: 'EUR',
};

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, DismissibleAlertComponent, FitTextDirective],
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
  private dataVersion = inject(DataVersionService);
  language = inject(LanguageService);

  scope = signal<MonthScope>(defaultScope());
  /* Everything recorded, loaded once per data version; a Scope change only
     re-runs the report. */
  private snapshot = signal<CashBasisSnapshot>(emptySnapshot);
  private availableScopes = computed<ScopeOptions>(() => {
    const { transactions, transfers } = this.snapshot();
    return scopeOptions([...transactions, ...transfers], this.scope());
  });
  scopeYears = computed(() => this.availableScopes().years);
  scopeMonths = computed(() => this.availableScopes().months);
  scopeAnnouncement = signal('');

  baseCurrency = computed(() => this.snapshot().baseCurrency);
  /* Every figure the screen shows. */
  report = signal<StatsReport>(statsReport(emptySnapshot, defaultScope(), noRatesNeeded));

  private overviewExtremes = computed(() => overviewExtremes(this.report().yearOverview.periods));
  private balanceExtremes = computed(() => balanceExtremes(this.report().balanceStrip.accumulated));

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  private async loadAll(): Promise<void> {
    const [baseCurrency, accounts, categories, transactions, transfers] = await Promise.all([
      this.profileService.getBaseCurrency(),
      this.accountService.getAll(),
      this.categoryService.getAll(),
      this.transactionService.getAll(),
      this.transferService.getAll(),
    ]);
    this.snapshot.set({ accounts, categories, transactions, transfers, baseCurrency });
    await this.refresh();
  }

  private reloadDataOnVersionChange = this.dataVersion.reloadOnChange(() => this.loadAll());

  /* The screen's one asynchronous step besides loading: the Exchange Rates
     the foreign Accounts need. The report reads the current Scope once they
     arrive, so a Scope change during the fetch is never lost. */
  private async refresh(): Promise<void> {
    const snapshot = this.snapshot();
    const rates = await this.fetchRates(snapshot);
    this.report.set(statsReport(snapshot, this.scope(), rates));
  }

  /* Any rejection — offline with nothing cached, or a failed fetch — leaves
     the rates unavailable; the rate service's cache still answers offline. */
  private async fetchRates(snapshot: CashBasisSnapshot): Promise<RateOutcome> {
    const currencies = currenciesNeedingRates(snapshot);
    if (currencies.length === 0) return noRatesNeeded;
    try {
      const result = await this.exchangeRateService.getRates(snapshot.baseCurrency, currencies);
      return { kind: 'rates', rates: result.rates };
    } catch {
      return { kind: 'unavailable' };
    }
  }

  async onScopeYearChange(value: number): Promise<void> {
    await this.setScope(changeYear(this.scope(), value, this.availableScopes()));
  }

  async onScopeMonthChange(period: MonthNumber): Promise<void> {
    await this.setScope(changeMonth(this.scope(), period));
  }

  private async setScope(scope: MonthScope): Promise<void> {
    this.scope.set(scope);
    this.scopeAnnouncement.set(this.language.scopeLabel(scope));
    await this.refresh();
  }

  scopeLabelText(): string {
    return this.language.scopeLabel(this.scope());
  }

  kpiScopeLabel(): string {
    const scope = this.scope();
    return this.language.t('stats.kpiScope', {
      year: scope.year,
      range: this.language.monthRangeLabel(1, scope.period),
    });
  }

  categoryBarWidth(total: number): number {
    return categoryBarWidth(total, this.report().categorySpending);
  }

  /* The two tones inside a category bar: the cash-paid and credit-paid
     portions as shares of the category's own total. */
  categoryCashShare(item: CategorySpending): number {
    return spendingShare(item.cash, item.total);
  }

  categoryCreditShare(item: CategorySpending): number {
    return spendingShare(item.credit, item.total);
  }

  conversionWarningMessage(): string {
    const degraded = this.report().degradation;
    const parts: string[] = [];
    if (degraded.accountsExcluded) {
      parts.push(this.language.t('stats.conversionWarning', { currency: this.baseCurrency() }));
    }
    if (degraded.unconvertedMovements) {
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

  /* A card row's "used X of limit" caption, in the card's own currency. */
  usedOfLimitText(item: AccountBalance): string {
    if (item.usedOfLimit == null) return '';
    const { used, limit } = item.usedOfLimit;
    return this.language.t('stats.usedOfLimit', {
      used: this.formatAccountBalance(used, item.account.currency),
      limit: this.formatAccountBalance(limit, item.account.currency),
    });
  }

  yearOverviewZeroPct(): number {
    return zeroPct(this.overviewExtremes());
  }

  balanceZeroPct(): number {
    return zeroPct(this.balanceExtremes());
  }

  barHeight(value: number): number {
    return fillPct(value, this.overviewExtremes());
  }

  /* Scale anchor: the figures the overview's scale edges are worth — the
     tallest column above the line and the deepest overdrawn Net below it,
     signed. Stated so the relative heights get absolute meaning. */
  overviewScalePeak(): number {
    return this.overviewExtremes().up;
  }

  overviewScaleOverdrawn(): number {
    return -this.overviewExtremes().down;
  }

  stripScaleAnchor(): { label: string; amount: number } {
    const anchor = stripScaleAnchor(this.report().balanceStrip.accumulated);
    const label = anchor.kind === 'overdrawn' ? 'stats.scaleOverdrawn' : 'stats.stripScaleTop';
    return { label: this.language.t(label), amount: anchor.amount };
  }

  /* Balance strip fills scale against the year's extremes around the
     data-driven zero line, so an overdrawn month grows down from it. */
  balanceFillHeight(balance: number): number {
    return fillPct(balance, this.balanceExtremes());
  }

  /* The accessible figure list: Income, Expenses, and Net per Period. */
  overviewFigures(item: PeriodCashFlow): string {
    return [
      `${this.language.t('stats.income')} ${this.formatMoney(item.income)}`,
      `${this.language.t('stats.expenses')} ${this.formatMoney(item.expenses)}`,
      `${this.language.t('stats.net')} ${this.formatMoney(item.net)}`,
    ].join(', ');
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
