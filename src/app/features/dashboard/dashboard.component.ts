import {
  Component,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { LanguageService } from '../../core/services/language.service';
import { DataVersionService } from '../../core/services/data-version.service';
import { ScopeAwareMovement } from '../../core/types/period.type';
import { Scope, defaultStatsScope, isMultiPeriod } from '../../core/scope/scope';
import { DismissibleAlertComponent } from '../../shared/components/dismissible-alert/dismissible-alert.component';
import { ScopeControlComponent } from '../../shared/components/scope-control/scope-control.component';
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
  netChartExtremes,
  stripScaleAnchor,
  yearMarks,
  zeroPct,
} from '../../core/stats/chart-scale';

const noRatesNeeded: RateOutcome = { kind: 'rates', rates: new Map() };
const ratesPending: RateOutcome = { kind: 'pending' };

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
  imports: [DismissibleAlertComponent, FitTextDirective, ScopeControlComponent],
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

  scope = signal<Scope>(defaultStatsScope());
  /* Everything recorded, loaded once per data version; a Scope change only
     re-runs the report. */
  private snapshot = signal<CashBasisSnapshot>(emptySnapshot);
  /* The foreign Accounts' Exchange Rates, fetched once per load. Until they
     arrive the report already shows every figure that does not need them. */
  private rates = signal<RateOutcome>(noRatesNeeded);
  /* Every recorded movement, for the Scope control's presets and years. */
  movements = computed<ScopeAwareMovement[]>(() => {
    const { transactions, transfers } = this.snapshot();
    return [...transactions, ...transfers];
  });
  scopeAnnouncement = signal('');
  /* Issue #216: the Scope selector waits for the data, so it never shows a
     Period other than the one the screen opens on. */
  isLoaded = signal(false);

  baseCurrency = computed(() => this.snapshot().baseCurrency);
  /* Every figure the screen shows. */
  report = computed<StatsReport>(() => statsReport(this.snapshot(), this.scope(), this.rates()));

  private netChartExtremes = computed(() => netChartExtremes(this.report().netChart.periods));
  private balanceExtremes = computed(() => balanceExtremes(this.report().balanceStrip.accumulated));

  /* ADR 0030: the charts cover exactly the Scope's Periods, and a one-Period
     Scope leaves them out — one column compares nothing. */
  chartsShown = computed(() => isMultiPeriod(this.scope()));
  /* Both charts share their Periods, so they share their year labels. */
  yearMarks = computed(() => yearMarks(this.report().netChart.periods));

  /* A chart longer than twelve Periods scrolls inside its card; each opens,
     and reopens on every Scope change, scrolled to the To Period. */
  private chartScrolls = viewChildren<ElementRef<HTMLElement>>('chartScroll');
  private scrollChartsToToPeriod = afterRenderEffect(() => {
    this.report();
    for (const { nativeElement } of this.chartScrolls()) {
      nativeElement.scrollLeft = nativeElement.scrollWidth;
    }
  });

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
    const snapshot: CashBasisSnapshot = { accounts, categories, transactions, transfers, baseCurrency };
    this.snapshot.set(snapshot);
    /* Issue #216: every load — entering the screen or a Restore — opens on
       the default Scope, Year to date (ADR 0029); Stats is read-only, so
       nothing else reloads it. */
    this.scope.set(defaultStatsScope([...transactions, ...transfers]));
    this.isLoaded.set(true);
    this.rates.set(currenciesNeedingRates(snapshot).length === 0 ? noRatesNeeded : ratesPending);
    const rates = await this.fetchRates(snapshot);
    /* A newer load owns the screen now; its own fetch settles the rates. */
    if (this.snapshot() === snapshot) this.rates.set(rates);
  }

  private reloadDataOnVersionChange = this.dataVersion.reloadOnChange(() => this.loadAll());

  /* The screen's one asynchronous step besides loading. Any rejection —
     offline with nothing cached, a failed or timed-out fetch — leaves the
     rates unavailable; the rate service's cache still answers offline. */
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

  onScopeChange(scope: Scope): void {
    this.scope.set(scope);
    this.scopeAnnouncement.set(this.language.scopeLabel(scope));
  }

  scopeLabelText(): string {
    return this.language.scopeLabel(this.scope());
  }

  /* The balances and the chart captions are as of the To Period. */
  toPeriodLabel(): string {
    return this.language.periodName(this.scope().to);
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

  /* A card row's "used X of limit" caption, in the card's own currency. */
  usedOfLimitText(item: AccountBalance): string {
    if (item.usedOfLimit == null) return '';
    const { used, limit } = item.usedOfLimit;
    return this.language.t('stats.usedOfLimit', {
      used: this.formatAccountBalance(used, item.account.currency),
      limit: this.formatAccountBalance(limit, item.account.currency),
    });
  }

  netChartZeroPct(): number {
    return zeroPct(this.netChartExtremes());
  }

  balanceZeroPct(): number {
    return zeroPct(this.balanceExtremes());
  }

  barHeight(value: number): number {
    return fillPct(value, this.netChartExtremes());
  }

  /* Scale anchor: the figures the Net chart's scale edges are worth — the
     tallest column above the line and the deepest overdrawn Net below it,
     signed. Stated so the relative heights get absolute meaning. */
  netChartScalePeak(): number {
    return this.netChartExtremes().up;
  }

  netChartScaleOverdrawn(): number {
    return -this.netChartExtremes().down;
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
  netChartFigures(item: PeriodCashFlow): string {
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
