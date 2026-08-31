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
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { OfflineError } from '../../../core/models/offline-error';
import { LanguageService } from '../../../core/services/language.service';
import {
  getCurrentPeriod,
  getCurrentYear,
  isMonthNumber,
  MONTH_NUMBERS,
  MonthNumber,
} from '../../../core/types/period.type';

export interface TransactionFormPayload {
  id: number | null;
  accountId: number;
  categoryId: number;
  amount: number;
  date: string;
  period: MonthNumber;
  year: number;
  exchangeRate: number | null;
  baseCurrencyAmount: number | null;
  note: string;
}

const STORAGE_KEY = 'open-expenses.quick-add.last-selection';

interface LastSelection {
  accountId: number;
  categoryId: number;
}

interface RateState {
  loading: boolean;
  error: string;
  rate: number | null;
  date: string;
}

interface TransactionFormState {
  accountId: number;
  categoryId: number;
  amount: number;
  date: string;
  period: MonthNumber;
  year: number;
  note: string;
  exchangeRate: number | null;
  baseCurrencyAmount: number | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const today = (): string => new Date().toISOString().split('T')[0];

function defaultFormState(accountId = 0, categoryId = 0): TransactionFormState {
  return {
    accountId,
    categoryId,
    amount: 0,
    date: today(),
    period: getCurrentPeriod(),
    year: getCurrentYear(),
    note: '',
    exchangeRate: null,
    baseCurrencyAmount: null,
  };
}

@Component({
  selector: 'app-quick-add-card',
  imports: [FormsModule],
  templateUrl: './quick-add-card.component.html',
  styleUrl: './quick-add-card.component.scss',
})
export class QuickAddCardComponent implements OnInit, AfterViewInit {
  private exchangeRateService = inject(ExchangeRateService);
  language = inject(LanguageService);

  private selectionInitialized = false;
  private editApplyEffect = effect(() => this.handleEditInput(this.editTransaction()));

  accounts = input<Account[]>([]);
  categories = input<Category[]>([]);
  baseCurrency = input('EUR');
  editTransaction = input<Transaction | null>(null);

  save = output<TransactionFormPayload>();
  close = output<void>();

  amountInput = viewChild<ElementRef<HTMLInputElement>>('amountInput');
  formHeading = viewChild<ElementRef<HTMLHeadingElement>>('formHeading');

  months = MONTH_NUMBERS;
  years = Array.from({ length: 10 }, (_, i) => getCurrentYear() - i);

  editingId = signal<number | null>(null);
  form = signal<TransactionFormState>(defaultFormState());

  rateState = signal<RateState>({ loading: false, error: '', rate: null, date: '' });
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
    if (f.amount <= 0) return false;
    if (this.saving()) return false;
    if (this.isForeignCurrency()) {
      if (this.rateState().loading) return false;
      if (f.exchangeRate === null) return false;
    }
    return true;
  });

  ngOnInit(): void {
    this.applyStoredSelection();
  }

  ngAfterViewInit(): void {
    const heading = this.formHeading()?.nativeElement;
    if (heading && typeof heading.scrollIntoView === 'function') {
      heading.scrollIntoView({
        behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }
    this.focusAmount();
  }

  focusAmount(): void {
    this.amountInput()?.nativeElement?.focus();
  }

  onAmountChange(value: number): void {
    this.form.update((f) => ({ ...f, amount: value }));
    this.errorMessage.set('');
  }

  onAccountChange(value: number): void {
    this.form.update((f) => ({ ...f, accountId: value }));
    this.rateState.set({ loading: false, error: '', rate: null, date: '' });
    this.errorMessage.set('');
    this.checkRate(value, this.form().date);
  }

  onCategoryChange(value: number): void {
    this.form.update((f) => ({ ...f, categoryId: value }));
  }

  onDateChange(value: string): void {
    this.form.update((f) => ({ ...f, date: value }));
    this.checkRate(this.form().accountId, value);
  }

  onAmountOrRateChange(): void {
    this.errorMessage.set('');
    this.recomputeBaseCurrencyAmount();
  }

  cancel(): void {
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      if (this.isForeignCurrency() && !this.rateState().loading && this.form().exchangeRate === null) {
        this.errorMessage.set(this.language.t('quickAdd.error.rateFetch'));
      }
      return;
    }

    const f = this.form();
    const foreign = this.isForeignCurrency();
    const exchangeRate = foreign ? f.exchangeRate : null;
    const baseCurrencyAmount = foreign ? round2(f.amount * f.exchangeRate!) : null;

    this.persistSelection(f.accountId, f.categoryId);
    this.saving.set(true);
    this.save.emit({
      id: this.editingId(),
      ...this.form(),
      exchangeRate,
      baseCurrencyAmount,
    });
  }

  markFailed(message: string): void {
    this.saving.set(false);
    this.errorMessage.set(message);
  }

  getAccountCurrency(accountId: number): string {
    return this.accounts().find((a) => a.id === accountId)?.currency ?? '';
  }

  private handleEditInput(t: Transaction | null): void {
    if (!t) return;

    this.editingId.set(t.id ?? null);
    this.form.set({
      accountId: t.accountId,
      categoryId: t.categoryId,
      amount: t.amount,
      date: new Date(t.date).toISOString().split('T')[0],
      period: isMonthNumber(t.period) ? t.period : getCurrentPeriod(),
      year: t.year || getCurrentYear(),
      note: t.note ?? '',
      exchangeRate: t.exchangeRate,
      baseCurrencyAmount: t.baseCurrencyAmount,
    });
    this.resetRate();
    if (t.exchangeRate) {
      this.rateState.update((s) => ({ ...s, rate: t.exchangeRate, date: 'stored' }));
    }
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

    if (accountId) {
      this.checkRate(accountId, this.form().date);
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private resetRate(): void {
    this.rateState.set({ loading: false, error: '', rate: null, date: '' });
  }

  private async checkRate(accountId: number, date?: string): Promise<void> {
    const account = this.accounts().find((a) => a.id === accountId);
    if (!account || account.currency === this.baseCurrency()) {
      this.form.update((f) => ({ ...f, exchangeRate: null, baseCurrencyAmount: null }));
      this.resetRate();
      return;
    }

    this.rateState.update((s) => ({ ...s, loading: true, error: '' }));

    try {
      const result = await this.exchangeRateService.getRate(
        account.currency,
        this.baseCurrency(),
        date,
      );
      this.rateState.update((s) => ({ ...s, rate: result.rate, date: result.date }));
      this.form.update((f) => ({ ...f, exchangeRate: result.rate }));
      this.recomputeBaseCurrencyAmount();
    } catch (e: unknown) {
      const msg =
        e instanceof OfflineError
          ? this.language.t('quickAdd.error.offlineRate')
          : this.language.t('quickAdd.error.rateFetch');
      this.rateState.update((s) => ({ ...s, error: msg }));
      this.form.update((f) => ({ ...f, exchangeRate: null, baseCurrencyAmount: null }));
    } finally {
      this.rateState.update((s) => ({ ...s, loading: false }));
    }
  }

  private recomputeBaseCurrencyAmount(): void {
    const f = this.form();
    if (f.exchangeRate && f.amount > 0) {
      this.form.update((ff) => ({
        ...ff,
        baseCurrencyAmount: round2(ff.amount * ff.exchangeRate!),
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
