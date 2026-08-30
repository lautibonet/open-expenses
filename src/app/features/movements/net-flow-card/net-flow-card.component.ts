import { Component, inject, input } from '@angular/core';
import { Transaction } from '../../../core/models/transaction.model';
import { Transfer } from '../../../core/models/transfer.model';
import { Account } from '../../../core/models/account.model';
import { Category, isIncomeCategory } from '../../../core/models/category.model';
import { LanguageService } from '../../../core/services/language.service';

export interface MovementItem {
  type: 'transaction' | 'transfer';
  data: Transaction | Transfer;
}

@Component({
  selector: 'app-net-flow-card',
  templateUrl: './net-flow-card.component.html',
  styleUrl: './net-flow-card.component.scss',
})
export class NetFlowCardComponent {
  language = inject(LanguageService);

  movements = input.required<MovementItem[]>();
  accounts = input.required<Account[]>();
  categories = input.required<Category[]>();
  baseCurrency = input.required<string>();

  private baseAmount(txn: Transaction): number {
    const account = this.accounts().find((a) => a.id === txn.accountId);
    if (!account || account.currency === this.baseCurrency()) {
      return txn.amount;
    }
    return txn.baseCurrencyAmount ?? txn.amount;
  }

  private sumFor(direction: 'income' | 'expense'): number {
    const total = this.movements().reduce((sum, item) => {
      if (item.type !== 'transaction') return sum;
      const txn = item.data as Transaction;
      const category = this.categories().find((c) => c.id === txn.categoryId);
      const kind = isIncomeCategory(category?.type) ? 'income' : 'expense';
      if (kind !== direction) return sum;
      return sum + this.baseAmount(txn);
    }, 0);
    return Math.round(total * 100) / 100;
  }

  incomeTotal(): number {
    return this.sumFor('income');
  }

  expenseTotal(): number {
    return this.sumFor('expense');
  }

  netTotal(): number {
    return Math.round((this.incomeTotal() - this.expenseTotal()) * 100) / 100;
  }

  netDisplay(): string {
    const net = this.netTotal();
    const formatted = this.language.formatMoney(net, this.baseCurrency());
    return net > 0 ? `+ ${formatted}` : formatted;
  }
}
