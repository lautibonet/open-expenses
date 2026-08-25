import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { Transaction } from '../../core/models/transaction.model';
import { Transfer } from '../../core/models/transfer.model';
import { Account } from '../../core/models/account.model';
import { Category } from '../../core/models/category.model';
import { MONTHS, getCurrentPeriod } from '../../core/types/period.type';
import { formatMoney } from '../../core/types/money';

interface MovementItem {
  type: 'transaction' | 'transfer';
  data: Transaction | Transfer;
}

@Component({
  selector: 'app-movements',
  imports: [FormsModule, DatePipe],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.scss',
})
export class MovementsComponent implements OnInit {
  private transactionService = inject(TransactionService);
  private transferService = inject(TransferService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);

  selectedPeriod = signal(getCurrentPeriod());
  months = MONTHS;
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  movements = signal<MovementItem[]>([]);
  baseCurrency = signal('EUR');

  showForm = signal<'none' | 'transaction' | 'transfer'>('none');
  editingId = signal<number | null>(null);

  formAccountId = signal<number>(0);
  formCategoryId = signal<number>(0);
  formAmount = signal<number>(0);
  formDate = signal(new Date().toISOString().split('T')[0]);
  formPeriod = signal<string>(getCurrentPeriod());
  formTags = signal('');
  formSourceAccountId = signal<number>(0);
  formDestAccountId = signal<number>(0);
  formNote = signal('');
  formExchangeRate = signal<number | null>(null);
  formBaseAmount = signal<number | null>(null);
  errorMessage = signal('');

  async ngOnInit(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    this.accounts.set(await this.accountService.getActive());
    this.categories.set(await this.categoryService.getActive());
    if (this.accounts().length > 0) {
      this.formAccountId.set(this.accounts()[0].id!);
      this.formSourceAccountId.set(this.accounts()[0].id!);
      if (this.accounts().length > 1) {
        this.formDestAccountId.set(this.accounts()[1].id!);
      }
      this.formCategoryId.set(this.categories()[0]?.id ?? 0);
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

  openTransactionForm(id?: number): void {
    this.showForm.set('transaction');
    this.editingId.set(id ?? null);
    this.errorMessage.set('');
    if (id) {
      this.transactionService.getById(id).then(t => {
        if (t) {
          this.formAccountId.set(t.accountId);
          this.formCategoryId.set(t.categoryId);
          this.formAmount.set(t.amount);
          this.formDate.set(new Date(t.date).toISOString().split('T')[0]);
          this.formPeriod.set(t.period);
          this.formTags.set(t.tags.join(', '));
          this.formExchangeRate.set(t.exchangeRate);
          this.formBaseAmount.set(t.baseCurrencyAmount);
        }
      });
    } else {
      this.formAmount.set(0);
      this.formDate.set(new Date().toISOString().split('T')[0]);
      this.formPeriod.set(this.selectedPeriod());
      this.formTags.set('');
      this.formExchangeRate.set(null);
      this.formBaseAmount.set(null);
    }
  }

  openTransferForm(id?: number): void {
    this.showForm.set('transfer');
    this.editingId.set(id ?? null);
    this.errorMessage.set('');
    if (id) {
      this.transferService.getById(id).then(t => {
        if (t) {
          this.formSourceAccountId.set(t.sourceAccountId);
          this.formDestAccountId.set(t.destinationAccountId);
          this.formAmount.set(t.amount);
          this.formDate.set(new Date(t.date).toISOString().split('T')[0]);
          this.formPeriod.set(t.period);
          this.formNote.set(t.note);
        }
      });
    } else {
      this.formAmount.set(0);
      this.formDate.set(new Date().toISOString().split('T')[0]);
      this.formPeriod.set(this.selectedPeriod());
      this.formNote.set('');
    }
  }

  cancelForm(): void {
    this.showForm.set('none');
    this.editingId.set(null);
    this.errorMessage.set('');
  }

  async saveTransaction(): Promise<void> {
    try {
      const tags = this.formTags().split(',').map(t => t.trim()).filter(t => t.length > 0);
      if (this.editingId()) {
        await this.transactionService.update(this.editingId()!, {
          accountId: this.formAccountId(),
          categoryId: this.formCategoryId(),
          amount: this.formAmount(),
          date: new Date(this.formDate()),
          period: this.formPeriod(),
          tags,
          exchangeRate: this.formExchangeRate(),
          baseCurrencyAmount: this.formBaseAmount(),
        });
      } else {
        await this.transactionService.create(
          this.formAccountId(),
          this.formCategoryId(),
          this.formAmount(),
          new Date(this.formDate()),
          this.formPeriod(),
          tags,
          this.formExchangeRate(),
          this.formBaseAmount(),
        );
      }
      this.cancelForm();
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async saveTransfer(): Promise<void> {
    try {
      if (this.editingId()) {
        await this.transferService.update(this.editingId()!, {
          sourceAccountId: this.formSourceAccountId(),
          destinationAccountId: this.formDestAccountId(),
          amount: this.formAmount(),
          date: new Date(this.formDate()),
          period: this.formPeriod(),
          note: this.formNote(),
        });
      } else {
        await this.transferService.create(
          this.formSourceAccountId(),
          this.formDestAccountId(),
          this.formAmount(),
          new Date(this.formDate()),
          this.formPeriod(),
          this.formNote(),
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

  formatMoney(cents: number): string {
    return formatMoney(cents, this.baseCurrency());
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
