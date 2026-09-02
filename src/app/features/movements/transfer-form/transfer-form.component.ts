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
import { LanguageService } from '../../../core/services/language.service';
import { TranslationError, errorCopy } from '../../../core/models/translation-error';
import { Transfer } from '../../../core/models/transfer.model';
import { Account } from '../../../core/models/account.model';
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

export interface TransferFormState {
  sourceAccountId: number;
  destAccountId: number;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  date: string;
  period: MonthNumber;
  year: number;
  note: string;
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
  pair: 'movements.exchangeRatePair',
  equivalent: 'movements.destAmount',
  suggested: 'movements.suggestedRate',
  rateAria: 'transactionForm.exchangeRateAria',
  equivalentAria: 'transactionForm.equivalentAria',
  errorOffline: 'movements.error.offlineRate',
  errorFetch: 'movements.error.rateFetch',
};

const today = (): string => new Date().toISOString().split('T')[0];

function defaultFormState(accounts: Account[]): TransferFormState {
  const sourceAccountId = accounts[0]?.id ?? 0;
  const destAccountId = accounts[1]?.id ?? accounts[0]?.id ?? 0;
  const date = today();
  return {
    sourceAccountId,
    destAccountId,
    sourceAmount: 0,
    destinationAmount: 0,
    exchangeRate: 1,
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

  private editApplyEffect = effect(() => this.handleEditInput(this.editTransfer()));

  accounts = input<Account[]>([]);
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
    if (!(f.sourceAmount > 0)) return false;
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
    if (!(f.sourceAmount > 0)) return this.language.t('movements.saveDisabled.amount');
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
      return;
    }
    this.form.set(defaultFormState(this.accounts()));
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
      const destAccountId = f.destAccountId === sourceId ? 0 : f.destAccountId;
      return { ...f, sourceAccountId: sourceId, destAccountId };
    });
  }

  onDestChange(destId: number): void {
    this.form.update((f) => ({ ...f, destAccountId: destId }));
  }

  onSourceAmountChange(value: number): void {
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
      destinationAmount: Math.round(f.sourceAmount * f.exchangeRate * 100) / 100,
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
          sourceAmount: f.sourceAmount,
          destinationAmount: f.destinationAmount,
          exchangeRate: f.exchangeRate,
          date: new Date(f.date),
          period: f.period,
          year: f.year,
          note: f.note,
        });
      } else {
        await this.transferService.create(
          f.sourceAccountId,
          f.destAccountId,
          f.sourceAmount,
          new Date(f.date),
          f.period,
          f.note,
          f.exchangeRate,
          f.year,
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
    const date = new Date(t.date).toISOString().split('T')[0];
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
    });
    const src = this.accounts().find((a) => a.id === t.sourceAccountId);
    const dst = this.accounts().find((a) => a.id === t.destinationAccountId);
    this.rateSeed.set(
      src && dst && src.currency !== dst.currency ? { rate: t.exchangeRate, date: 'stored' } : null,
    );
    this.rateState.set({ loading: false, error: '', rate: null, date: '' });
    this.errorMessage.set('');
    this.errorDetail.set('');
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
