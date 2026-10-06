import { Component, computed, inject, input } from '@angular/core';
import { Transaction } from '../../../core/models/transaction.model';
import { Transfer } from '../../../core/models/transfer.model';
import { Account } from '../../../core/models/account.model';
import { Category } from '../../../core/models/category.model';
import { LanguageService } from '../../../core/services/language.service';
import { PeriodScope } from '../../../core/scope/scope';
import { cashBasis } from '../../../core/stats/cash-basis';
import { DismissibleAlertComponent } from '../../../shared/components/dismissible-alert/dismissible-alert.component';

@Component({
  selector: 'app-net-flow-card',
  imports: [DismissibleAlertComponent],
  templateUrl: './net-flow-card.component.html',
  styleUrl: './net-flow-card.component.scss',
})
export class NetFlowCardComponent {
  language = inject(LanguageService);

  /* The Ledger's movements across every Period; the Scope narrows them. */
  transactions = input.required<Transaction[]>();
  transfers = input.required<Transfer[]>();
  accounts = input.required<Account[]>();
  categories = input.required<Category[]>();
  baseCurrency = input.required<string>();
  scope = input.required<PeriodScope>();

  /* ADR 0022: the cash-basis figures come from the same module Stats reads,
     so the two screens always agree. */
  private figures = computed(() =>
    cashBasis({
      accounts: this.accounts(),
      categories: this.categories(),
      transactions: this.transactions(),
      transfers: this.transfers(),
      baseCurrency: this.baseCurrency(),
    }),
  );

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
    const figures = this.figures();
    const scope = this.scope();
    return figures.unconvertedTransactions(scope).length > 0
      || figures.unconvertedCardPayments(scope).length > 0
      ? this.language.t('stats.conversionWarningUnconverted', { currency: this.baseCurrency() })
      : '';
  }
}
