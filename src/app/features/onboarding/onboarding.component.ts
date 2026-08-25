import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  private profileService = inject(ProfileService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private router = inject(Router);

  step = signal(1);
  baseCurrency = signal('EUR');
  accountName = signal('');
  accountCurrency = signal('EUR');
  accountBalance = signal(0);
  accounts = signal<{ name: string; currency: string; balance: number }[]>([]);
  defaultCategories = signal<{ name: string; type: 'Income' | 'Expense'; active: boolean }[]>([
    { name: 'Food', type: 'Expense', active: true },
    { name: 'Transport', type: 'Expense', active: true },
    { name: 'Housing', type: 'Expense', active: true },
    { name: 'Subscriptions', type: 'Expense', active: true },
    { name: 'Leisure', type: 'Expense', active: true },
    { name: 'Misc', type: 'Expense', active: true },
    { name: 'Payroll', type: 'Income', active: true },
    { name: 'Second-hand Sale', type: 'Income', active: true },
    { name: 'Refund', type: 'Income', active: true },
  ]);
  errorMessage = signal('');

  addAccount(): void {
    if (!this.accountName()) {
      this.errorMessage.set('Account name is required');
      return;
    }
    const exists = this.accounts().some(
      a => a.name.toLowerCase() === this.accountName().toLowerCase(),
    );
    if (exists) {
      this.errorMessage.set('Account name already added');
      return;
    }
    this.accounts.update(accs => [
      ...accs,
      {
        name: this.accountName(),
        currency: this.accountCurrency(),
        balance: this.accountBalance(),
      },
    ]);
    this.accountName.set('');
    this.accountBalance.set(0);
    this.errorMessage.set('');
  }

  removeAccount(index: number): void {
    this.accounts.update(accs => accs.filter((_, i) => i !== index));
  }

  toggleCategory(index: number): void {
    this.defaultCategories.update(cats =>
      cats.map((c, i) => (i === index ? { ...c, active: !c.active } : c)),
    );
  }

  async completeOnboarding(): Promise<void> {
    try {
      await this.profileService.completeOnboarding(this.baseCurrency());
      for (const acc of this.accounts()) {
        await this.accountService.create(acc.name, acc.currency, acc.balance);
      }
      for (const cat of this.defaultCategories()) {
        if (cat.active) {
          await this.categoryService.create(cat.name, cat.type);
        }
      }
      this.router.navigate(['/dashboard']);
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to complete onboarding');
    }
  }
}
