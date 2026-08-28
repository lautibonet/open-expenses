import {
  Component,
  computed,
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
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { OfflineError } from '../../../core/models/offline-error';
import { getCurrentPeriod, getCurrentYear, MonthName } from '../../../core/types/period.type';

export interface QuickAddSelection {
  accountId: number;
  categoryId: number;
  amount: number;
  date: string;
  period: MonthName;
  year: number;
}

export interface QuickAddSaveData extends QuickAddSelection {
  exchangeRate: number | null;
  baseCurrencyAmount: number | null;
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
}

@Component({
  selector: 'app-quick-add-card',
  imports: [FormsModule],
  templateUrl: './quick-add-card.component.html',
  styleUrl: './quick-add-card.component.scss',
})
export class QuickAddCardComponent implements OnInit, AfterViewInit {
  private exchangeRateService = inject(ExchangeRateService);

  private selectionInitialized = false;

  accounts = input<Account[]>([]);
  categories = input<Category[]>([]);
  baseCurrency = input('EUR');

  saved = output<QuickAddSaveData>();
  expand = output<QuickAddSelection>();

  amountInput = viewChild<ElementRef<HTMLInputElement>>('amountInput');

  accountId = signal<number>(0);
  categoryId = signal<number>(0);
  amount = signal<number>(0);
  date = signal<string>(new Date().toISOString().split('T')[0]);
  period = signal<MonthName>(getCurrentPeriod());
  year = signal<number>(getCurrentYear());

  rateState = signal<RateState>({ loading: false, error: '', rate: null });
  errorMessage = signal('');
  announcement = signal('');
  saving = signal(false);

  selectedAccount = computed(() =>
    this.accounts().find(a => a.id === this.accountId()),
  );

  isForeignCurrency = computed(() => {
    const account = this.selectedAccount();
    return !!account && account.currency !== this.baseCurrency();
  });

  canSubmit = computed(() => {
    if (!this.accountId() || !this.categoryId()) return false;
    if (this.amount() <= 0) return false;
    if (this.isForeignCurrency() && this.rateState().loading) return false;
    if (this.saving()) return false;
    return true;
  });

  async ngOnInit(): Promise<void> {
    this.applyStoredSelection();
  }

  ngAfterViewInit(): void {
    this.focusAmount();
  }

  focusAmount(): void {
    this.amountInput()?.nativeElement?.focus();
  }

  onAmountChange(value: number): void {
    this.amount.set(value);
    this.errorMessage.set('');
    this.announcement.set('');
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
      if (accounts.some(a => a.id === stored.accountId)) {
        accountId = stored.accountId;
      }
      if (categories.some(c => c.id === stored.categoryId)) {
        categoryId = stored.categoryId;
      }
    }

    this.accountId.set(accountId);
    this.categoryId.set(categoryId);

    if (accountId) {
      this.checkRate(accountId);
    }
  }

  onAccountChange(value: number): void {
    this.accountId.set(value);
    this.rateState.set({ loading: false, error: '', rate: null });
    this.errorMessage.set('');
    this.checkRate(value);
  }

  onCategoryChange(value: number): void {
    this.categoryId.set(value);
  }

  private async checkRate(accountId: number): Promise<void> {
    const account = this.accounts().find(a => a.id === accountId);
    if (!account) return;

    if (account.currency === this.baseCurrency()) {
      this.rateState.set({ loading: false, error: '', rate: null });
      return;
    }

    this.rateState.update(s => ({ ...s, loading: true, error: '' }));

    try {
      const result = await this.exchangeRateService.getRate(
        account.currency, this.baseCurrency(), this.date(),
      );
      this.rateState.set({ loading: false, error: '', rate: result.rate });
    } catch (e: unknown) {
      const msg = e instanceof OfflineError
        ? 'You are offline. Open the full form to enter the rate manually.'
        : 'Could not fetch the rate. Open the full form to enter it manually.';
      this.rateState.set({ loading: false, error: msg, rate: null });
    }
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;

    const account = this.selectedAccount();
    const selection: QuickAddSelection = {
      accountId: this.accountId(),
      categoryId: this.categoryId(),
      amount: this.amount(),
      date: this.date(),
      period: this.period(),
      year: this.year(),
    };

    let exchangeRate: number | null = null;
    let baseCurrencyAmount: number | null = null;

    if (account && account.currency !== this.baseCurrency()) {
      const rate = this.rateState().rate;
      if (rate === null) {
        this.expand.emit(selection);
        return;
      }
      exchangeRate = rate;
      baseCurrencyAmount = Math.round(selection.amount * rate * 100) / 100;
    }

    this.persistSelection(selection.accountId, selection.categoryId);
    this.saving.set(true);
    this.saved.emit({ ...selection, exchangeRate, baseCurrencyAmount });
  }

  resetForNext(): void {
    this.saving.set(false);
    this.amount.set(0);
    this.errorMessage.set('');
    this.announcement.set('Transaction saved');
    this.focusAmount();
  }

  failSave(): void {
    this.saving.set(false);
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
