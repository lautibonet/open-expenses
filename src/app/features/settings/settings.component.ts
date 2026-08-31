import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { LanguageService } from '../../core/services/language.service';
import { SUPPORTED_CURRENCIES } from '../../core/constants/currencies';
import { Account } from '../../core/models/account.model';
import { Category, CategoryType } from '../../core/models/category.model';
import { errorCopy } from '../../core/models/translation-error';
import { BackupCardComponent } from './backup-card/backup-card.component';
import { LanguageCardComponent } from './language-card/language-card.component';
import { DismissibleAlertComponent } from '../../shared/components/dismissible-alert/dismissible-alert.component';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, BackupCardComponent, LanguageCardComponent, DismissibleAlertComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);
  language = inject(LanguageService);

  supportedCurrencies = SUPPORTED_CURRENCIES;
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  baseCurrency = signal('EUR');

  newAccountName = signal('');
  newAccountCurrency = signal('EUR');
  newAccountBalance = signal(0);
  newCategoryName = signal('');
  newCategoryType = signal<CategoryType>('expense');
  errorMessage = signal('');
  successMessage = signal('');
  statusEpoch = signal(0);
  editingAccountBalance = signal<{ id: number; value: number } | null>(null);
  editingAccountName = signal<{ id: number; value: string } | null>(null);
  editingCategoryName = signal<{ id: number; value: string } | null>(null);
  confirmingDeactivate = signal<number | null>(null);
  confirmingCategoryDeactivate = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.accounts.set(await this.accountService.getAll());
    this.categories.set(await this.categoryService.getAll());
  }

  async addAccount(): Promise<void> {
    this.clearStatus();
    try {
      await this.accountService.create(
        this.newAccountName(),
        this.newAccountCurrency(),
        this.newAccountBalance(),
      );
      this.newAccountName.set('');
      this.newAccountBalance.set(0);
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(e, this.language.translateFn, 'settings.failedAddAccount'),
      );
    }
  }

  startEditAccountName(id: number, value: string): void {
    this.editingAccountName.set({ id, value });
  }

  cancelEditAccountName(): void {
    this.editingAccountName.set(null);
  }

  async saveAccountName(): Promise<void> {
    const editing = this.editingAccountName();
    if (!editing) return;
    this.clearStatus();
    try {
      await this.accountService.update(editing.id, { name: editing.value });
      this.editingAccountName.set(null);
      this.showSuccess(this.language.t('settings.accountNameUpdated'));
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(
          e,
          this.language.translateFn,
          'settings.failedUpdateAccountName',
        ),
      );
    }
  }

  startEditAccountBalance(id: number, value: number): void {
    this.editingAccountBalance.set({ id, value });
  }

  cancelEditAccountBalance(): void {
    this.editingAccountBalance.set(null);
  }

  async saveAccountBalance(): Promise<void> {
    const editing = this.editingAccountBalance();
    if (!editing) return;
    this.clearStatus();
    try {
      await this.accountService.update(editing.id, { initialBalance: editing.value });
      this.editingAccountBalance.set(null);
      this.showSuccess(this.language.t('settings.accountBalanceUpdated'));
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(
          e,
          this.language.translateFn,
          'settings.failedUpdateAccountBalance',
        ),
      );
    }
  }

  requestDeactivate(id: number): void {
    this.confirmingDeactivate.set(id);
  }

  cancelDeactivate(): void {
    this.confirmingDeactivate.set(null);
  }

  async confirmDeactivate(): Promise<void> {
    const id = this.confirmingDeactivate();
    if (id === null) return;
    await this.accountService.setActive(id, false);
    this.confirmingDeactivate.set(null);
    await this.refresh();
  }

  async reactivateAccount(id: number): Promise<void> {
    await this.accountService.setActive(id, true);
    await this.refresh();
  }

  async addCategory(): Promise<void> {
    this.clearStatus();
    try {
      await this.categoryService.create(this.newCategoryName(), this.newCategoryType());
      this.newCategoryName.set('');
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(e, this.language.translateFn, 'settings.failedAddCategory'),
      );
    }
  }

  startEditCategoryName(id: number, value: string): void {
    this.editingCategoryName.set({ id, value });
  }

  cancelEditCategoryName(): void {
    this.editingCategoryName.set(null);
  }

  async saveCategoryName(): Promise<void> {
    const editing = this.editingCategoryName();
    if (!editing) return;
    this.clearStatus();
    try {
      await this.categoryService.update(editing.id, { name: editing.value });
      this.editingCategoryName.set(null);
      this.showSuccess(this.language.t('settings.categoryNameUpdated'));
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(
          e,
          this.language.translateFn,
          'settings.failedUpdateCategoryName',
        ),
      );
    }
  }

  requestCategoryDeactivate(id: number): void {
    this.confirmingCategoryDeactivate.set(id);
  }

  cancelCategoryDeactivate(): void {
    this.confirmingCategoryDeactivate.set(null);
  }

  async confirmCategoryDeactivate(): Promise<void> {
    const id = this.confirmingCategoryDeactivate();
    if (id === null) return;
    await this.categoryService.setActive(id, false);
    this.confirmingCategoryDeactivate.set(null);
    await this.refresh();
  }

  async reactivateCategory(id: number): Promise<void> {
    await this.categoryService.setActive(id, true);
    await this.refresh();
  }

  async updateBaseCurrency(): Promise<void> {
    this.clearStatus();
    try {
      await this.profileService.updateBaseCurrency(this.baseCurrency());
      this.showSuccess(this.language.t('settings.currencyUpdated'));
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(
          e,
          this.language.translateFn,
          'settings.failedUpdateCurrency',
        ),
      );
    }
  }

  private clearStatus(): void {
    this.statusEpoch.update((n) => n + 1);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    setTimeout(() => this.successMessage.set(''), 3000);
  }
}

