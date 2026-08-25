import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../core/services/transaction.service';
import { TransferService } from '../../core/services/transfer.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { MONTHS, getCurrentPeriod, getCurrentYear } from '../../core/types/period.type';
import { formatMoney } from '../../core/types/money';
import { Transaction } from '../../core/models/transaction.model';
import { Transfer } from '../../core/models/transfer.model';
import { Account } from '../../core/models/account.model';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private transactionService = inject(TransactionService);
  private transferService = inject(TransferService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);

  selectedPeriod = signal(getCurrentPeriod());
  selectedYear = signal(getCurrentYear());
  months = MONTHS;
  years = Array.from({ length: 10 }, (_, i) => getCurrentYear() - i);

  periodTransactions = signal<Transaction[]>([]);
  periodTransfers = signal<Transfer[]>([]);
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  baseCurrency = signal('EUR');

  totalIncome = signal(0);
  totalExpenses = signal(0);
  netIncome = signal(0);
  categoryBreakdown = signal<{ name: string; total: number }[]>([]);
  accountBalances = signal<{ account: Account; balance: number }[]>([]);

  async ngOnInit(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const period = this.selectedPeriod();
    const txns = await this.transactionService.getByPeriod(period);
    this.periodTransactions.set(txns);
    this.periodTransfers.set(await this.transferService.getByPeriod(period));
    this.accounts.set(await this.accountService.getAll());
    this.categories.set(await this.categoryService.getAll());

    let income = 0;
    let expenses = 0;
    const catTotals = new Map<number, number>();

    for (const t of txns) {
      const amount = t.baseCurrencyAmount ?? t.amount;
      const cat = await this.categoryService.getById(t.categoryId);
      if (cat?.type === 'Income') {
        income += amount;
      } else {
        expenses += amount;
        catTotals.set(t.categoryId, (catTotals.get(t.categoryId) ?? 0) + amount);
      }
    }

    this.totalIncome.set(income);
    this.totalExpenses.set(expenses);
    this.netIncome.set(income - expenses);

    const breakdown: { name: string; total: number }[] = [];
    for (const [catId, total] of catTotals) {
      const cat = await this.categoryService.getById(catId);
      if (cat) {
        breakdown.push({ name: cat.name, total });
      }
    }
    this.categoryBreakdown.set(breakdown.sort((a, b) => b.total - a.total));

    const balances: { account: Account; balance: number }[] = [];
    for (const acc of this.accounts()) {
      const txnsAll = await this.transactionService.getByAccount(acc.id!);
      const transfersAll = await this.transferService.getAll();
      let balance = acc.initialBalance;
      for (const t of txnsAll) {
        const cat = await this.categoryService.getById(t.categoryId);
        balance += cat?.type === 'Income' ? t.amount : -t.amount;
      }
      for (const tr of transfersAll) {
        if (tr.sourceAccountId === acc.id) balance -= tr.amount;
        if (tr.destinationAccountId === acc.id) balance += tr.amount;
      }
      balances.push({ account: acc, balance });
    }
    this.accountBalances.set(balances);
  }

  formatMoney(cents: number): string {
    return formatMoney(cents, this.baseCurrency());
  }
}
