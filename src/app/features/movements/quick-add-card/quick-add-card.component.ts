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
import {
  getCurrentPeriod,
  getCurrentYear,
  MONTHS,
  MonthName,
} from '../../../core/types/period.type';
import { TagInputComponent } from '../../../shared/components/tag-input/tag-input.component';

export interface TransactionFormPayload {
  id: number | null;
  accountId: number;
  categoryId: number;
  amount: number;
  date: string;
  period: string;
  year: number;
  tags: string[];
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
  period: MonthName;
  year: number;
  tags: string[];
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
    tags: [],
    note: '',
    exchangeRate: null,
    baseCurrencyAmount: null,
  };
}

@Component({
  selector: 'app-quick-add-card',
  imports: [FormsModule, TagInputComponent],
  templateUrl: './quick-add-card.component.html',
  styleUrl: './quick-add-card.component.scss',
})
export class QuickAddCardComponent implements OnInit, AfterViewInit {
  private exchangeRateService = inject(ExchangeRateService);

  private selectionInitialized = false;
  private editApplyEffect = effect(() => this.handleEditInput(this.editTransaction()));

  accounts = input<Account[]>([]);
  categories = input<Category[]>([]);
  baseCurrency = input('EUR');
  allTags = input<string[]>([]);
  editTransaction = input<Transaction | null>(null);

  save = output<TransactionFormPayload>();
  cancelEdit = output<void>();

  amountInput = viewChild<ElementRef<HTMLInputElement>>('amountInput');

  months = MONTHS;
  years = Array.from({ length: 10 }, (_, i) => getCurrentYear() - i);

  mode = signal<'compact' | 'expanded'>('compact');
  editingId = signal<number | null>(null);
  form = signal<TransactionFormState>(defaultFormState());

  rateState = signal<RateState>({ loading: false, error: '', rate: null, date: '' });
  errorMessage = signal('');
  announcement = signal('');
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
    if (this.isForeignCurrency() && this.rateState().loading) return false;
    if (this.saving()) return false;
    return true;
  });

  ngOnInit(): void {
    this.applyStoredSelection();
  }

  ngAfterViewInit(): void {
    this.focusAmount();
  }

  focusAmount(): void {
    this.amountInput()?.nativeElement?.focus();
  }

  onAmountChange(value: number): void {
    this.form.update((f) => ({ ...f, amount: value }));
    this.errorMessage.set('');
    this.announcement.set('');
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

  onTagsChange(tags: string[]): void {
    this.form.update((f) => ({ ...f, tags }));
  }

  onAmountOrRateChange(): void {
    this.recomputeBaseCurrencyAmount();
  }

  expandForm(): void {
    this.mode.set('expanded');
    this.errorMessage.set('');
    this.checkRate(this.form().accountId, this.form().date);
  }

  cancelExpand(): void {
    const wasEdit = this.editingId() !== null;
    if (wasEdit) {
      this.cancelEdit.emit();
    }
    this.mode.set('compact');
    this.editingId.set(null);
    this.resetFormForNew();
    this.resetRate();
    this.errorMessage.set('');
  }

  onSubmit(): void {
    if (this.canSubmit()) {
      this.submitCompact();
    }
  }

  onSubmitForm(): void {
    if (this.saving()) return;
    this.persistSelection(this.form().accountId, this.form().categoryId);
    this.saving.set(true);
    this.save.emit({
      id: this.editingId(),
      ...this.form(),
    });
  }

  markSaved(wasEdit: boolean): void {
    this.saving.set(false);
    this.mode.set('compact');
    this.editingId.set(null);
    this.resetFormForNew();
    this.resetRate();
    this.announcement.set(wasEdit ? 'Transaction updated' : 'Transaction saved');
  }

  markFailed(message: string): void {
    this.saving.set(false);
    this.errorMessage.set(message);
  }

  getAccountCurrency(accountId: number): string {
    return this.accounts().find((a) => a.id === accountId)?.currency ?? '';
  }

  private submitCompact(): void {
    const f = this.form();
    let exchangeRate: number | null = null;
    let baseCurrencyAmount: number | null = null;

    const account = this.selectedAccount();
    if (account && account.currency !== this.baseCurrency()) {
      const rate = this.rateState().rate;
      if (rate === null) {
        this.expandForm();
        return;
      }
      exchangeRate = rate;
      baseCurrencyAmount = round2(f.amount * rate);
    }

    this.persistSelection(f.accountId, f.categoryId);
    this.saving.set(true);
    this.save.emit({
      id: null,
      accountId: f.accountId,
      categoryId: f.categoryId,
      amount: f.amount,
      date: f.date,
      period: f.period,
      year: f.year,
      tags: [],
      exchangeRate,
      baseCurrencyAmount,
      note: f.note ?? '',
    });
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

  private handleEditInput(t: Transaction | null): void {
    if (!t) {
      if (this.mode() === 'expanded' && this.editingId() !== null) {
        this.mode.set('compact');
        this.editingId.set(null);
        this.resetFormForNew();
        this.resetRate();
      }
      return;
    }

    this.editingId.set(t.id ?? null);
    this.mode.set('expanded');
    this.form.set({
      accountId: t.accountId,
      categoryId: t.categoryId,
      amount: t.amount,
      date: new Date(t.date).toISOString().split('T')[0],
      period: (t.period as MonthName) || getCurrentPeriod(),
      year: t.year || getCurrentYear(),
      tags: [...(t.tags ?? [])],
      note: t.note ?? '',
      exchangeRate: t.exchangeRate,
      baseCurrencyAmount: t.baseCurrencyAmount,
    });
    this.resetRate();
    if (t.exchangeRate) {
      this.rateState.update((s) => ({ ...s, rate: t.exchangeRate, date: 'stored' }));
    }
    this.errorMessage.set('');
    this.announcement.set('');
  }

  private resetFormForNew(): void {
    const prev = this.form();
    this.form.set(defaultFormState(prev.accountId, prev.categoryId));
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
          ? 'You are offline. Enter the exchange rate manually.'
          : 'Could not fetch the rate. Enter it manually.';
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
