import { Component, DestroyRef, ElementRef, computed, effect, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, Location } from '@angular/common';
import { NgTemplateOutlet } from '@angular/common';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { CaptureFormService } from '../../core/services/capture-form.service';
import { DataVersionService } from '../../core/services/data-version.service';
import { TranslationError, errorCopy } from '../../core/models/translation-error';
import { Transaction } from '../../core/models/transaction.model';
import { Transfer } from '../../core/models/transfer.model';
import { Account } from '../../core/models/account.model';
import { Category, isIncomeCategory } from '../../core/models/category.model';
import {
  MONTH_NUMBERS,
  MonthNumber,
  PeriodScope,
  defaultScope,
  getCurrentPeriod,
  getCurrentYear,
  getPeriodYear,
  isMonthNumber,
  isValidYear,
  periodYearFromDate,
  scopeOptionsFromMovements,
} from '../../core/types/period.type';
import { LanguageService } from '../../core/services/language.service';
import { BottomSheetComponent } from '../../shared/components/bottom-sheet/bottom-sheet.component';
import {
  ExchangeRateWellComponent,
  ExchangeRateWellLabels,
  RateSeed,
  RateState,
} from '../../shared/components/exchange-rate-well/exchange-rate-well.component';
import {
  QuickAddCardComponent,
  QuickAddDraft,
  TransactionFormPayload,
} from './quick-add-card/quick-add-card.component';
import {
  NetFlowCardComponent,
  MovementItem,
} from './net-flow-card/net-flow-card.component';

const EMPTY_RATE_STATE: RateState = { loading: false, error: '', rate: null, date: '' };

/* The well renders the Transfer Form's own copy; the aria labels are shared
   with the Transaction Form's generic rate-field labels. */
const TRANSFER_RATE_LABELS: ExchangeRateWellLabels = {
  heading: 'movements.exchangeRate',
  fetching: 'movements.fetchingRate',
  pair: 'movements.exchangeRatePair',
  equivalent: 'movements.destAmount',
  suggested: 'movements.suggestedRate',
  rateAria: 'quickAdd.exchangeRateAria',
  equivalentAria: 'quickAdd.equivalentAria',
  errorOffline: 'movements.error.offlineRate',
  errorFetch: 'movements.error.rateFetch',
};

interface PendingDelete {
  item: MovementItem;
  snapshot: Transaction | Transfer;
}

interface TransferForm {
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

interface MovementDaySection {
  key: string;
  label: string;
  items: MovementItem[];
}

interface FilterChip {
  kind: 'category' | 'account' | 'search';
  label: string;
}

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultTransferForm(accounts: Account[]): TransferForm {
  const sourceAccountId = accounts[0]?.id ?? 0;
  const destAccountId = accounts[1]?.id ?? accounts[0]?.id ?? 0;
  const date = new Date().toISOString().split('T')[0];
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
  selector: 'app-movements',
  imports: [FormsModule, DatePipe, NgTemplateOutlet, QuickAddCardComponent, NetFlowCardComponent, BottomSheetComponent, ExchangeRateWellComponent],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.scss',
  host: { '(document:keydown)': 'onDocKeydown($event)' },
})
export class MovementsComponent implements OnInit, OnDestroy {
  private transactionService = inject(TransactionService);
  private transferService = inject(TransferService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);
  private captureFormService = inject(CaptureFormService);
  private dataVersion = inject(DataVersionService);
  private location = inject(Location);
  language = inject(LanguageService);

  scope = signal<PeriodScope>(defaultScope());
  scopeYears = signal<number[]>([]);
  scopeMonths = signal<MonthNumber[]>([]);
  scopeAnnouncement = signal('');
  movementAnnouncement = signal('');
  months = MONTH_NUMBERS;
  years = Array.from({ length: 10 }, (_, i) => getCurrentYear() - i);
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  allCategoriesForNameResolution = signal<Category[]>([]);
  movements = signal<MovementItem[]>([]);
  dataLoaded = signal(false);
  baseCurrency = signal('EUR');

  showForm = signal<'none' | 'transfer' | 'transaction'>('none');
  editingId = signal<number | null>(null);
  quickAddRestore = signal<QuickAddDraft | null>(null);

  /* Mobile regime (#103, #104): below the 768px breakpoint both capture forms
     render inside a bottom sheet instead of the inline form card. Desktop
     keeps the inline reveal. */
  private mobileMediaQuery: MediaQueryList | null =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)')
      : null;
  readonly isMobileLayout = signal<boolean>(this.mobileMediaQuery?.matches ?? false);

  constructor() {
    const mediaQuery = this.mobileMediaQuery;
    if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
      const listener = (event: MediaQueryListEvent): void =>
        this.isMobileLayout.set(event.matches);
      mediaQuery.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() =>
        mediaQuery.removeEventListener('change', listener),
      );
    }
  }

  confirmingDelete = signal<MovementItem | null>(null);
  undo = signal<PendingDelete | null>(null);
  undoAnnouncement = signal('');
  undoWindowMs = 10000;
  private undoHandle: ReturnType<typeof setTimeout> | null = null;

  transferExchangeRateState = signal<RateState>({ ...EMPTY_RATE_STATE });
  transferRateSeed = signal<RateSeed | null>(null);
  transferRateLabels = TRANSFER_RATE_LABELS;

  trForm = signal<TransferForm>({
    sourceAccountId: 0,
    destAccountId: 0,
    sourceAmount: 0,
    destinationAmount: 0,
    exchangeRate: 1,
    date: new Date().toISOString().split('T')[0],
    ...periodYearFromDate(new Date()),
    note: '',
  });
  errorMessage = signal('');
  errorDetail = signal('');
  transferSaving = signal(false);

  editTransaction = signal<Transaction | null>(null);

  canSubmitTransfer = computed(() => {
    const f = this.trForm();
    if (!f.sourceAccountId || !f.destAccountId) return false;
    if (f.sourceAccountId === f.destAccountId) return false;
    if (!(f.sourceAmount > 0)) return false;
    if (this.isTransferForeignCurrency() && this.transferExchangeRateState().loading) return false;
    return !this.transferSaving();
  });

  transferDisabledReason = computed(() => {
    if (this.transferSaving()) return '';
    const f = this.trForm();
    if (!f.sourceAccountId || !f.destAccountId) {
      return this.language.t('movements.saveDisabled.accounts');
    }
    if (f.sourceAccountId === f.destAccountId) {
      return this.language.t('movements.saveDisabled.distinct');
    }
    if (!(f.sourceAmount > 0)) return this.language.t('movements.saveDisabled.amount');
    if (this.isTransferForeignCurrency() && this.transferExchangeRateState().loading) {
      return this.language.t('movements.saveDisabled.rate');
    }
    return '';
  });

  filteredDestinationAccounts = computed(() => {
    const sourceId = this.trForm().sourceAccountId;
    if (!sourceId) return this.accounts();
    return this.accounts().filter((a) => a.id !== sourceId);
  });

  filterCategory = signal<number | null>(null);
  filterAccount = signal<number | null>(null);
  searchQuery = signal('');
  sortDir = signal<'desc' | 'asc'>('desc');

  /* Filter-card disclosure (#102): the card collapses to a single search row;
     the category/account selects reveal only on demand. */
  filtersExpanded = signal(false);

  quickAddCard = viewChild(QuickAddCardComponent);

  onDocKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    // Escape must reach the handler even from inside the capture form's
    // inputs — closing the open form is the point of the shortcut.
    if (e.key === 'Escape') {
      this.closeOpenCaptureForm();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (e.key === 't' || e.key === 'T') {
      this.toggleTransferForm();
    } else if (e.key === 'n' || e.key === 'N') {
      this.toggleQuickAdd();
    }
  }

  private closeOpenCaptureForm(): void {
    if (this.showForm() === 'transaction') {
      this.toggleQuickAdd();
    } else if (this.showForm() === 'transfer') {
      this.toggleTransferForm();
    }
  }
  transferHeading = viewChild<ElementRef<HTMLHeadingElement>>('transferHeading');

  deleteConfirmButton = viewChild<ElementRef<HTMLButtonElement>>('deleteConfirmBtn');

  private focusDeleteConfirm = effect(() => {
    if (this.confirmingDelete()) {
      this.deleteConfirmButton()?.nativeElement.focus();
    }
  });

  private focusTransferForm = effect(() => {
    const heading = this.transferHeading();
    if (heading) {
      const el = heading.nativeElement;
      /* Hosted in the mobile capture sheet (#104): the sheet already covers
         the screen, so the heading's scroll-into-view must not scroll the
         page behind it. */
      if (!this.isMobileLayout() && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
      el.focus();
    }
  });

  private openOnCaptureRequest = effect(() => {
    if (this.captureFormService.pendingQuickAddRequests() > 0) {
      this.captureFormService.consumeQuickAddRequests();
      this.toggleQuickAdd();
    }
    if (this.captureFormService.pendingTransferRequests() > 0) {
      this.captureFormService.consumeTransferRequests();
      this.toggleTransferForm();
    }
  });

  private reloadDataOnVersionChange = this.dataVersion.reloadOnChange(() => this.loadAll());

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  filteredMovements = computed(() => {
    const cat = this.filterCategory();
    const acc = this.filterAccount();
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.movements();

    if (cat === null && acc === null && !query) {
      return items;
    }

    return items.filter((item) => {
      if (cat !== null) {
        if (item.type === 'transaction') {
          if ((item.data as Transaction).categoryId !== cat) return false;
        } else {
          return false;
        }
      }
      if (acc !== null) {
        if (item.type === 'transaction') {
          if ((item.data as Transaction).accountId !== acc) return false;
        } else {
          const tr = item.data as Transfer;
          if (tr.sourceAccountId !== acc && tr.destinationAccountId !== acc) return false;
        }
      }
      if (query && !this.matchesSearch(item, query)) return false;
      return true;
    });
  });

  movementView = computed<MovementItem[]>(() => {
    const items =
      this.sortDir() === 'asc' ? [...this.filteredMovements()].reverse() : this.filteredMovements();
    return items;
  });

  /* Mobile ledger sections (#101): rows grouped under one divider per day,
     in movementView order so the date sort direction carries through. The
     divider announces the day on mobile; the desktop table hides it. */
  movementDaySections = computed<MovementDaySection[]>(() => {
    const sections: MovementDaySection[] = [];
    const byKey = new Map<string, MovementDaySection>();
    for (const item of this.movementView()) {
      const date = item.data.date instanceof Date ? item.data.date : new Date(item.data.date);
      const key = localDayKey(date);
      let section = byKey.get(key);
      if (!section) {
        section = {
          key,
          label: this.language.formatDate(date, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          items: [],
        };
        byKey.set(key, section);
        sections.push(section);
      }
      section.items.push(item);
    }
    return sections;
  });

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterCategory() !== null) count++;
    if (this.filterAccount() !== null) count++;
    if (this.searchQuery().trim()) count++;
    return count;
  });

  /* Collapsed-state chips (#102): one removable chip per active filter, so
     the collapsed card still shows what is being applied. */
  activeFilters = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const cat = this.filterCategory();
    if (cat !== null) {
      chips.push({ kind: 'category', label: this.chipLabel('movements.category', cat, this.categories()) });
    }
    const acc = this.filterAccount();
    if (acc !== null) {
      chips.push({ kind: 'account', label: this.chipLabel('movements.account', acc, this.accounts()) });
    }
    const query = this.searchQuery().trim();
    if (query) {
      chips.push({
        kind: 'search',
        label: `${this.language.t('movements.search')}: ${query}`,
      });
    }
    return chips;
  });

  private chipLabel(
    prefixKey: string,
    id: number,
    items: { id?: number; name: string }[],
  ): string {
    const name = items.find((item) => item.id === id)?.name ?? this.language.t('movements.unknown');
    return `${this.language.t(prefixKey)}: ${name}`;
  }

  toggleFilters(): void {
    this.filtersExpanded.update((expanded) => !expanded);
  }

  removeFilter(kind: FilterChip['kind']): void {
    if (kind === 'category') this.filterCategory.set(null);
    if (kind === 'account') this.filterAccount.set(null);
    if (kind === 'search') this.searchQuery.set('');
  }

  toggleSort(): void {
    this.sortDir.update((d) => (d === 'desc' ? 'asc' : 'desc'));
  }

  trackKey(row: MovementItem): string {
    return `${row.type}:${row.data.id}`;
  }

  private matchesSearch(item: MovementItem, query: string): boolean {
    if (item.type === 'transaction') {
      const txn = item.data as Transaction;
      const haystack = [
        this.getCategoryName(txn.categoryId),
        this.getAccountName(txn.accountId),
        txn.note,
      ];
      return haystack.some((part) => part?.toLowerCase().includes(query));
    }
    const tr = item.data as Transfer;
    const haystack = [
      this.getAccountName(tr.sourceAccountId),
      this.getAccountName(tr.destinationAccountId),
      tr.note,
    ];
    return haystack.some((part) => part?.toLowerCase().includes(query));
  }

  async ngOnInit(): Promise<void> {
    const fromUrl = this.scopeFromUrl();
    if (fromUrl) {
      this.scope.set(fromUrl);
    }
    await this.loadAll();
  }

  private async loadAll(): Promise<void> {
    try {
      this.baseCurrency.set(await this.profileService.getBaseCurrency());
      this.accounts.set(await this.accountService.getActive());
      this.categories.set(await this.categoryService.getActive());
      this.allCategoriesForNameResolution.set(await this.categoryService.getAll());
      if (this.accounts().length > 0) {
        const first = this.accounts()[0].id!;
        const second = this.accounts()[1]?.id;
        this.trForm.update((f) => ({ ...f, sourceAccountId: first, destAccountId: second ?? first }));
      }
      await this.refresh();
      await this.applyScopeOptions();
    } finally {
      this.dataLoaded.set(true);
    }
  }

  private scopeFromUrl(): PeriodScope | null {
    const query = this.location.path(true).split('?')[1] ?? '';
    const params = new URLSearchParams(query);
    const period = Number(params.get('period'));
    const year = Number(params.get('year'));
    if (isMonthNumber(period) && isValidYear(year)) {
      return { kind: 'month', period, year };
    }
    return null;
  }

  private reflectScopeInUrl(scope: PeriodScope): void {
    const path = this.location.path().split('?')[0] || '/';
    this.location.replaceState(`${path}?period=${scope.period}&year=${scope.year}`);
  }

  async refresh(): Promise<void> {
    const txns = await this.transactionService.getByScope(this.scope());
    const transfers = await this.transferService.getByScope(this.scope());

    const items: MovementItem[] = [
      ...txns.map((t) => ({ type: 'transaction' as const, data: t })),
      ...transfers.map((t) => ({ type: 'transfer' as const, data: t })),
    ].sort((a, b) => {
      const dateA =
        a.type === 'transaction' ? (a.data as Transaction).date : (a.data as Transfer).date;
      const dateB =
        b.type === 'transaction' ? (b.data as Transaction).date : (b.data as Transfer).date;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    this.movements.set(items);
  }

  private async applyScopeOptions(): Promise<void> {
    const txns = await this.transactionService.getAll();
    const transfers = await this.transferService.getAll();
    const all = [
      ...txns.map((t) => ({ period: t.period, year: t.year, date: t.date })),
      ...transfers.map((t) => ({ period: t.period, year: t.year, date: t.date })),
    ];
    const options = scopeOptionsFromMovements(all);
    this.scopeYears.set(options.years);
    this.scopeMonths.set(options.months);
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
    this.reflectScopeInUrl(scope);
    this.scopeAnnouncement.set(this.language.scopeLabel(scope));
    // Re-enter the busy gate so the new scope's empty state and Net figures
    // never render from the previous scope's data.
    this.dataLoaded.set(false);
    try {
      await this.refresh();
      await this.applyScopeOptions();
    } finally {
      this.dataLoaded.set(true);
    }
  }

  toggleTransferForm(): void {
    if (this.showForm() === 'transfer') {
      this.closeTransferForm();
    } else {
      this.openTransferForm();
    }
  }

  closeTransferForm(): void {
    /* The form (and its well) is destroyed on close; if the draft continues,
       seed the reopened well with the captured rate state. */
    const s = this.transferExchangeRateState();
    this.transferRateSeed.set({
      rate: s.rate,
      date: s.date,
      error: s.error || undefined,
    });
    this.showForm.set('none');
  }

  private captureQuickAddDraft(): void {
    const card = this.quickAddCard();
    if (!card) return;
    const draft = card.draft();
    this.quickAddRestore.set({
      ...draft,
      rateState: { ...draft.rateState, loading: false },
    });
  }

  private transferDraftInProgress(): boolean {
    if (this.editingId() !== null) return true;
    const f = this.trForm();
    const d = defaultTransferForm(this.accounts());
    return (
      f.sourceAccountId !== d.sourceAccountId ||
      f.destAccountId !== d.destAccountId ||
      f.sourceAmount !== d.sourceAmount ||
      f.destinationAmount !== d.destinationAmount ||
      f.exchangeRate !== d.exchangeRate ||
      f.date !== d.date ||
      f.period !== d.period ||
      f.year !== d.year ||
      f.note !== d.note
    );
  }

  openTransferForm(id?: number): void {
    if (this.showForm() === 'transaction') {
      this.captureQuickAddDraft();
    }
    this.showForm.set('transfer');
    this.editTransaction.set(null);
    this.errorMessage.set('');
    this.errorDetail.set('');
    if (id) {
      this.editingId.set(id);
      this.transferRateSeed.set(null);
      this.transferService.getById(id).then((t) => {
        if (t) {
          this.trForm.set({
            sourceAccountId: t.sourceAccountId,
            destAccountId: t.destinationAccountId,
            sourceAmount: t.sourceAmount,
            destinationAmount: t.destinationAmount,
            exchangeRate: t.exchangeRate,
            date: new Date(t.date).toISOString().split('T')[0],
            period: t.period,
            year: getPeriodYear(t),
            note: t.note,
          });
          const src = this.accounts().find((a) => a.id === t.sourceAccountId);
          const dst = this.accounts().find((a) => a.id === t.destinationAccountId);
          if (src && dst && src.currency !== dst.currency) {
            this.transferRateSeed.set({ rate: t.exchangeRate, date: 'stored' });
          }
        }
      });
    } else if (!this.transferDraftInProgress()) {
      this.transferRateSeed.set(null);
      this.resetTransferForm();
    }
  }

  private resetTransferForm(): void {
    this.trForm.set(defaultTransferForm(this.accounts()));
  }

  toggleQuickAdd(): void {
    if (this.showForm() === 'transaction') {
      this.captureQuickAddDraft();
      this.showForm.set('none');
      this.editTransaction.set(null);
    } else {
      this.openQuickAdd();
    }
  }

  openQuickAdd(): void {
    if (this.showForm() === 'transaction') {
      this.quickAddCard()?.focusAmount();
      return;
    }
    this.showForm.set('transaction');
    this.editTransaction.set(null);
  }

  openQuickAddForEdit(txn: Transaction): void {
    this.showForm.set('transaction');
    this.editTransaction.set(txn);
    this.quickAddRestore.set(null);
  }

  closeQuickAdd(): void {
    this.showForm.set('none');
    this.editTransaction.set(null);
    this.quickAddRestore.set(null);
  }

  cancelForm(): void {
    this.showForm.set('none');
    this.editingId.set(null);
    this.editTransaction.set(null);
    this.errorMessage.set('');
    this.errorDetail.set('');
    this.transferExchangeRateState.set({ ...EMPTY_RATE_STATE });
    this.transferRateSeed.set(null);
    this.resetTransferForm();
  }

  clearFilters(): void {
    this.filterCategory.set(null);
    this.filterAccount.set(null);
    this.searchQuery.set('');
  }

  onTransferSourceChange(sourceId: number): void {
    this.trForm.update((f) => {
      const destAccountId = f.destAccountId === sourceId ? 0 : f.destAccountId;
      return { ...f, sourceAccountId: sourceId, destAccountId };
    });
  }

  onTransferDateChange(date: string): void {
    this.trForm.update((f) => ({ ...f, date, ...periodYearFromDate(date) }));
  }

  isTransferForeignCurrency(): boolean {
    const { src, dst } = this.getTransferAccounts();
    return !!src && !!dst && src.currency !== dst.currency;
  }

  getTransferSourceCurrency(): string {
    return this.getTransferAccounts().src?.currency ?? '';
  }

  getTransferDestCurrency(): string {
    return this.getTransferAccounts().dst?.currency ?? '';
  }

  private getTransferAccounts(): { src: Account | undefined; dst: Account | undefined } {
    const f = this.trForm();
    return {
      src: this.accounts().find((a) => a.id === f.sourceAccountId),
      dst: this.accounts().find((a) => a.id === f.destAccountId),
    };
  }

  onTransferAmountOrRateChange(): void {
    this.computeTransferDestinationAmount();
  }

  onTransferRateStateChange(state: RateState): void {
    this.transferExchangeRateState.set(state);
    if (state.rate !== null) {
      this.trForm.update((f) => ({ ...f, exchangeRate: state.rate! }));
    }
    this.computeTransferDestinationAmount();
  }

  private computeTransferDestinationAmount(): void {
    const f = this.trForm();
    const destAmount = Math.round(f.sourceAmount * f.exchangeRate * 100) / 100;
    this.trForm.update((form) => ({ ...form, destinationAmount: destAmount }));
  }

  getAccountCurrency(accountId: number): string {
    return this.accounts().find((a) => a.id === accountId)?.currency ?? '';
  }

  async saveTransfer(): Promise<void> {
    if (!this.canSubmitTransfer()) return;
    this.transferSaving.set(true);
    try {
      const f = this.trForm();
      const wasEdit = this.editingId() !== null;
      if (this.editingId()) {
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
      this.cancelForm();
      await this.refresh();
      await this.applyScopeOptions();
      this.movementAnnouncement.set(
        wasEdit
          ? this.language.t('movements.announcement.transferUpdated')
          : this.language.t('movements.announcement.transferSaved'),
      );
    } catch (e: unknown) {
      this.setTransferError(e);
    } finally {
      this.transferSaving.set(false);
    }
  }

  private setTransferError(e: unknown): void {
    this.errorMessage.set(
      errorCopy(e, this.language.translateFn, 'movements.error.saveFailed'),
    );
    this.errorDetail.set(
      e instanceof TranslationError ? '' : e instanceof Error ? e.message : String(e),
    );
  }

  async onSaveTransaction(payload: TransactionFormPayload): Promise<void> {
    try {      if (payload.id != null) {
        await this.transactionService.update(payload.id, {
          accountId: payload.accountId,
          categoryId: payload.categoryId,
          amount: payload.amount,
          date: new Date(payload.date),
          period: payload.period,
          year: payload.year,
          exchangeRate: payload.exchangeRate,
          baseCurrencyAmount: payload.baseCurrencyAmount,
          note: payload.note,
        });
      } else {
        await this.transactionService.create(
          payload.accountId,
          payload.categoryId,
          payload.amount,
          new Date(payload.date),
          payload.period,
          payload.exchangeRate,
          payload.baseCurrencyAmount,
          payload.year,
          payload.note,
        );
      }
      const wasEdit = payload.id != null;
      this.closeQuickAdd();
      await this.refresh();
      await this.applyScopeOptions();
      this.movementAnnouncement.set(
        wasEdit
          ? this.language.t('movements.announcement.transactionUpdated')
          : this.language.t('movements.announcement.transactionSaved'),
      );
    } catch (e: unknown) {
      const message = this.setTransactionError(e);
      const card = this.quickAddCard();
      if (card) {
        card.markFailed(message);
      } else {
        this.movementAnnouncement.set(message);
      }
    }
  }

  private setTransactionError(e: unknown): string {
    return errorCopy(
      e,
      this.language.translateFn,
      'quickAdd.error.failedToSave',
    );
  }

  deleteConfirmationLabel(item: MovementItem): string {
    if (item.type === 'transaction') {
      const txn = item.data as Transaction;
      const amount = this.formatTransactionDisplayAmount(txn);
      return this.language.t('movements.deleteTransactionConfirm', {
        amount,
        account: this.getAccountName(txn.accountId),
      });
    }
    const tr = item.data as Transfer;
    const amount = this.formatTransferDisplayAmount(tr);
    return this.language.t('movements.deleteTransferConfirm', {
      amount,
      source: this.getAccountName(tr.sourceAccountId),
      destination: this.getAccountName(tr.destinationAccountId),
    });
  }

  undoDeleteLabel(pending: PendingDelete): string {
    const amount =
      pending.item.type === 'transaction'
        ? this.formatTransactionDisplayAmount(pending.snapshot as Transaction)
        : this.formatTransferDisplayAmount(pending.snapshot as Transfer);
    return pending.item.type === 'transaction'
      ? this.language.t('movements.deletedTransaction', { amount })
      : this.language.t('movements.deletedTransfer', { amount });
  }

  requestDelete(item: MovementItem): void {
    this.confirmingDelete.set(item);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  async confirmDelete(): Promise<void> {
    const item = this.confirmingDelete();
    if (!item) return;
    const snapshot = item.data;
    if (item.type === 'transaction') {
      await this.transactionService.delete(item.data.id!);
    } else {
      await this.transferService.delete(item.data.id!);
    }
    this.confirmingDelete.set(null);
    this.setUndo({ item, snapshot });
    await this.refresh();
    await this.applyScopeOptions();
  }

  async undoDelete(): Promise<void> {
    const pending = this.undo();
    if (!pending) return;
    if (pending.item.type === 'transaction') {
      await this.transactionService.restore(pending.snapshot as Transaction);
    } else {
      await this.transferService.restore(pending.snapshot as Transfer);
    }
    this.clearUndo();
    await this.refresh();
    await this.applyScopeOptions();
  }

  dismissUndo(): void {
    this.clearUndo();
  }

  private setUndo(pending: PendingDelete): void {
    this.undo.set(pending);
    this.undoAnnouncement.set(
      this.language.t('movements.undoWindow', { seconds: this.undoWindowMs / 1000 }),
    );
    this.scheduleUndoAutoDismiss();
  }

  scheduleUndoAutoDismiss(): void {
    if (this.undoHandle !== null) {
      clearTimeout(this.undoHandle);
    }
    this.undoHandle = setTimeout(() => {
      this.clearUndo();
      this.undoAnnouncement.set(this.language.t('movements.undoWindowClosed'));
    }, this.undoWindowMs);
  }

  pauseUndo(): void {
    if (this.undoHandle !== null) {
      clearTimeout(this.undoHandle);
      this.undoHandle = null;
    }
  }

  resumeUndo(): void {
    if (this.undo()) {
      this.scheduleUndoAutoDismiss();
    }
  }

  private clearUndo(): void {
    if (this.undoHandle !== null) {
      clearTimeout(this.undoHandle);
      this.undoHandle = null;
    }
    this.undo.set(null);
    this.undoAnnouncement.set('');
  }

  ngOnDestroy(): void {
    if (this.undoHandle !== null) {
      clearTimeout(this.undoHandle);
      this.undoHandle = null;
    }
  }

  getAccountName(id: number): string {
    return this.accounts().find((a) => a.id === id)?.name ?? this.language.t('movements.unknown');
  }

  getCategoryName(id: number): string {
    return (
      this.allCategoriesForNameResolution().find((c) => c.id === id)?.name ??
      this.language.t('movements.unknown')
    );
  }

  formatMoney(amount: number): string {
    return this.language.formatMoney(amount, this.baseCurrency());
  }

  scopeLabelText(): string {
    return this.language.scopeLabel(this.scope());
  }

  periodLabel(period: number | string): string {
    return this.language.periodLabel(period);
  }

  scopePeriod(): MonthNumber {
    return this.scope().period;
  }

  scopeYearValue(): number {
    return this.scope().year;
  }

  isIncomeTransaction(txn: Transaction): boolean {
    const type = this.allCategoriesForNameResolution().find((c) => c.id === txn.categoryId)?.type;
    return isIncomeCategory(type);
  }

  kindLabel(item: MovementItem): string {
    if (this.isTransaction(item)) {
      const kind = this.isIncomeTransaction(this.getTransactionData(item))
        ? 'type.income'
        : 'type.expense';
      return this.language.t(kind);
    }
    return this.language.t('type.transfer');
  }

  isForeignCurrencyTransaction(txn: Transaction): boolean {
    const account = this.accounts().find((a) => a.id === txn.accountId);
    return !!account && account.currency !== this.baseCurrency();
  }

  getTransactionSourceCurrency(txn: Transaction): string {
    return this.getAccountCurrency(txn.accountId);
  }

  formatTransactionDisplayAmount(txn: Transaction): string {
    if (this.isForeignCurrencyTransaction(txn) && txn.baseCurrencyAmount !== null) {
      const sourceCurrency = this.getTransactionSourceCurrency(txn);
      const sourceFormatted = this.language.formatMoney(txn.amount, sourceCurrency);
      const baseFormatted = this.language.formatMoney(txn.baseCurrencyAmount, this.baseCurrency());
      return `${sourceFormatted} → ${baseFormatted}`;
    }
    if (this.isForeignCurrencyTransaction(txn)) {
      return this.language.formatMoney(txn.amount, this.getTransactionSourceCurrency(txn));
    }
    return this.formatMoney(txn.amount);
  }

  formatTransferDisplayAmount(tr: Transfer): string {
    const sourceCurrency = this.getAccountCurrency(tr.sourceAccountId);
    const destCurrency = this.getAccountCurrency(tr.destinationAccountId);
    const isCrossCurrency = sourceCurrency !== destCurrency;
    if (isCrossCurrency) {
      const sourceFormatted = this.language.formatMoney(tr.sourceAmount, sourceCurrency);
      const destFormatted = this.language.formatMoney(tr.destinationAmount, destCurrency);
      return `${sourceFormatted} → ${destFormatted}`;
    }
    return this.formatMoney(tr.sourceAmount);
  }

  isTransaction(item: MovementItem): boolean {
    return item.type === 'transaction';
  }

  getTransactionData(item: MovementItem): Transaction {
    return item.data as Transaction;
  }

  getTransferData(item: MovementItem): Transfer {
    return item.data as Transfer;
  }
}

