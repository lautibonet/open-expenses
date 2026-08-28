import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { Category } from '../../core/models/category.model';
import {
  MONTHS,
  MonthName,
  PeriodScope,
  defaultScope,
  getCurrentPeriod,
  getCurrentYear,
  getPeriodYear,
  isAllTime,
  scopeLabel,
  scopeOptionsFromMovements,
} from '../../core/types/period.type';
import { formatMoney } from '../../core/types/money';
import { TagInputComponent } from '../../shared/components/tag-input/tag-input.component';

interface ExchangeRateState {
  loading: boolean;
  error: string;
  rate: number | null;
  date: string;
}

interface MovementItem {
  type: 'transaction' | 'transfer';
  data: Transaction | Transfer;
}

interface TransactionForm {
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

interface TransferForm {
  sourceAccountId: number;
  destAccountId: number;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  date: string;
  period: string;
  year: number;
  note: string;
}

@Component({
  selector: 'app-movements',
  imports: [FormsModule, DatePipe, NgClass, TagInputComponent],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.scss',
})
export class MovementsComponent implements OnInit {
  private transactionService = inject(TransactionService);
  private transferService = inject(TransferService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);
  private exchangeRateService = inject(ExchangeRateService);

  scope = signal<PeriodScope>(defaultScope());
  scopeYears = signal<number[]>([]);
  scopeMonths = signal<string[]>([]);
  scopeAnnouncement = signal('');
  months = MONTHS;
  years = Array.from({ length: 10 }, (_, i) => getCurrentYear() - i);
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  allCategoriesForNameResolution = signal<Category[]>([]);
  movements = signal<MovementItem[]>([]);
  baseCurrency = signal('EUR');
  allTags = signal<string[]>([]);

  showForm = signal<'none' | 'transaction' | 'transfer'>('none');
  editingId = signal<number | null>(null);

  exchangeRateState = signal<ExchangeRateState>({
    loading: false, error: '', rate: null, date: '',
  });

  transferExchangeRateState = signal<ExchangeRateState>({
    loading: false, error: '', rate: null, date: '',
  });

  txForm = signal<TransactionForm>({
    accountId: 0, categoryId: 0, amount: 0,
    date: new Date().toISOString().split('T')[0],
    period: getCurrentPeriod(),
    year: getCurrentYear(),
    tags: [],
    exchangeRate: null, baseCurrencyAmount: null, note: '',
  });
  trForm = signal<TransferForm>({
    sourceAccountId: 0, destAccountId: 0, sourceAmount: 0, destinationAmount: 0,
    exchangeRate: 1,
    date: new Date().toISOString().split('T')[0],
    period: getCurrentPeriod(),
    year: getCurrentYear(),
    note: '',
  });
  errorMessage = signal('');

  filteredDestinationAccounts = computed(() => {
    const sourceId = this.trForm().sourceAccountId;
    if (!sourceId) return this.accounts();
    return this.accounts().filter(a => a.id !== sourceId);
  });

  filterCategory = signal<number | null>(null);
  filterAccount = signal<number | null>(null);
  filterTag = signal<string | null>(null);

  filteredMovements = computed(() => {
    const cat = this.filterCategory();
    const acc = this.filterAccount();
    const tag = this.filterTag();
    const items = this.movements();

    if (cat === null && acc === null && tag === null) {
      return items;
    }

    return items.filter(item => {
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
      if (tag !== null) {
        if (item.type === 'transaction') {
          if (!(item.data as Transaction).tags.includes(tag)) return false;
        } else {
          return false;
        }
      }
      return true;
    });
  });

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterCategory() !== null) count++;
    if (this.filterAccount() !== null) count++;
    if (this.filterTag() !== null) count++;
    return count;
  });

  async ngOnInit(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    this.accounts.set(await this.accountService.getActive());
    this.categories.set(await this.categoryService.getActive());
    this.allCategoriesForNameResolution.set(await this.categoryService.getAll());
    await this.refreshTags();
    if (this.accounts().length > 0) {
      const first = this.accounts()[0].id!;
      const second = this.accounts()[1]?.id;
      this.txForm.update(f => ({ ...f, accountId: first, categoryId: this.categories()[0]?.id ?? 0 }));
      this.trForm.update(f => ({ ...f, sourceAccountId: first, destAccountId: second ?? first }));
    }
    await this.refresh();
    await this.applyScopeOptions();
  }

  async refresh(): Promise<void> {
    const txns = await this.transactionService.getByScope(this.scope());
    const transfers = await this.transferService.getByScope(this.scope());

    const items: MovementItem[] = [
      ...txns.map(t => ({ type: 'transaction' as const, data: t })),
      ...transfers.map(t => ({ type: 'transfer' as const, data: t })),
    ].sort((a, b) => {
      const dateA = a.type === 'transaction' ? (a.data as Transaction).date : (a.data as Transfer).date;
      const dateB = b.type === 'transaction' ? (b.data as Transaction).date : (b.data as Transfer).date;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    this.movements.set(items);
  }

  private async applyScopeOptions(): Promise<void> {
    const txns = await this.transactionService.getAll();
    const transfers = await this.transferService.getAll();
    const all = [
      ...txns.map(t => ({ period: t.period, year: t.year, date: t.date })),
      ...transfers.map(t => ({ period: t.period, year: t.year, date: t.date })),
    ];
    const options = scopeOptionsFromMovements(all);
    this.scopeYears.set(options.years);
    this.scopeMonths.set(options.months);
  }

  async onScopeYearChange(value: number | 'all-time'): Promise<void> {
    if (value === 'all-time') {
      await this.setScope({ kind: 'all-time' });
      return;
    }
    const current = this.scope();
    const period = current.kind === 'month' && current.year === value && current.period
      ? current.period
      : getCurrentPeriod();
    await this.setScope({ kind: 'month', period, year: value });
  }

  async onScopeMonthChange(period: string): Promise<void> {
    const current = this.scope();
    if (current.kind === 'month') {
      await this.setScope({ ...current, period: period as MonthName });
    }
  }

  private async setScope(scope: PeriodScope): Promise<void> {
    this.scope.set(scope);
    this.scopeAnnouncement.set(scopeLabel(scope));
    await this.refresh();
    await this.applyScopeOptions();
  }

  private formPeriodYear(): { period: MonthName; year: number } {
    const s = this.scope();
    if (!isAllTime(s)) {
      return { period: s.period, year: s.year };
    }
    return { period: getCurrentPeriod(), year: getCurrentYear() };
  }

  private async refreshTags(): Promise<void> {
    this.allTags.set(await this.transactionService.getAllTags());
  }

  openTransactionForm(id?: number): void {
    this.showForm.set('transaction');
    this.editingId.set(id ?? null);
    this.errorMessage.set('');
    this.resetExchangeRate();
    if (id) {
      this.transactionService.getById(id).then(t => {
        if (t) {
          this.txForm.set({
            accountId: t.accountId,
            categoryId: t.categoryId,
            amount: t.amount,
            date: new Date(t.date).toISOString().split('T')[0],
            period: t.period,
            year: getPeriodYear(t),
            tags: [...t.tags],
            exchangeRate: t.exchangeRate,
            baseCurrencyAmount: t.baseCurrencyAmount,
            note: t.note ?? '',
          });
          if (t.exchangeRate) {
            this.exchangeRateState.update(s => ({ ...s, rate: t.exchangeRate, date: 'stored' }));
          }
        }
      });
    } else {
      this.txForm.set({
        accountId: this.accounts()[0]?.id ?? 0,
        categoryId: this.categories()[0]?.id ?? 0,
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        period: this.formPeriodYear().period,
        year: this.formPeriodYear().year,
        tags: [],
        exchangeRate: null,
        baseCurrencyAmount: null,
        note: '',
      });
      if (this.accounts().length > 0) {
        this.checkExchangeRate(this.accounts()[0].id!, this.txForm().date);
      }
    }
  }

  openTransferForm(id?: number): void {
    this.showForm.set('transfer');
    this.editingId.set(id ?? null);
    this.errorMessage.set('');
    this.transferExchangeRateState.set({ loading: false, error: '', rate: null, date: '' });
    if (id) {
      this.transferService.getById(id).then(t => {
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
            const src = this.accounts().find(a => a.id === t.sourceAccountId);
            const dst = this.accounts().find(a => a.id === t.destinationAccountId);
            if (src && dst && src.currency !== dst.currency) {
              this.transferExchangeRateState.update(s => ({
                ...s, rate: t.exchangeRate, date: 'stored',
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
    this.txForm.update(f => ({ ...f, tags: [] }));
    this.resetExchangeRate();
    this.transferExchangeRateState.set({ loading: false, error: '', rate: null, date: '' });
  }

  clearFilters(): void {
    this.filterCategory.set(null);
    this.filterAccount.set(null);
    this.filterTag.set(null);
  }

  private resetExchangeRate(): void {
    this.exchangeRateState.set({ loading: false, error: '', rate: null, date: '' });
  }

  onAccountChange(accountId: number): void {
    this.txForm.update(f => ({ ...f, accountId }));
    this.checkExchangeRate(accountId, this.txForm().date);
  }

  onTxDateChange(date: string): void {
    this.txForm.update(f => ({ ...f, date }));
    this.checkExchangeRate(this.txForm().accountId, date);
  }

  onTransferSourceChange(sourceId: number): void {
    this.trForm.update(f => {
      const destAccountId = f.destAccountId === sourceId ? 0 : f.destAccountId;
      return { ...f, sourceAccountId: sourceId, destAccountId };
    });
    this.checkTransferExchangeRate();
  }

  onTransferDateChange(date: string): void {
    this.trForm.update(f => ({ ...f, date }));
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
      src: this.accounts().find(a => a.id === f.sourceAccountId),
      dst: this.accounts().find(a => a.id === f.destAccountId),
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

    this.transferExchangeRateState.update(s => ({ ...s, loading: true, error: '' }));

    try {
      const result = await this.exchangeRateService.getRate(
        src.currency, dst.currency, f.date,
      );
      this.transferExchangeRateState.update(s => ({ ...s, rate: result.rate, date: result.date }));
      this.trForm.update(form => ({ ...f, exchangeRate: result.rate }));
      this.computeTransferDestinationAmount();
    } catch (e: unknown) {
      const msg = e instanceof OfflineError
        ? 'You are offline. Enter the exchange rate manually.'
        : 'Could not fetch rate. Enter it manually below.';
      this.transferExchangeRateState.update(s => ({ ...s, error: msg }));
    } finally {
      this.transferExchangeRateState.update(s => ({ ...s, loading: false }));
    }
  }

  private computeTransferDestinationAmount(): void {
    const f = this.trForm();
    const destAmount = Math.round(f.sourceAmount * f.exchangeRate * 100) / 100;
    this.trForm.update(form => ({ ...form, destinationAmount: destAmount }));
  }

  private async checkExchangeRate(accountId: number, date?: string): Promise<void> {
    const account = this.accounts().find(a => a.id === accountId);
    if (!account || account.currency === this.baseCurrency()) {
      this.txForm.update(f => ({ ...f, exchangeRate: null, baseCurrencyAmount: null }));
      this.resetExchangeRate();
      return;
    }

    this.exchangeRateState.update(s => ({ ...s, loading: true, error: '' }));

    try {
      const result = await this.exchangeRateService.getRate(
        account.currency, this.baseCurrency(), date,
      );
      this.exchangeRateState.update(s => ({ ...s, rate: result.rate, date: result.date }));
      this.txForm.update(f => ({ ...f, exchangeRate: result.rate }));
      this.recomputeBaseCurrencyAmount();
    } catch (e: unknown) {
      const msg = e instanceof OfflineError
        ? 'You are offline. Enter the exchange rate manually.'
        : 'Could not fetch rate. Enter it manually below.';
      this.exchangeRateState.update(s => ({
        ...s, error: msg,
      }));
      this.txForm.update(f => ({ ...f, exchangeRate: null, baseCurrencyAmount: null }));
    } finally {
      this.exchangeRateState.update(s => ({ ...s, loading: false }));
    }
  }

  onAmountOrRateChange(): void {
    this.recomputeBaseCurrencyAmount();
  }

  private recomputeBaseCurrencyAmount(): void {
    const f = this.txForm();
    if (f.exchangeRate && f.amount > 0) {
      this.txForm.update(form => ({
        ...form,
        baseCurrencyAmount: Math.round(form.amount * form.exchangeRate! * 100) / 100,
      }));
    } else {
      this.txForm.update(form => ({ ...form, baseCurrencyAmount: null }));
    }
  }

  getAccountCurrency(accountId: number): string {
    return this.accounts().find(a => a.id === accountId)?.currency ?? '';
  }

  isForeignCurrency(): boolean {
    const account = this.accounts().find(a => a.id === this.txForm().accountId);
    return !!account && account.currency !== this.baseCurrency();
  }

  async saveTransaction(): Promise<void> {
    try {
      const f = this.txForm();
      if (this.editingId()) {
        await this.transactionService.update(this.editingId()!, {
          accountId: f.accountId, categoryId: f.categoryId, amount: f.amount,
          date: new Date(f.date), period: f.period, year: f.year, tags: f.tags,
          exchangeRate: f.exchangeRate, baseCurrencyAmount: f.baseCurrencyAmount,
          note: f.note,
        });
      } else {
        await this.transactionService.create(
          f.accountId, f.categoryId, f.amount, new Date(f.date),
          f.period, f.tags, f.exchangeRate, f.baseCurrencyAmount, f.year, f.note,
        );
      }
      this.cancelForm();
      await this.refresh();
      await this.applyScopeOptions();
      await this.refreshTags();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async saveTransfer(): Promise<void> {
    try {
      const f = this.trForm();
      if (this.editingId()) {
        await this.transferService.update(this.editingId()!, {
          sourceAccountId: f.sourceAccountId, destinationAccountId: f.destAccountId,
          sourceAmount: f.sourceAmount, destinationAmount: f.destinationAmount,
          exchangeRate: f.exchangeRate,
          date: new Date(f.date), period: f.period, year: f.year, note: f.note,
        });
      } else {
        await this.transferService.create(
          f.sourceAccountId, f.destAccountId, f.sourceAmount,
          new Date(f.date), f.period, f.note, f.exchangeRate, f.year,
        );
      }
      this.cancelForm();
      await this.refresh();
      await this.applyScopeOptions();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async deleteTransaction(id: number): Promise<void> {
    if (confirm('Delete this transaction?')) {
      await this.transactionService.delete(id);
      await this.refresh();
      await this.applyScopeOptions();
    }
  }

  async deleteTransfer(id: number): Promise<void> {
    if (confirm('Delete this transfer?')) {
      await this.transferService.delete(id);
      await this.refresh();
      await this.applyScopeOptions();
    }
  }

  getAccountName(id: number): string {
    return this.accounts().find(a => a.id === id)?.name ?? 'Unknown';
  }

  getCategoryName(id: number): string {
    return this.allCategoriesForNameResolution().find(c => c.id === id)?.name ?? 'Unknown';
  }

  formatMoney(amount: number): string {
    return formatMoney(amount, this.baseCurrency());
  }

  scopeLabelText(): string {
    return scopeLabel(this.scope());
  }

  scopePeriod(): string {
    const s = this.scope();
    return !isAllTime(s) ? s.period : '';
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
    return this.allCategoriesForNameResolution().find(c => c.id === txn.categoryId)?.type === 'Income';
  }

  isForeignCurrencyTransaction(txn: Transaction): boolean {
    const account = this.accounts().find(a => a.id === txn.accountId);
    return !!account && account.currency !== this.baseCurrency();
  }

  getTransactionSourceCurrency(txn: Transaction): string {
    return this.getAccountCurrency(txn.accountId);
  }

  formatTransactionDisplayAmount(txn: Transaction): string {
    if (this.isForeignCurrencyTransaction(txn) && txn.baseCurrencyAmount !== null) {
      const sourceCurrency = this.getTransactionSourceCurrency(txn);
      const sourceFormatted = formatMoney(txn.amount, sourceCurrency);
      const baseFormatted = formatMoney(txn.baseCurrencyAmount, this.baseCurrency());
      return `${sourceFormatted} → ${baseFormatted}`;
    }
    if (this.isForeignCurrencyTransaction(txn)) {
      return formatMoney(txn.amount, this.getTransactionSourceCurrency(txn));
    }
    return this.formatMoney(txn.amount);
  }

  formatTransferDisplayAmount(tr: Transfer): string {
    const sourceCurrency = this.getAccountCurrency(tr.sourceAccountId);
    const destCurrency = this.getAccountCurrency(tr.destinationAccountId);
    const isCrossCurrency = sourceCurrency !== destCurrency;
    if (isCrossCurrency) {
      const sourceFormatted = formatMoney(tr.sourceAmount, sourceCurrency);
      const destFormatted = formatMoney(tr.destinationAmount, destCurrency);
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
