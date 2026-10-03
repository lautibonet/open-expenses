import { Component, computed, inject, input } from '@angular/core';
import { Transaction } from '../../../core/models/transaction.model';
import { Transfer } from '../../../core/models/transfer.model';
import { Account } from '../../../core/models/account.model';
import { Category } from '../../../core/models/category.model';
import { LanguageService } from '../../../core/services/language.service';
import { PeriodScope } from '../../../core/types/period.type';
import { cashBasis } from '../../../core/stats/cash-basis';
import { DismissibleAlertComponent } from '../../../shared/components/dismissible-alert/dismissible-alert.component';

export interface MovementItem {
  type: 'transaction' | 'transfer';
  data: Transaction | Transfer;
}

@Component({
  selector: 'app-net-flow-card',
  imports: [DismissibleAlertComponent],
  templateUrl: './net-flow-card.component.html',
  styleUrl: './net-flow-card.component.scss',
})
export class NetFlowCardComponent {
  language = inject(LanguageService);

  movements = input.required<MovementItem[]>();
  accounts = input.required<Account[]>();
  categories = input.required<Category[]>();
  baseCurrency = input.required<string>();
  scope = input.required<PeriodScope>();

  /* ADR 0022: the cash-basis figures come from the same module Stats reads,
     so the two screens always agree. */
  private figures = computed(() => {
    const items = this.movements();
    return cashBasis({
      accounts: this.accounts(),
      categories: this.categories(),
      transactions: items
        .filter((item) => item.type === 'transaction')
        .map((item) => item.data as Transaction),
      transfers: items
        .filter((item) => item.type === 'transfer')
        .map((item) => item.data as Transfer),
      baseCurrency: this.baseCurrency(),
    });
  });

  private totals = computed(() => this.figures().scopeTotals(this.scope()));

  incomeTotal(): number {
    return this.totals().income;
  }

  expenseTotal(): number {
    return this.totals().expenses;
  }

  netTotal(): number {
    return this.totals().net;
  }

  netDisplay(): string {
    const net = this.netTotal();
    const formatted = this.language.formatMoney(net, this.baseCurrency());
    return net > 0 ? `+ ${formatted}` : formatted;
  }

  conversionWarningMessage(): string {
    return this.figures().unconvertedTransactions(this.scope()).length > 0
      ? this.language.t('stats.conversionWarningUnconverted', { currency: this.baseCurrency() })
      : '';
  }
}
