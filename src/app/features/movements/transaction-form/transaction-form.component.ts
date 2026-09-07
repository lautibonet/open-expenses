import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
  AfterViewInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Account } from '../../../core/models/account.model';
import { Category } from '../../../core/models/category.model';
import { Transaction } from '../../../core/models/transaction.model';
import {
  ExchangeRateWellComponent,
  ExchangeRateWellLabels,
  RateSeed,
  RateState,
} from '../../../shared/components/exchange-rate-well/exchange-rate-well.component';
import { LanguageService } from '../../../core/services/language.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { errorCopy } from '../../../core/models/translation-error';
import {
  dateToLocalISO,
  parseLocalDate,
  todayLocalISO,
} from '../../../core/format/local-date';
import {
  getCurrentYear,
  isMonthNumber,
  MONTH_NUMBERS,
  MonthNumber,
  periodYearFromDate,
} from '../../../core/types/period.type';

export interface TransactionFormDraft {
  form: TransactionFormState;
  editingId: number | null;
  rateState: RateState;
}

/* The well renders the Transaction Form's own copy (issue #98/#108). */
const RATE_LABELS: ExchangeRateWellLabels = {
  heading: 'transactionForm.exchangeRate',
  fetching: 'transactionForm.fetchingRate',
  equivalent: 'transactionForm.equivalent',
  suggested: 'transactionForm.suggestedRate',
  rateAria: 'transactionForm.exchangeRateAria',
  equivalentAria: 'transactionForm.equivalentAria',
  errorOffline: 'transactionForm.error.offlineRate',
  errorFetch: 'transactionForm.error.rateFetch',
};

const STORAGE_KEY = 'open-expenses.transaction-form.last-selection';

interface LastSelection {
  accountId: number;
  categoryId: number;
}

interface TransactionFormState {
  accountId: number;
  categoryId: number;
  /* Null while the field is empty; the Save guard requires a positive amount. */
  amount: number | null;
  date: string;
  period: MonthNumber;
  year: number;
  note: string;
  exchangeRate: number | null;
  baseCurrencyAmount: number | null;
}

export type { TransactionFormState };

const round2 = (n: number): number => Math.round(n * 100) / 100;

function defaultFormState(accountId = 0, categoryId = 0): TransactionFormState {
  return {
    accountId,
    categoryId,
    amount: null,
    date: todayLocalISO(),
    ...periodYearFromDate(todayLocalISO()),
    note: '',
    exchangeRate: null,
    baseCurrencyAmount: null,
  };
}

@Component({
  selector: 'app-transaction-form',
  imports: [FormsModule, ExchangeRateWellComponent],
  templateUrl: './transaction-form.component.html',
  styleUrl: './transaction-form.component.scss',
})
export class TransactionFormComponent implements OnInit, AfterViewInit {
  language = inject(LanguageService);
  private transactionService = inject(TransactionService);

  private selectionInitialized = false;
  private editApplyEffect = effect(() => this.handleEditInput(this.editTransaction()));

  accounts = input<Account[]>([]);
  categories = input<Category[]>([]);
  baseCurrency = input('EUR');
  editTransaction = input<Transaction | null>(null);
  initialDraft = input<TransactionFormDraft | null>(null);
  /* Hosted inside the mobile capture bottom sheet (#103): the sheet already
     covers the screen, so the heading's scroll-into-view must not scroll
     the page behind it. */
  inSheet = input(false);

  saved = output<boolean>();
  close = output<void>();

  formHeading = viewChild<ElementRef<HTMLHeadingElement>>('formHeading');

  months = MONTH_NUMBERS;
  years = Array.from({ length: 10 }, (_, i) => getCurrentYear() - i);

  editingId = signal<number | null>(null);
  form = signal<TransactionFormState>(defaultFormState());

  rateState = signal<RateState>({ loading: false, error: '', rate: null, date: '' });
  rateSeed = signal<RateSeed | null>(null);
  rateLabels = RATE_LABELS;
  errorMessage = signal('');
  saving = signal(false);

  selectedAccount = computed(() => this.accounts().find((a) => a.id === this.form().accountId));

  isForeignCurrency = computed(() => {
    const account = this.selectedAccount();
    return !!account && account.currency !== this.baseCurrency();
  });

  canSubmit = computed(() => {
    const f = this.form();
    if (!f.accountId || !f.categoryId) return false;
    if (!((f.amount ?? 0) > 0)) return false;
    if (this.saving()) return false;
    if (this.isForeignCurrency()) {
      if (this.rateState().loading) return false;
      if (f.exchangeRate === null) return false;
    }
    return true;
  });

  disabledReason = computed(() => {
    if (this.saving()) return '';
    const f = this.form();
    if (!f.accountId) return this.language.t('transactionForm.saveDisabled.account');
    if (!f.categoryId) return this.language.t('transactionForm.saveDisabled.category');
    if (!((f.amount ?? 0) > 0)) return this.language.t('transactionForm.saveDisabled.amount');
    if (this.isForeignCurrency()) {
      if (this.rateState().loading || f.exchangeRate === null) {
        return this.language.t('transactionForm.saveDisabled.rate');
      }
    }
    return '';
  });

  ngOnInit(): void {
    const draft = this.initialDraft();
    if (draft) {
      this.editingId.set(draft.editingId);
      this.form.set(draft.form);
      this.rateSeed.set({
        rate: draft.rateState.rate,
        date: draft.rateState.date,
        error: draft.rateState.error || undefined,
      });
      this.selectionInitialized = true;
      return;
    }
    this.applyStoredSelection();
  }

  ngAfterViewInit(): void {
    const heading = this.formHeading()?.nativeElement;
    if (!this.inSheet() && heading && typeof heading.scrollIntoView === 'function') {
      heading.scrollIntoView({
        behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }

  draft(): TransactionFormDraft {
    return {
      form: this.form(),
      editingId: this.editingId(),
      rateState: this.rateState(),
    };
  }

  onAmountChange(value: number | null): void {
    this.form.update((f) => ({ ...f, amount: value }));
    this.errorMessage.set('');
  }

  onAccountChange(value: number): void {
    this.form.update((f) => ({ ...f, accountId: value }));
    this.errorMessage.set('');
  }

  onCategoryChange(value: number): void {
    this.form.update((f) => ({ ...f, categoryId: value }));
  }

  onDateChange(value: string): void {
    this.form.update((f) => ({ ...f, date: value, ...periodYearFromDate(value) }));
  }

  onAmountOrRateChange(): void {
    this.errorMessage.set('');
    this.recomputeBaseCurrencyAmount();
  }

  cancel(): void {
    this.close.emit();
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) {
      if (this.isForeignCurrency() && !this.rateState().loading && this.form().exchangeRate === null) {
        this.errorMessage.set(this.language.t('transactionForm.error.rateFetch'));
      }
      return;
    }

    const f = this.form();
    const foreign = this.isForeignCurrency();
    const exchangeRate = foreign ? f.exchangeRate : null;
    const baseCurrencyAmount = foreign ? round2(f.amount! * f.exchangeRate!) : null;

    this.persistSelection(f.accountId, f.categoryId);
    this.saving.set(true);
    try {
      if (this.editingId() != null) {
        await this.transactionService.update(this.editingId()!, {
          accountId: f.accountId,
          categoryId: f.categoryId,
          amount: f.amount!,
          date: parseLocalDate(f.date),
          period: f.period,
          year: f.year,
          exchangeRate,
          baseCurrencyAmount,
          note: f.note,
        });
      } else {
        await this.transactionService.create(
          f.accountId,
          f.categoryId,
          f.amount!,
          parseLocalDate(f.date),
          f.period,
          exchangeRate,
          baseCurrencyAmount,
          f.year,
          f.note,
        );
      }
      this.saving.set(false);
      this.saved.emit(this.editingId() != null);
    } catch (e: unknown) {
      this.saving.set(false);
      this.errorMessage.set(
        errorCopy(e, this.language.translateFn, 'transactionForm.error.failedToSave'),
      );
    }
  }

  private handleEditInput(t: Transaction | null): void {
    if (!t) return;

    const date = dateToLocalISO(new Date(t.date));
    const fallback = periodYearFromDate(date);
    this.editingId.set(t.id ?? null);
    this.form.set({
      accountId: t.accountId,
      categoryId: t.categoryId,
      amount: t.amount,
      date,
      period: isMonthNumber(t.period) ? t.period : fallback.period,
      year: t.year || fallback.year,
      note: t.note ?? '',
      exchangeRate: t.exchangeRate,
      baseCurrencyAmount: t.baseCurrencyAmount,
    });
    this.resetRateSeed(t.exchangeRate != null ? { rate: t.exchangeRate, date: 'stored' } : null);
    this.errorMessage.set('');
  }

  private applyStoredSelection(): void {
    if (this.selectionInitialized) return;
    this.selectionInitialized = true;

    const accounts = this.accounts();
    const categories = this.categories();

    let accountId = accounts[0]?.id ?? 0;
    let categoryId = categories[0]?.id ?? 0;

    const stored = this.readStoredSelection();
    if (stored) {
      if (accounts.some((a) => a.id === stored.accountId)) {
        accountId = stored.accountId;
      }
      if (categories.some((c) => c.id === stored.categoryId)) {
        categoryId = stored.categoryId;
      }
    }

    this.form.set(defaultFormState(accountId, categoryId));
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private resetRateSeed(seed: RateSeed | null = null): void {
    this.rateSeed.set(seed);
    this.rateState.set({ loading: false, error: '', rate: null, date: '' });
  }

  onWellStateChange(state: RateState): void {
    this.rateState.set(state);
    this.form.update((f) => ({ ...f, exchangeRate: state.rate }));
    this.recomputeBaseCurrencyAmount();
  }

  private recomputeBaseCurrencyAmount(): void {
    const f = this.form();
    if (f.exchangeRate && (f.amount ?? 0) > 0) {
      this.form.update((ff) => ({
        ...ff,
        baseCurrencyAmount: round2(ff.amount! * ff.exchangeRate!),
      }));
    } else {
      this.form.update((ff) => ({ ...ff, baseCurrencyAmount: null }));
    }
  }

  private persistSelection(accountId: number, categoryId: number): void {
    const stored: LastSelection = { accountId, categoryId };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // storage unavailable; fall back to transient defaults
    }
  }

  private readStoredSelection(): LastSelection | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LastSelection;
      if (typeof parsed.accountId === 'number' && typeof parsed.categoryId === 'number') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
}
