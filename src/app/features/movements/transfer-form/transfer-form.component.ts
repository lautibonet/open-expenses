import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TransferService } from '../../../core/services/transfer.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { CategoryService } from '../../../core/services/category.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslationError, errorCopy } from '../../../core/models/translation-error';
import { Transfer } from '../../../core/models/transfer.model';
import { Transaction } from '../../../core/models/transaction.model';
import { Account, isCreditCard } from '../../../core/models/account.model';
import { Category, isIncomeCategory } from '../../../core/models/category.model';
import { periodEndBalance } from '../../../core/balances/period-end-balances';
import {
  ExchangeRateWellComponent,
  ExchangeRateWellLabels,
  RateSeed,
  RateState,
} from '../../../shared/components/exchange-rate-well/exchange-rate-well.component';
import {
  MONTH_NUMBERS,
  MonthNumber,
  defaultScope,
  getCurrentYear,
  getPeriodYear,
  periodYearFromDate,
} from '../../../core/types/period.type';
import {
  dateToLocalISO,
  parseLocalDate,
  todayLocalISO,
} from '../../../core/format/local-date';

export interface TransferFormState {
  sourceAccountId: number;
  destAccountId: number;
  /* Null while a field is empty; the Save guard requires a positive source amount. */
  sourceAmount: number | null;
  destinationAmount: number | null;
  exchangeRate: number;
  date: string;
  period: MonthNumber;
  year: number;
  note: string;
  /* The Card Payment's Expense category; null on every other Transfer kind. */
  categoryId: number | null;
}

export interface TransferDraft {
  form: TransferFormState;
  editingId: number | null;
  rateState: RateState;
}

/* The well renders the Transfer Form's own copy; the aria labels are shared
   with the Transaction Form's generic rate-field labels. */
const RATE_LABELS: ExchangeRateWellLabels = {
  heading: 'movements.exchangeRate',
  fetching: 'movements.fetchingRate',
  equivalent: 'movements.destAmount',
  suggested: 'movements.suggestedRate',
  rateAria: 'transactionForm.exchangeRateAria',
  equivalentAria: 'transactionForm.equivalentAria',
  errorOffline: 'movements.error.offlineRate',
  errorFetch: 'movements.error.rateFetch',
};

const today = todayLocalISO;

function defaultFormState(accounts: Account[]): TransferFormState {
  const sourceAccountId = accounts[0]?.id ?? 0;
  const destAccountId = accounts[1]?.id ?? accounts[0]?.id ?? 0;
  const date = today();
  return {
    sourceAccountId,
    destAccountId,
    sourceAmount: null,
    destinationAmount: null,
    exchangeRate: 1,
    date,
    ...periodYearFromDate(date),
    note: '',
    categoryId: null,
  };
}

@Component({
  selector: 'app-transfer-form',
  imports: [FormsModule, ExchangeRateWellComponent],
  templateUrl: './transfer-form.component.html',
  styleUrl: './transfer-form.component.scss',
})
export class TransferFormComponent implements AfterViewInit {
  language = inject(LanguageService);
  private transferService = inject(TransferService);
  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);

  private editApplyEffect = effect(() => this.handleEditInput(this.editTransfer()));

  accounts = input<Account[]>([]);
  categories = input<Category[]>([]);
  editTransfer = input<Transfer | null>(null);
  initialDraft = input<TransferDraft | null>(null);
  /* Hosted inside the mobile capture bottom sheet (#104): the sheet already
     covers the screen, so the heading's scroll-into-view must not scroll
     the page behind it. */
  inSheet = input(false);

  saved = output<boolean>();
  close = output<void>();

  formHeading = viewChild<ElementRef<HTMLHeadingElement>>('formHeading');

  months = MONTH_NUMBERS;
  years = Array.from({ length: 10 }, (_, i) => getCurrentYear() - i);

  editingId = signal<number | null>(null);
  form = signal<TransferFormState>(defaultFormState([]));
  /* The selected card's outstanding debt, shown as a Card Payment hint. */
  cardBalance = signal<number | null>(null);

  rateState = signal<RateState>({ loading: false, error: '', rate: null, date: '' });
  rateSeed = signal<RateSeed | null>(null);
  rateLabels = RATE_LABELS;
  errorMessage = signal('');
  errorDetail = signal('');
  saving = signal(false);

  private selectedAccounts = computed(() => {
    const f = this.form();
    return {
      src: this.accounts().find((a) => a.id === f.sourceAccountId),
      dst: this.accounts().find((a) => a.id === f.destAccountId),
    };
  });

  /* The destination Credit Card when the Transfer is into a card — the Card
     Payment capture — otherwise null. */
  cardDestination = computed(() => {
    const dst = this.selectedAccounts().dst;
    return dst && isCreditCard(dst) ? dst : null;
  });

  /* Expense categories only: a Card Payment's category is an Expense by
     definition (ADR 0022). */
  paymentCategories = computed(() =>
    this.categories().filter((c) => c.type === 'expense'),
  );

  isForeignCurrency = computed(() => {
    const { src, dst } = this.selectedAccounts();
    return !!src && !!dst && src.currency !== dst.currency;
  });

  sourceCurrency = computed(() => this.selectedAccounts().src?.currency ?? '');

  destCurrency = computed(() => this.selectedAccounts().dst?.currency ?? '');

  filteredDestinationAccounts = computed(() => {
    const sourceId = this.form().sourceAccountId;
    if (!sourceId) return this.accounts();
    return this.accounts().filter((a) => a.id !== sourceId);
  });

  canSubmit = computed(() => {
    const f = this.form();
    if (!f.sourceAccountId || !f.destAccountId) return false;
    if (f.sourceAccountId === f.destAccountId) return false;
    if (this.cardDestination() && !f.categoryId) return false;
    if (!((f.sourceAmount ?? 0) > 0)) return false;
    if (this.isForeignCurrency() && this.rateState().loading) return false;
    return !this.saving();
  });

  disabledReason = computed(() => {
    if (this.saving()) return '';
    const f = this.form();
    if (!f.sourceAccountId || !f.destAccountId) {
      return this.language.t('movements.saveDisabled.accounts');
    }
    if (f.sourceAccountId === f.destAccountId) {
      return this.language.t('movements.saveDisabled.distinct');
    }
    if (this.cardDestination() && !f.categoryId) {
      return this.language.t('movements.saveDisabled.paymentCategory');
    }
    if (!((f.sourceAmount ?? 0) > 0)) return this.language.t('movements.saveDisabled.amount');
    if (this.isForeignCurrency() && this.rateState().loading) {
      return this.language.t('movements.saveDisabled.rate');
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
      void this.refreshCardBalance();
      return;
    }
    const form = defaultFormState(this.accounts());
    const dest = this.accounts().find((a) => a.id === form.destAccountId);
    if (dest && isCreditCard(dest)) {
      form.categoryId = this.paymentCategoryIdFor(dest);
    }
    this.form.set(form);
    void this.refreshCardBalance();
  }

  ngAfterViewInit(): void {
    const heading = this.formHeading()?.nativeElement;
    if (!this.inSheet() && heading && typeof heading.scrollIntoView === 'function') {
      heading.scrollIntoView({
        behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }
    heading?.focus();
  }

  draft(): TransferDraft {
    return {
      form: this.form(),
      editingId: this.editingId(),
      rateState: this.rateState(),
    };
  }

  onSourceChange(sourceId: number): void {
    this.form.update((f) => {
      const destChanged = f.destAccountId === sourceId;
      return {
        ...f,
        sourceAccountId: sourceId,
        destAccountId: destChanged ? 0 : f.destAccountId,
        categoryId: destChanged ? null : f.categoryId,
      };
    });
    void this.refreshCardBalance();
  }

  onDestChange(destId: number): void {
    const dest = this.accounts().find((a) => a.id === destId);
    const categoryId = dest && isCreditCard(dest) ? this.paymentCategoryIdFor(dest) : null;
    this.form.update((f) => ({ ...f, destAccountId: destId, categoryId }));
    void this.refreshCardBalance();
  }

  onPaymentCategoryChange(value: number | null): void {
    this.form.update((f) => ({ ...f, categoryId: value == null ? null : Number(value) }));
  }

  formatMoney(amount: number, currency: string): string {
    return this.language.formatMoney(amount, currency);
  }

  /* The card's payment category. Prefer the stored link so the pre-fill
     survives a rename or a Language change; fall back to the category named
     after the card for cards created before the link was stored. */
  private paymentCategoryIdFor(card: Account): number | null {
    if (card.paymentCategoryId != null && this.paymentCategories().some((c) => c.id === card.paymentCategoryId)) {
      return card.paymentCategoryId;
    }
    const name = this.language.t('category.cardPayment', { name: card.name });
    const match = this.paymentCategories().find((c) => c.name === name);
    return match?.id ?? null;
  }

  /* The destination card's outstanding debt: its balance accumulated over
     every recorded movement through the current Period. */
  private async refreshCardBalance(): Promise<void> {
    const card = this.cardDestination();
    if (!card) {
      this.cardBalance.set(null);
      return;
    }
    const [transactions, transfers, categories] = await Promise.all([
      this.transactionService.getAll(),
      this.transferService.getAll(),
      this.categoryService.getAll(),
    ]);
    const isIncome = (t: Transaction): boolean =>
      isIncomeCategory(categories.find((c) => c.id === t.categoryId)?.type);
    this.cardBalance.set(
      periodEndBalance(
        { account: card, transactions, transfers, isIncome },
        defaultScope(),
      ),
    );
  }

  onSourceAmountChange(value: number | null): void {
    this.form.update((f) => ({ ...f, sourceAmount: value }));
    this.computeDestinationAmount();
  }

  onDateChange(date: string): void {
    this.form.update((f) => ({ ...f, date, ...periodYearFromDate(date) }));
  }

  onWellStateChange(state: RateState): void {
    this.rateState.set(state);
    if (state.rate !== null) {
      this.form.update((f) => ({ ...f, exchangeRate: state.rate! }));
    }
    this.computeDestinationAmount();
  }

  private computeDestinationAmount(): void {
    this.form.update((f) => ({
      ...f,
      destinationAmount:
        f.sourceAmount === null
          ? null
          : Math.round(f.sourceAmount * f.exchangeRate * 100) / 100,
    }));
  }

  cancel(): void {
    this.close.emit();
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    const f = this.form();
    this.saving.set(true);
    try {
      if (this.editingId() !== null) {
        await this.transferService.update(this.editingId()!, {
          sourceAccountId: f.sourceAccountId,
          destinationAccountId: f.destAccountId,
          sourceAmount: f.sourceAmount!,
          destinationAmount: f.destinationAmount!,
          exchangeRate: f.exchangeRate,
          date: parseLocalDate(f.date),
          period: f.period,
          year: f.year,
          note: f.note,
          categoryId: f.categoryId ?? undefined,
        });
      } else {
        await this.transferService.create(
          f.sourceAccountId,
          f.destAccountId,
          f.sourceAmount!,
          parseLocalDate(f.date),
          f.period,
          f.note,
          f.exchangeRate,
          f.year,
          f.categoryId,
        );
      }
      this.saving.set(false);
      this.saved.emit(this.editingId() !== null);
    } catch (e: unknown) {
      this.saving.set(false);
      this.errorMessage.set(
        errorCopy(e, this.language.translateFn, 'movements.error.saveFailed'),
      );
      this.errorDetail.set(
        e instanceof TranslationError ? '' : e instanceof Error ? e.message : String(e),
      );
    }
  }

  private handleEditInput(t: Transfer | null): void {
    if (!t) return;
    const date = dateToLocalISO(new Date(t.date));
    this.editingId.set(t.id ?? null);
    this.form.set({
      sourceAccountId: t.sourceAccountId,
      destAccountId: t.destinationAccountId,
      sourceAmount: t.sourceAmount,
      destinationAmount: t.destinationAmount,
      exchangeRate: t.exchangeRate,
      date,
      period: t.period,
      year: getPeriodYear(t),
      note: t.note,
      categoryId: t.categoryId ?? null,
    });
    const src = this.accounts().find((a) => a.id === t.sourceAccountId);
    const dst = this.accounts().find((a) => a.id === t.destinationAccountId);
    this.rateSeed.set(
      src && dst && src.currency !== dst.currency ? { rate: t.exchangeRate, date: 'stored' } : null,
    );
    this.rateState.set({ loading: false, error: '', rate: null, date: '' });
    this.errorMessage.set('');
    this.errorDetail.set('');
    void this.refreshCardBalance();
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
