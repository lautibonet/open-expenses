import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { SUPPORTED_CURRENCIES } from '../../core/constants/currencies';
import { Account } from '../../core/models/account.model';
import { Category } from '../../core/models/category.model';
import { BackupCardComponent } from './backup-card/backup-card.component';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, BackupCardComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);

  supportedCurrencies = SUPPORTED_CURRENCIES;
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  baseCurrency = signal('EUR');

  newAccountName = signal('');
  newAccountCurrency = signal('EUR');
  newAccountBalance = signal(0);
  newCategoryName = signal('');
  newCategoryType = signal<'Income' | 'Expense'>('Expense');
  errorMessage = signal('');
  successMessage = signal('');
  editingAccountBalance = signal<{ id: number; value: number } | null>(null);
  editingAccountName = signal<{ id: number; value: string } | null>(null);
  editingCategoryName = signal<{ id: number; value: string } | null>(null);
  confirmingDeactivate = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.accounts.set(await this.accountService.getAll());
    this.categories.set(await this.categoryService.getAll());
  }

  async addAccount(): Promise<void> {
    try {
      await this.accountService.create(this.newAccountName(), this.newAccountCurrency(), this.newAccountBalance());
      this.newAccountName.set('');
      this.newAccountBalance.set(0);
      this.errorMessage.set('');
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to add account');
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
    try {
      await this.accountService.update(editing.id, { name: editing.value });
      this.editingAccountName.set(null);
      this.showSuccess('Account name updated');
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to update account name');
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
    try {
      await this.accountService.update(editing.id, { initialBalance: editing.value });
      this.editingAccountBalance.set(null);
      this.showSuccess('Account balance updated');
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to update account balance');
    }
  }

  deactivationConfirmationLabel(id: number): string {
    const name = this.accounts().find(a => a.id === id)?.name ?? 'this account';
    return `Deactivate ${name}?`;
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
    try {
      await this.categoryService.create(this.newCategoryName(), this.newCategoryType());
      this.newCategoryName.set('');
      this.errorMessage.set('');
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to add category');
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
    try {
      await this.categoryService.update(editing.id, { name: editing.value });
      this.editingCategoryName.set(null);
      this.showSuccess('Category name updated');
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to update category name');
    }
  }

  async deactivateCategory(id: number): Promise<void> {
    await this.categoryService.setActive(id, false);
    await this.refresh();
  }

  async reactivateCategory(id: number): Promise<void> {
    await this.categoryService.setActive(id, true);
    await this.refresh();
  }

  async updateBaseCurrency(): Promise<void> {
    try {
      this.errorMessage.set('');
      await this.profileService.updateBaseCurrency(this.baseCurrency());
      this.showSuccess('Currency updated');
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to update currency');
    }
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    setTimeout(() => this.successMessage.set(''), 3000);
  }
}
