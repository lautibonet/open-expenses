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
import { Transfer, needsBaseExchangeRate, transferBaseAmount } from '../../../core/models/transfer.model';
import { Transaction } from '../../../core/models/transaction.model';
import { Account, isCreditCard } from '../../../core/models/account.model';
import { Category, isIncomeCategory } from '../../../core/models/category.model';
import { storedPaymentCategory } from '../../../core/payment-category/payment-category-rules';
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
  getCurrentYear,
  getPeriodYear,
  periodYearFromDate,
} from '../../../core/types/period.type';
import { defaultScope } from '../../../core/scope/scope';
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
  /* ADR 0028: the source-to-base rate, used only when neither account is in
     the Base Currency; null until the well supplies one. */
  baseExchangeRate: number | null;
  date: string;
  period: MonthNumber;
  year: number;
  note: string;
}

export interface TransferDraft {
  form: TransferFormState;
  editingId: number | null;
  rateState: RateState;
  baseRateState: RateState;
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

/* ADR 0028: the second well, converting the source amount to the Base
   Currency when neither account is in it. */
const BASE_RATE_LABELS: ExchangeRateWellLabels = {
  ...RATE_LABELS,
  heading: 'movements.baseExchangeRate',
};

const EMPTY_RATE_STATE: RateState = { loading: false, error: '', rate: null, date: '' };

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
    baseExchangeRate: null,
    date,
    ...periodYearFromDate(date),
    note: '',
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
  baseCurrency = input('EUR');
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

  rateState = signal<RateState>(EMPTY_RATE_STATE);
  rateSeed = signal<RateSeed | null>(null);
  rateLabels = RATE_LABELS;
  baseRateState = signal<RateState>(EMPTY_RATE_STATE);
  baseRateSeed = signal<RateSeed | null>(null);
  baseRateLabels = BASE_RATE_LABELS;
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

  /* The destination card's Payment Category: its stored link only, never a
     category resolved by name (ADR 0026). */
  private cardPaymentCategory = computed(() => {
    const card = this.cardDestination();
    return card ? storedPaymentCategory(card, this.categories()) : undefined;
  });

  /* The name shown in the readonly payment category field. */
  paymentCategoryName = computed(() => this.cardPaymentCategory()?.name ?? '');

  /* A destination card without a usable link cannot be paid until it is
     renamed: Save stays disabled and the hint says why, ahead of any other
     reason, since no amount would make the save possible. */
  cardWithoutPaymentCategory = computed(
    () => !!this.cardDestination() && !this.cardPaymentCategory(),
  );

  isForeignCurrency = computed(() => {
    const { src, dst } = this.selectedAccounts();
    return !!src && !!dst && src.currency !== dst.currency;
  });

  /* ADR 0028: neither account is in the Base Currency, so the Transfer needs
     its own rate to express the source side in it. */
  needsBaseRate = computed(() => {
    const { src, dst } = this.selectedAccounts();
    return !!src && !!dst && needsBaseExchangeRate(src.currency, dst.currency, this.baseCurrency());
  });

  /* The second well's target: empty hides it. */
  baseRateTarget = computed(() => (this.needsBaseRate() ? this.baseCurrency() : ''));

  baseCurrencyAmount = computed(() => {
    const f = this.form();
    if (!this.needsBaseRate() || f.sourceAmount === null) return null;
    return transferBaseAmount(
      {
        sourceAmount: f.sourceAmount,
        destinationAmount: f.destinationAmount ?? 0,
        baseExchangeRate: f.baseExchangeRate ?? undefined,
      },
      this.sourceCurrency(),
      this.destCurrency(),
      this.baseCurrency(),
    );
  });

  /* Either well is still fetching its rate. */
  private isRateLoading = computed(
    () =>
      (this.isForeignCurrency() && this.rateState().loading) ||
      (this.needsBaseRate() && this.baseRateState().loading),
  );

  private isBaseRateMissing = computed(
    () => this.needsBaseRate() && !this.baseRateState().loading && !(this.form().baseExchangeRate! > 0),
  );

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
    if (!((f.sourceAmount ?? 0) > 0)) return false;
    if (this.isRateLoading()) return false;
    if (this.isBaseRateMissing()) return false;
    if (this.cardWithoutPaymentCategory()) return false;
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
    if (this.cardWithoutPaymentCategory()) {
      return this.language.t('errors.cardHasNoPaymentCategory');
    }
    if (!((f.sourceAmount ?? 0) > 0)) return this.language.t('movements.saveDisabled.amount');
    if (this.isRateLoading()) {
      return this.language.t('movements.saveDisabled.rate');
    }
    if (this.isBaseRateMissing()) {
      return this.language.t('errors.baseExchangeRateRequired');
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
      this.baseRateSeed.set({
        rate: draft.baseRateState.rate,
        date: draft.baseRateState.date,
        error: draft.baseRateState.error || undefined,
      });
      void this.refreshCardBalance();
      return;
    }
    this.form.set(defaultFormState(this.accounts()));
    void this.refreshCardBalance();
  }

  ngAfterViewInit(): void {
    const heading = this.formHeading()?.nativeElement;
    if (!this.inSheet() && heading && typeof heading.scrollIntoView === 'function') {
      heading.scrollIntoView({
        behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'nearest',
      });
    }
    heading?.focus();
  }

  draft(): TransferDraft {
    return {
      form: this.form(),
      editingId: this.editingId(),
      rateState: this.rateState(),
      baseRateState: this.baseRateState(),
    };
  }

  onSourceChange(sourceId: number): void {
    this.form.update((f) => {
      const destChanged = f.destAccountId === sourceId;
      return {
        ...f,
        sourceAccountId: sourceId,
        destAccountId: destChanged ? 0 : f.destAccountId,
      };
    });
    void this.refreshCardBalance();
  }

  onDestChange(destId: number): void {
    this.form.update((f) => ({ ...f, destAccountId: destId }));
    void this.refreshCardBalance();
  }

  formatMoney(amount: number, currency: string): string {
    return this.language.formatMoney(amount, currency);
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

  onBaseWellStateChange(state: RateState): void {
    this.baseRateState.set(state);
    this.form.update((f) => ({ ...f, baseExchangeRate: state.rate }));
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
          baseExchangeRate: this.submittedBaseRate(),
          date: parseLocalDate(f.date),
          period: f.period,
          year: f.year,
          note: f.note,
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
          this.submittedBaseRate(),
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

  private submittedBaseRate(): number | undefined {
    return this.needsBaseRate() ? (this.form().baseExchangeRate ?? undefined) : undefined;
  }

  private handleEditInput(t: Transfer | null): void {
    if (!t) return;
    const date = dateToLocalISO(t.date);
    this.editingId.set(t.id ?? null);
    /* Ticket #173: the payment category always comes from the destination
       card, never from the stored transfer — reopening a payment with a stale
       category shows the one the save will re-resolve. */
    const dst = this.accounts().find((a) => a.id === t.destinationAccountId);
    this.form.set({
      sourceAccountId: t.sourceAccountId,
      destAccountId: t.destinationAccountId,
      sourceAmount: t.sourceAmount,
      destinationAmount: t.destinationAmount,
      exchangeRate: t.exchangeRate,
      baseExchangeRate: t.baseExchangeRate ?? null,
      date,
      period: t.period,
      year: getPeriodYear(t),
      note: t.note,
    });
    const src = this.accounts().find((a) => a.id === t.sourceAccountId);
    this.rateSeed.set(
      src && dst && src.currency !== dst.currency ? { rate: t.exchangeRate, date: 'stored' } : null,
    );
    this.rateState.set(EMPTY_RATE_STATE);
    /* An old Transfer without a stored base rate fetches a suggestion. */
    this.baseRateSeed.set(
      t.baseExchangeRate != null ? { rate: t.baseExchangeRate, date: 'stored' } : null,
    );
    this.baseRateState.set(EMPTY_RATE_STATE);
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
