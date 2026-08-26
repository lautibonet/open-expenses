import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { SUPPORTED_CURRENCIES } from '../../core/constants/currencies';
import { CategoryType } from '../../core/models/category.model';

interface EditableCategory {
  name: string;
  type: CategoryType;
}

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

  supportedCurrencies = SUPPORTED_CURRENCIES;
  step = signal(1);
  baseCurrency = signal('EUR');
  accountName = signal('');
  accountCurrency = signal('EUR');
  accountBalance = signal(0);
  accounts = signal<{ name: string; currency: string; balance: number }[]>([]);
  categories = signal<EditableCategory[]>(
    CategoryService.DEFAULT_CATEGORIES.map(c => ({ name: c.name, type: c.type })),
  );
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

  updateCategoryField<K extends keyof EditableCategory>(index: number, field: K, value: EditableCategory[K]): void {
    this.categories.update(cats =>
      cats.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }

  addCategory(): void {
    this.categories.update(cats => [...cats, { name: '', type: 'Expense' }]);
  }

  removeCategory(index: number): void {
    this.categories.update(cats => cats.filter((_, i) => i !== index));
  }

  canProceedFromCategories(): boolean {
    return this.categories().length > 0;
  }

  async completeOnboarding(): Promise<void> {
    if (!this.canProceedFromCategories()) {
      this.errorMessage.set('At least one category is required');
      return;
    }

    const emptyCategory = this.categories().find(c => !c.name.trim());
    if (emptyCategory) {
      this.errorMessage.set('All categories must have a name');
      return;
    }

    try {
      this.errorMessage.set('');
      await this.profileService.completeOnboarding(this.baseCurrency());
      for (const acc of this.accounts()) {
        await this.accountService.create(acc.name, acc.currency, acc.balance);
      }
      for (const cat of this.categories()) {
        await this.categoryService.create(cat.name, cat.type);
      }
      this.router.navigate(['/dashboard']);
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to complete onboarding');
    }
  }
}
