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

  averagesYear = signal<string>(String(getCurrentYear()));
  averagesYears: string[] = [...this.years.map(String), 'All time'];
  avgMonthlyIncome = signal(0);
  avgMonthlyExpenses = signal(0);
  avgMonthlySavings = signal(0);

  async ngOnInit(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    await this.refresh();
    await this.refreshAverages();
  }

  async refresh(): Promise<void> {
    const period = this.selectedPeriod();
    const txns = await this.transactionService.getByPeriod(period);
    this.periodTransactions.set(txns);
    this.periodTransfers.set(await this.transferService.getByPeriod(period));
    this.accounts.set(await this.accountService.getAll());

    const allCategories = await this.categoryService.getAll();
    this.categories.set(allCategories);
    const catMap = new Map(allCategories.map(c => [c.id!, c]));

    let income = 0;
    let expenses = 0;
    const catTotals = new Map<number, number>();

    for (const t of txns) {
      const amount = t.baseCurrencyAmount ?? t.amount;
      const cat = catMap.get(t.categoryId);
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
      const cat = catMap.get(catId);
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
        const cat = catMap.get(t.categoryId);
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

  async refreshAverages(): Promise<void> {
    const allTxns = await this.transactionService.getAll();
    const allCategories = await this.categoryService.getAll();
    const catMap = new Map(allCategories.map(c => [c.id!, c]));

    const selectedYear = this.averagesYear();

    const filteredTxns = selectedYear === 'All time'
      ? allTxns
      : allTxns.filter(t => {
          const d = new Date(t.date);
          return String(d.getFullYear()) === selectedYear;
        });

    const isAllTime = selectedYear === 'All time';

    const monthsWithData = new Set(
      filteredTxns.map(t => isAllTime
        ? `${new Date(t.date).getFullYear()}-${t.period}`
        : t.period
      )
    );

    if (monthsWithData.size === 0) {
      this.avgMonthlyIncome.set(0);
      this.avgMonthlyExpenses.set(0);
      this.avgMonthlySavings.set(0);
      return;
    }

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of filteredTxns) {
      const amount = t.baseCurrencyAmount ?? t.amount;
      const cat = catMap.get(t.categoryId);
      if (cat?.type === 'Income') {
        totalIncome += amount;
      } else {
        totalExpenses += amount;
      }
    }

    const months = monthsWithData.size;
    this.avgMonthlyIncome.set(Math.round(totalIncome / months * 100) / 100);
    this.avgMonthlyExpenses.set(Math.round(totalExpenses / months * 100) / 100);
    this.avgMonthlySavings.set(Math.round((totalIncome - totalExpenses) / months * 100) / 100);
  }

  formatMoney(amount: number): string {
    return formatMoney(amount, this.baseCurrency());
  }

  formatAccountBalance(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }
}
