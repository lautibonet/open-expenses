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
import { Transaction } from '../../core/models/transaction.model';
import { Transfer } from '../../core/models/transfer.model';
import { Account, paymentCategoryIds } from '../../core/models/account.model';
import { Category } from '../../core/models/category.model';
import {
  DisplayAmount,
  MovementRow,
  TransferRow,
  movementList,
  movementOf,
} from '../../core/movements/movement-list';
import { MONTH_NUMBERS, MonthNumber, getCurrentYear } from '../../core/types/period.type';
import {
  PeriodScope,
  ScopeOptions,
  changeMonth,
  changeYear,
  defaultScope,
  scopeFromQuery,
  scopeOptions,
  scopeQuery,
} from '../../core/scope/scope';
import { LanguageService } from '../../core/services/language.service';
import { BottomSheetComponent } from '../../shared/components/bottom-sheet/bottom-sheet.component';
import {
  TransactionFormComponent,
  TransactionFormDraft,
} from './transaction-form/transaction-form.component';
import {
  TransferFormComponent,
  TransferDraft,
} from './transfer-form/transfer-form.component';
import { NetFlowCardComponent } from './net-flow-card/net-flow-card.component';

interface FilterChip {
  kind: 'category' | 'account' | 'search';
  label: string;
}

@Component({
  selector: 'app-movements',
  imports: [FormsModule, DatePipe, NgTemplateOutlet, TransactionFormComponent, TransferFormComponent, NetFlowCardComponent, BottomSheetComponent],
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
  /* The Ledger's movements across every Period. The list and the scope
     options both derive from them, so a Scope change never refetches. */
  transactions = signal<Transaction[]>([]);
  transfers = signal<Transfer[]>([]);
  private availableScopes = computed<ScopeOptions>(() =>
    scopeOptions([...this.transactions(), ...this.transfers()]),
  );
  scopeYears = computed(() => this.availableScopes().years);
  scopeMonths = computed(() => this.availableScopes().months);
  scopeAnnouncement = signal('');
  movementAnnouncement = signal('');
  months = MONTH_NUMBERS;
  years = Array.from({ length: 10 }, (_, i) => getCurrentYear() - i);
  accounts = signal<Account[]>([]);
  /* Every Account, active or not, for resolving movement names and for the
     cash-basis KPI classification: a Deactivated Credit Card keeps its past
     purchases, which must still stay out of Income, Expenses, and Net. */
  allAccounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  allCategories = signal<Category[]>([]);
  /* #174: a card's Payment Category is plumbing for card payments, so it
     vanishes from every surface that picks categories for ordinary work —
     the transaction form's picker and the movements filter dropdown. Derived
     from every card's link (allAccounts, so a Deactivated card counts too);
     the transfer form keeps the full list because it shows the card's linked
     Payment Category from it, and Settings keeps them visible. */
  pickableCategories = computed(() => {
    const excluded = paymentCategoryIds(this.allAccounts());
    return this.categories().filter((c) => c.id == null || !excluded.has(c.id));
  });
  dataLoaded = signal(false);
  baseCurrency = signal('EUR');

  showForm = signal<'none' | 'transfer' | 'transaction'>('none');
  editTransaction = signal<Transaction | null>(null);
  editTransfer = signal<Transfer | null>(null);
  transactionRestore = signal<TransactionFormDraft | null>(null);
  transferRestore = signal<TransferDraft | null>(null);

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

  confirmingDelete = signal<MovementRow | null>(null);
  /* The deleted row kept for its undo window; it still holds the movement as
     it was stored. */
  undo = signal<MovementRow | null>(null);
  undoAnnouncement = signal('');
  undoWindowMs = 10000;
  private undoHandle: ReturnType<typeof setTimeout> | null = null;

  filterCategory = signal<number | null>(null);
  filterAccount = signal<number | null>(null);
  searchQuery = signal('');
  sortDir = signal<'desc' | 'asc'>('desc');

  /* Filter-card disclosure (#102): the card collapses to a single search row;
     the category/account selects reveal only on demand. */
  filtersExpanded = signal(false);

  transactionFormCard = viewChild(TransactionFormComponent);
  transferFormCard = viewChild(TransferFormComponent);

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
      this.toggleTransactionForm();
    }
  }

  private closeOpenCaptureForm(): void {
    if (this.showForm() === 'transaction') {
      this.toggleTransactionForm();
    } else if (this.showForm() === 'transfer') {
      this.toggleTransferForm();
    }
  }

  deleteConfirmButton = viewChild<ElementRef<HTMLButtonElement>>('deleteConfirmBtn');

  private focusDeleteConfirm = effect(() => {
    if (this.confirmingDelete()) {
      this.deleteConfirmButton()?.nativeElement.focus();
    }
  });

  private openOnCaptureRequest = effect(() => {
    if (this.captureFormService.pendingTransactionFormRequests() > 0) {
      this.captureFormService.consumeTransactionFormRequests();
      this.toggleTransactionForm();
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

  /* The Movement list (#187): Scope, filters, search, order, day grouping,
     and every row's display facts come from one pure module. */
  list = computed(() =>
    movementList({
      transactions: this.transactions(),
      transfers: this.transfers(),
      accounts: this.allAccounts(),
      categories: this.allCategories(),
      baseCurrency: this.baseCurrency(),
      scope: this.scope(),
      filters: {
        categoryId: this.filterCategory(),
        accountId: this.filterAccount(),
        search: this.searchQuery(),
        sortDir: this.sortDir(),
      },
    }),
  );

  /* The rendered rows in display order. */
  rows = computed(() => this.list().sections.flatMap((section) => section.rows));

  /* Mobile ledger sections (#101): one divider per day announces the day on
     mobile; the desktop table hides it. */
  movementDaySections = computed(() =>
    this.list().sections.map((section) => ({
      ...section,
      label: this.language.formatDate(section.date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    })),
  );

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

  trackKey(row: MovementRow): string {
    return `${row.kind}:${movementOf(row).id}`;
  }

  /* Compared by key, not identity: the list rebuilds its rows whenever a
     filter changes, and the confirm step must survive that. */
  isConfirmingDelete(row: MovementRow): boolean {
    const confirming = this.confirmingDelete();
    return confirming !== null && this.trackKey(confirming) === this.trackKey(row);
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
      this.allAccounts.set(await this.accountService.getAll());
      this.categories.set(await this.categoryService.getActive());
      this.allCategories.set(await this.categoryService.getAll());
      await this.refresh();
    } finally {
      this.dataLoaded.set(true);
    }
  }

  private scopeFromUrl(): PeriodScope | null {
    const query = this.location.path(true).split('?')[1] ?? '';
    return scopeFromQuery(new URLSearchParams(query));
  }

  private reflectScopeInUrl(scope: PeriodScope): void {
    const path = this.location.path().split('?')[0] || '/';
    this.location.replaceState(`${path}?${scopeQuery(scope)}`);
  }

  async refresh(): Promise<void> {
    this.transactions.set(await this.transactionService.getAll());
    this.transfers.set(await this.transferService.getAll());
  }

  onScopeYearChange(value: number): void {
    this.setScope(changeYear(this.scope(), value));
  }

  onScopeMonthChange(value: MonthNumber | 'all' | null): void {
    this.setScope(changeMonth(this.scope(), value, this.availableScopes()));
  }

  /* The whole Ledger is already loaded, so the new Scope's rows and Net
     figures derive at once — there is no stale Scope to gate. */
  private setScope(scope: PeriodScope): void {
    this.scope.set(scope);
    this.reflectScopeInUrl(scope);
    this.scopeAnnouncement.set(this.language.scopeLabel(scope));
  }

  toggleTransferForm(): void {
    if (this.showForm() === 'transfer') {
      this.closeTransferForm();
    } else {
      this.openTransferForm();
    }
  }

  /* The form (and its well) is destroyed on close; if the draft continues,
     the captured draft seeds the reopened form — including its edit context
     and the captured rate state. */
  closeTransferForm(): void {
    this.captureTransferDraft();
    this.showForm.set('none');
  }

  /* Full reset: a cancelled or saved transfer never resumes as a draft. */
  cancelTransferForm(): void {
    this.transferRestore.set(null);
    this.editTransfer.set(null);
    this.showForm.set('none');
  }

  private captureTransferDraft(): void {
    const form = this.transferFormCard();
    if (!form) return;
    const draft = form.draft();
    this.transferRestore.set({
      ...draft,
      rateState: { ...draft.rateState, loading: false },
    });
    this.editTransfer.set(null);
  }

  private captureTransactionFormDraft(): void {
    const card = this.transactionFormCard();
    if (!card) return;
    const draft = card.draft();
    this.transactionRestore.set({
      ...draft,
      rateState: { ...draft.rateState, loading: false },
    });
  }

  openTransferForm(transfer?: Transfer): void {
    if (this.showForm() === 'transaction') {
      this.captureTransactionFormDraft();
    }
    if (transfer) {
      this.transferRestore.set(null);
    }
    this.editTransfer.set(transfer ?? null);
    this.showForm.set('transfer');
  }

  toggleTransactionForm(): void {
    if (this.showForm() === 'transaction') {
      this.captureTransactionFormDraft();
      this.showForm.set('none');
      this.editTransaction.set(null);
    } else {
      this.openTransactionForm();
    }
  }

  openTransactionForm(): void {
    if (this.showForm() === 'transaction') {
      return;
    }
    this.showForm.set('transaction');
    this.editTransaction.set(null);
  }

  openTransactionFormForEdit(txn: Transaction): void {
    this.showForm.set('transaction');
    this.editTransaction.set(txn);
    this.transactionRestore.set(null);
  }

  closeTransactionForm(): void {
    this.showForm.set('none');
    this.editTransaction.set(null);
    this.transactionRestore.set(null);
  }

  clearFilters(): void {
    this.filterCategory.set(null);
    this.filterAccount.set(null);
    this.searchQuery.set('');
  }

  /* Each capture form persists through its own store and reports whether the
     save was an edit; the page only closes the form, refreshes the list, and
     announces the result. */
  async onTransferSaved(wasEdit: boolean): Promise<void> {
    this.cancelTransferForm();
    await this.refresh();
    this.movementAnnouncement.set(
      wasEdit
        ? this.language.t('movements.announcement.transferUpdated')
        : this.language.t('movements.announcement.transferSaved'),
    );
  }

  async onTransactionSaved(wasEdit: boolean): Promise<void> {
    this.closeTransactionForm();
    await this.refresh();
    this.movementAnnouncement.set(
      wasEdit
        ? this.language.t('movements.announcement.transactionUpdated')
        : this.language.t('movements.announcement.transactionSaved'),
    );
  }

  deleteConfirmationLabel(row: MovementRow): string {
    const amount = this.formatAmount(row.amount);
    if (row.kind === 'transaction') {
      return this.language.t('movements.deleteTransactionConfirm', {
        amount,
        account: this.nameOrUnknown(row.accountName),
      });
    }
    return this.language.t('movements.deleteTransferConfirm', {
      amount,
      source: this.nameOrUnknown(row.sourceName),
      destination: this.nameOrUnknown(row.destinationName),
    });
  }

  undoDeleteLabel(row: MovementRow): string {
    const amount = this.formatAmount(row.amount);
    return row.kind === 'transaction'
      ? this.language.t('movements.deletedTransaction', { amount })
      : this.language.t('movements.deletedTransfer', { amount });
  }

  requestDelete(row: MovementRow): void {
    this.confirmingDelete.set(row);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  async confirmDelete(): Promise<void> {
    const row = this.confirmingDelete();
    if (!row) return;
    if (row.kind === 'transaction') {
      await this.transactionService.delete(row.transaction.id!);
    } else {
      await this.transferService.delete(row.transfer.id!);
    }
    this.confirmingDelete.set(null);
    this.setUndo(row);
    await this.refresh();
  }

  async undoDelete(): Promise<void> {
    const pending = this.undo();
    if (!pending) return;
    if (pending.kind === 'transaction') {
      await this.transactionService.restore(pending.transaction);
    } else {
      await this.transferService.restore(pending.transfer);
    }
    this.clearUndo();
    await this.refresh();
  }

  dismissUndo(): void {
    this.clearUndo();
  }

  private setUndo(row: MovementRow): void {
    this.undo.set(row);
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

  /* The translated placeholder for an Account or Category the list could not
     resolve. */
  nameOrUnknown(name: string | null): string {
    return name ?? this.language.t('movements.unknown');
  }

  formatAmount(amount: DisplayAmount): string {
    if (amount.kind === 'converted') {
      const from = this.language.formatMoney(amount.from.amount, amount.from.currency);
      const to = this.language.formatMoney(amount.to.amount, amount.to.currency);
      return `${from} → ${to}`;
    }
    return this.language.formatMoney(amount.amount, amount.currency);
  }

  scopeLabelText(): string {
    return this.language.scopeLabel(this.scope());
  }

  periodLabel(period: number | string): string {
    return this.language.periodLabel(period);
  }

  scopeMonthSelectValue(): MonthNumber | 'all' {
    const current = this.scope();
    return current.kind === 'year' ? 'all' : current.period;
  }

  scopeYearValue(): number {
    return this.scope().year;
  }

  /* ADR 0022 / #168: a Transaction on a Credit Card is announced as a Card
     Purchase or card refund, never as a counted cash Expense or Income. */
  kindLabel(row: MovementRow): string {
    if (row.kind === 'transfer') {
      return this.language.t('type.transfer');
    }
    const income = row.flow === 'income';
    if (row.onCard) {
      return this.language.t(income ? 'type.cardRefund' : 'type.cardPurchase');
    }
    return this.language.t(income ? 'type.income' : 'type.expense');
  }

  transferRoute(row: TransferRow): string {
    return `${this.nameOrUnknown(row.sourceName)} → ${this.nameOrUnknown(row.destinationName)}`;
  }
}
