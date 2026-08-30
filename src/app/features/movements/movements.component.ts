import { Component, ElementRef, computed, effect, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { OfflineError } from '../../core/models/offline-error';
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
  isAllTime,
  scopeOptionsFromMovements,
} from '../../core/types/period.type';
import { LanguageService } from '../../core/services/language.service';
import {
  QuickAddCardComponent,
  TransactionFormPayload,
} from './quick-add-card/quick-add-card.component';
import {
  NetFlowCardComponent,
  MovementItem,
} from './net-flow-card/net-flow-card.component';

interface ExchangeRateState {
  loading: boolean;
  error: string;
  rate: number | null;
  date: string;
}

type MovementViewRow =
  | { kind: 'group'; key: string; label: string }
  | { kind: 'movement'; item: MovementItem };

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

@Component({
  selector: 'app-movements',
  imports: [FormsModule, DatePipe, NgClass, QuickAddCardComponent, NetFlowCardComponent],
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
  private exchangeRateService = inject(ExchangeRateService);
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
  baseCurrency = signal('EUR');

  showForm = signal<'none' | 'transfer'>('none');
  editingId = signal<number | null>(null);

  confirmingDelete = signal<MovementItem | null>(null);
  undo = signal<PendingDelete | null>(null);
  undoWindowMs = 10000;
  private undoHandle: ReturnType<typeof setTimeout> | null = null;

  transferExchangeRateState = signal<ExchangeRateState>({
    loading: false,
    error: '',
    rate: null,
    date: '',
  });

  trForm = signal<TransferForm>({
    sourceAccountId: 0,
    destAccountId: 0,
    sourceAmount: 0,
    destinationAmount: 0,
    exchangeRate: 1,
    date: new Date().toISOString().split('T')[0],
    period: getCurrentPeriod(),
    year: getCurrentYear(),
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

  filteredDestinationAccounts = computed(() => {
    const sourceId = this.trForm().sourceAccountId;
    if (!sourceId) return this.accounts();
    return this.accounts().filter((a) => a.id !== sourceId);
  });

  filterCategory = signal<number | null>(null);
  filterAccount = signal<number | null>(null);
  searchQuery = signal('');
  sortDir = signal<'desc' | 'asc'>('desc');

  quickAddCard = viewChild(QuickAddCardComponent);

  onDocKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
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
      this.openTransferForm();
    } else if (e.key === 'n' || e.key === 'N') {
      this.quickAddCard()?.focusAmount();
    }
  }
  transferHeading = viewChild<ElementRef<HTMLHeadingElement>>('transferHeading');

  private focusTransferForm = effect(() => {
    const heading = this.transferHeading();
    if (heading) {
      const el = heading.nativeElement;
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
      el.focus();
    }
  });

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

  movementView = computed<MovementViewRow[]>(() => {
    const items =
      this.sortDir() === 'asc' ? [...this.filteredMovements()].reverse() : this.filteredMovements();

    if (!isAllTime(this.scope()) || this.sortDir() === 'asc') {
      return items.map((item) => ({ kind: 'movement' as const, item }));
    }

    const rows: MovementViewRow[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.data.year}-${item.data.period}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({
          kind: 'group',
          key,
          label: `${this.periodLabel(item.data.period)} ${item.data.year}`,
        });
      }
      rows.push({ kind: 'movement', item });
    }
    return rows;
  });

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterCategory() !== null) count++;
    if (this.filterAccount() !== null) count++;
    if (this.searchQuery().trim()) count++;
    return count;
  });

  toggleSort(): void {
    this.sortDir.update((d) => (d === 'desc' ? 'asc' : 'desc'));
  }

  trackKey(row: MovementViewRow): string {
    return row.kind === 'group' ? `group:${row.key}` : `${row.item.type}:${row.item.data.id}`;
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

  async onScopeYearChange(value: number | 'all-time'): Promise<void> {
    if (typeof value === 'string' && value !== 'all-time') {
      value = Number(value);
    }
    if (value === 'all-time') {
      await this.setScope({ kind: 'all-time' });
      return;
    }
    const current = this.scope();
    const period =
      current.kind === 'month' && current.year === value && current.period
        ? current.period
        : getCurrentPeriod();
    await this.setScope({ kind: 'month', period, year: value });
  }

  isAllTimeScope(): boolean {
    return isAllTime(this.scope());
  }

  canStepMonth(delta: -1 | 1): boolean {
    const s = this.scope();
    if (isAllTime(s)) return false;
    const next = s.period + delta;
    return next >= 1 && next <= 12;
  }

  async stepScopeMonth(delta: -1 | 1): Promise<void> {
    const s = this.scope();
    if (isAllTime(s) || !this.canStepMonth(delta)) return;
    await this.onScopeMonthChange(s.period + delta);
  }

  async toggleAllTime(): Promise<void> {
    if (isAllTime(this.scope())) {
      await this.onScopeYearChange(getCurrentYear());
    } else {
      await this.onScopeYearChange('all-time');
    }
  }

  async onScopeMonthChange(period: number): Promise<void> {
    const current = this.scope();
    if (current.kind === 'month') {
      await this.setScope({ ...current, period: period as MonthNumber });
    }
  }

  private async setScope(scope: PeriodScope): Promise<void> {
    this.scope.set(scope);
    this.scopeAnnouncement.set(this.language.scopeLabel(scope));
    await this.refresh();
    await this.applyScopeOptions();
  }

  private formPeriodYear(): { period: MonthNumber; year: number } {
    const s = this.scope();
    if (!isAllTime(s)) {
      return { period: s.period, year: s.year };
    }
    return { period: getCurrentPeriod(), year: getCurrentYear() };
  }

  openTransferForm(id?: number): void {
    this.showForm.set('transfer');
    this.editingId.set(id ?? null);
    this.errorMessage.set('');
    this.errorDetail.set('');
    this.transferExchangeRateState.set({ loading: false, error: '', rate: null, date: '' });
    if (id) {
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
          if (t.sourceAccountId !== t.destinationAccountId) {
            const src = this.accounts().find((a) => a.id === t.sourceAccountId);
            const dst = this.accounts().find((a) => a.id === t.destinationAccountId);
            if (src && dst && src.currency !== dst.currency) {
              this.transferExchangeRateState.update((s) => ({
                ...s,
                rate: t.exchangeRate,
                date: 'stored',
              }));
            }
          }
        }
      });
    } else {
      const srcId = this.accounts()[0]?.id ?? 0;
      const dstId = this.accounts()[1]?.id ?? this.accounts()[0]?.id ?? 0;
      this.trForm.set({
        sourceAccountId: srcId,
        destAccountId: dstId,
        sourceAmount: 0,
        destinationAmount: 0,
        exchangeRate: 1,
        date: new Date().toISOString().split('T')[0],
        period: this.formPeriodYear().period,
        year: this.formPeriodYear().year,
        note: '',
      });
      if (srcId && dstId && srcId !== dstId) {
        this.checkTransferExchangeRate();
      }
    }
  }

  cancelForm(): void {
    this.showForm.set('none');
    this.editingId.set(null);
    this.errorMessage.set('');
    this.errorDetail.set('');
    this.transferExchangeRateState.set({ loading: false, error: '', rate: null, date: '' });
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
    this.checkTransferExchangeRate();
  }

  onTransferDateChange(date: string): void {
    this.trForm.update((f) => ({ ...f, date }));
    this.checkTransferExchangeRate();
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

  async checkTransferExchangeRate(): Promise<void> {
    const { src, dst } = this.getTransferAccounts();
    const f = this.trForm();

    if (!src || !dst || src.currency === dst.currency) {
      this.transferExchangeRateState.set({ loading: false, error: '', rate: null, date: '' });
      this.computeTransferDestinationAmount();
      return;
    }

    this.transferExchangeRateState.update((s) => ({ ...s, loading: true, error: '' }));

    try {
      const result = await this.exchangeRateService.getRate(src.currency, dst.currency, f.date);
      this.transferExchangeRateState.update((s) => ({
        ...s,
        rate: result.rate,
        date: result.date,
      }));
      this.trForm.update((form) => ({ ...f, exchangeRate: result.rate }));
      this.computeTransferDestinationAmount();
    } catch (e: unknown) {
      const msg =
        e instanceof OfflineError
          ? this.language.t('movements.error.offlineRate')
          : this.language.t('movements.error.rateFetch');
      this.transferExchangeRateState.update((s) => ({ ...s, error: msg }));
    } finally {
      this.transferExchangeRateState.update((s) => ({ ...s, loading: false }));
    }
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
    const raw = e instanceof Error ? e.message : String(e);
    const known: Record<string, string> = {
      'Source and destination accounts must be different':
        this.language.t('movements.error.differentAccounts'),
      'Amount must be positive': this.language.t('movements.error.amountPositive'),
      'Source amount must be positive': this.language.t('movements.error.amountPositive'),
      'Exchange rate must be positive': this.language.t('movements.error.ratePositive'),
      'Source account not found': this.language.t('movements.error.accountMissing'),
      'Destination account not found': this.language.t('movements.error.accountMissing'),
    };
    this.errorMessage.set(
      known[raw] ?? this.language.t('movements.error.saveFailed'),
    );
    this.errorDetail.set(raw);
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
      this.editTransaction.set(null);
      await this.refresh();
      await this.applyScopeOptions();
      this.quickAddCard()?.markSaved(payload.id != null);
    } catch (e: unknown) {
      this.quickAddCard()?.markFailed(this.setTransactionError(e));
    }
  }

  private setTransactionError(e: unknown): string {
    const raw = e instanceof Error ? e.message : String(e);
    const known: Record<string, string> = {
      'Amount must be positive': this.language.t('movements.error.amountPositive'),
      'Account not found': this.language.t('movements.error.accountMissing'),
      'Category not found': this.language.t('quickAdd.error.categoryMissing'),
    };
    return known[raw] ?? this.language.t('quickAdd.error.failedToSave');
  }

  onCancelEdit(): void {
    this.editTransaction.set(null);
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

  private setUndo(pending: PendingDelete): void {
    this.undo.set(pending);
    this.scheduleUndoAutoDismiss();
  }

  scheduleUndoAutoDismiss(): void {
    if (this.undoHandle !== null) {
      clearTimeout(this.undoHandle);
    }
    this.undoHandle = setTimeout(() => this.clearUndo(), this.undoWindowMs);
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

  scopePeriod(): number | null {
    const s = this.scope();
    return !isAllTime(s) ? s.period : null;
  }

  scopeYearValue(): number | 'all-time' {
    const s = this.scope();
    return !isAllTime(s) ? s.year : 'all-time';
  }

  getDirectionArrow(item: Transaction | Transfer, type: 'transaction' | 'transfer'): string {
    if (type === 'transfer') return '=';
    return this.isIncomeTransaction(item as Transaction) ? '→' : '←';
  }

  isIncomeTransaction(txn: Transaction): boolean {
    const type = this.allCategoriesForNameResolution().find((c) => c.id === txn.categoryId)?.type;
    return isIncomeCategory(type);
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

  getDirectionArrowClass(item: MovementItem): string {
    if (item.type === 'transfer') return 'arrow-transfer';
    return this.isIncomeTransaction(item.data as Transaction) ? 'arrow-income' : 'arrow-expense';
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
