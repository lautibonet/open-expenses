import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
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
import { MONTHS, getCurrentPeriod } from '../../core/types/period.type';
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
  tags: string[];
  exchangeRate: number | null;
  baseCurrencyAmount: number | null;
}

interface TransferForm {
  sourceAccountId: number;
  destAccountId: number;
  amount: number;
  date: string;
  period: string;
  note: string;
}

@Component({
  selector: 'app-movements',
  imports: [FormsModule, DatePipe, TagInputComponent],
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

  selectedPeriod = signal(getCurrentPeriod());
  months = MONTHS;
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  movements = signal<MovementItem[]>([]);
  baseCurrency = signal('EUR');
  allTags = signal<string[]>([]);

  showForm = signal<'none' | 'transaction' | 'transfer'>('none');
  editingId = signal<number | null>(null);

  exchangeRateState = signal<ExchangeRateState>({
    loading: false, error: '', rate: null, date: '',
  });

  txForm = signal<TransactionForm>({
    accountId: 0, categoryId: 0, amount: 0,
    date: new Date().toISOString().split('T')[0],
    period: getCurrentPeriod(), tags: [],
    exchangeRate: null, baseCurrencyAmount: null,
  });
  trForm = signal<TransferForm>({
    sourceAccountId: 0, destAccountId: 0, amount: 0,
    date: new Date().toISOString().split('T')[0],
    period: getCurrentPeriod(), note: '',
  });
  errorMessage = signal('');

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
    await this.refreshTags();
    if (this.accounts().length > 0) {
      const first = this.accounts()[0].id!;
      const second = this.accounts()[1]?.id;
      this.txForm.update(f => ({ ...f, accountId: first, categoryId: this.categories()[0]?.id ?? 0 }));
      this.trForm.update(f => ({ ...f, sourceAccountId: first, destAccountId: second ?? first }));
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const period = this.selectedPeriod();
    const txns = await this.transactionService.getByPeriod(period);
    const transfers = await this.transferService.getByPeriod(period);

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
            tags: [...t.tags],
            exchangeRate: t.exchangeRate,
            baseCurrencyAmount: t.baseCurrencyAmount,
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
        period: this.selectedPeriod(),
        tags: [],
        exchangeRate: null,
        baseCurrencyAmount: null,
      });
      if (this.accounts().length > 0) {
        this.checkExchangeRate(this.accounts()[0].id!);
      }
    }
  }

  openTransferForm(id?: number): void {
    this.showForm.set('transfer');
    this.editingId.set(id ?? null);
    this.errorMessage.set('');
    if (id) {
      this.transferService.getById(id).then(t => {
        if (t) {
          this.trForm.set({
            sourceAccountId: t.sourceAccountId,
            destAccountId: t.destinationAccountId,
            amount: t.amount,
            date: new Date(t.date).toISOString().split('T')[0],
            period: t.period,
            note: t.note,
          });
        }
      });
    } else {
      this.trForm.set({
        sourceAccountId: this.accounts()[0]?.id ?? 0,
        destAccountId: this.accounts()[1]?.id ?? this.accounts()[0]?.id ?? 0,
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        period: this.selectedPeriod(),
        note: '',
      });
    }
  }

  cancelForm(): void {
    this.showForm.set('none');
    this.editingId.set(null);
    this.errorMessage.set('');
    this.txForm.update(f => ({ ...f, tags: [] }));
    this.resetExchangeRate();
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
    this.checkExchangeRate(accountId);
  }

  private async checkExchangeRate(accountId: number): Promise<void> {
    const account = this.accounts().find(a => a.id === accountId);
    if (!account || account.currency === this.baseCurrency()) {
      this.txForm.update(f => ({ ...f, exchangeRate: null, baseCurrencyAmount: null }));
      this.resetExchangeRate();
      return;
    }

    this.exchangeRateState.update(s => ({ ...s, loading: true, error: '' }));

    try {
      const result = await this.exchangeRateService.getRate(
        account.currency, this.baseCurrency(),
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
          date: new Date(f.date), period: f.period, tags: f.tags,
          exchangeRate: f.exchangeRate, baseCurrencyAmount: f.baseCurrencyAmount,
        });
      } else {
        await this.transactionService.create(
          f.accountId, f.categoryId, f.amount, new Date(f.date),
          f.period, f.tags, f.exchangeRate, f.baseCurrencyAmount,
        );
      }
      this.cancelForm();
      await this.refresh();
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
          amount: f.amount, date: new Date(f.date), period: f.period, note: f.note,
        });
      } else {
        await this.transferService.create(
          f.sourceAccountId, f.destAccountId, f.amount,
          new Date(f.date), f.period, f.note,
        );
      }
      this.cancelForm();
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async deleteTransaction(id: number): Promise<void> {
    if (confirm('Delete this transaction?')) {
      await this.transactionService.delete(id);
      await this.refresh();
    }
  }

  async deleteTransfer(id: number): Promise<void> {
    if (confirm('Delete this transfer?')) {
      await this.transferService.delete(id);
      await this.refresh();
    }
  }

  getAccountName(id: number): string {
    return this.accounts().find(a => a.id === id)?.name ?? 'Unknown';
  }

  getCategoryName(id: number): string {
    return this.categories().find(c => c.id === id)?.name ?? 'Unknown';
  }

  formatMoney(amount: number): string {
    return formatMoney(amount, this.baseCurrency());
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
