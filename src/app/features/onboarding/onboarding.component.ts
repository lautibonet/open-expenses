import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { DriveBackupService } from '../../core/services/drive-backup.service';
import { LanguageService } from '../../core/services/language.service';
import { NoBackupFoundError } from '../../backup/drive-backup-provider';
import { SUPPORTED_CURRENCIES } from '../../core/constants/currencies';
import { CategoryType } from '../../core/models/category.model';
import { isLanguage, LANGUAGES, detectBrowserLanguage } from '../../core/types/language.type';

const STEPS = ['language', 'restore', 'currency', 'accounts', 'categories'] as const;

type Step = (typeof STEPS)[number];

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
  private driveBackupService = inject(DriveBackupService);
  private languageService = inject(LanguageService);
  private router = inject(Router);

  supportedCurrencies = SUPPORTED_CURRENCIES;
  languages = LANGUAGES;
  step = signal<Step>('language');
  language = signal(detectBrowserLanguage());
  isRestoring = signal(false);
  noBackupMessage = signal('');
  backupMethod = this.driveBackupService.method;
  baseCurrency = signal('EUR');
  accountName = signal('');
  accountCurrency = signal('EUR');
  accountBalance = signal(0);
  accounts = signal<{ name: string; currency: string; balance: number }[]>([]);
  categories = signal<EditableCategory[]>(
    CategoryService.DEFAULT_CATEGORIES.map(c => ({ name: c.name, type: c.type })),
  );
  errorMessage = signal('');

  goTo(step: Step): void {
    this.step.set(step);
  }

  stepNumber(step: Step): number {
    return STEPS.indexOf(step) + 1;
  }

  async onLanguageChange(value: string): Promise<void> {
    if (!isLanguage(value)) return;
    this.language.set(value);
    await this.languageService.setLanguage(value);
  }

  startFresh(): void {
    this.errorMessage.set('');
    this.noBackupMessage.set('');
    this.step.set('currency');
  }

  async restoreFromCloud(): Promise<void> {
    await this.runRestore(async () => {
      await this.driveBackupService.connect();
      await this.driveBackupService.restore();
    });
  }

  async restoreFromFile(file: File | null): Promise<void> {
    if (!file) return;
    await this.runRestore(() => this.driveBackupService.restoreFromFile(file));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.restoreFromFile(file);
    input.value = '';
  }

  private async runRestore(action: () => Promise<void>): Promise<void> {
    this.isRestoring.set(true);
    this.errorMessage.set('');
    this.noBackupMessage.set('');

    try {
      await action();
      this.router.navigate(['/dashboard']);
    } catch (e: unknown) {
      if (e instanceof NoBackupFoundError) {
        this.noBackupMessage.set('No backup was found in the cloud. You can start fresh instead.');
      } else {
        this.errorMessage.set(e instanceof Error ? e.message : 'Restore failed');
      }
    } finally {
      this.isRestoring.set(false);
    }
  }

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
      await this.profileService.completeOnboarding(this.baseCurrency(), this.language());
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
