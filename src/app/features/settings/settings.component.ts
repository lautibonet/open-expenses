import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { TransactionService } from '../../core/services/transaction.service';
import { Account } from '../../core/models/account.model';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);
  private transactionService = inject(TransactionService);

  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  tagCounts = signal<{ tag: string; count: number }[]>([]);
  baseCurrency = signal('EUR');

  newAccountName = signal('');
  newAccountCurrency = signal('EUR');
  newAccountBalance = signal(0);
  newCategoryName = signal('');
  newCategoryType = signal<'Income' | 'Expense'>('Expense');
  editingTag = signal<{ old: string; new: string } | null>(null);
  tagToDelete = signal<string | null>(null);
  errorMessage = signal('');
  successMessage = signal('');

  async ngOnInit(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.accounts.set(await this.accountService.getAll());
    this.categories.set(await this.categoryService.getAll());
    this.tagCounts.set(await this.transactionService.getTagCounts());
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

  async deactivateAccount(id: number): Promise<void> {
    await this.accountService.setActive(id, false);
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

  async deactivateCategory(id: number): Promise<void> {
    await this.categoryService.setActive(id, false);
    await this.refresh();
  }

  async reactivateCategory(id: number): Promise<void> {
    await this.categoryService.setActive(id, true);
    await this.refresh();
  }

  startEditTag(tag: string): void {
    this.editingTag.set({ old: tag, new: tag });
  }

  async saveTagRename(): Promise<void> {
    const editing = this.editingTag();
    if (!editing || !editing.new.trim()) return;
    try {
      await this.transactionService.renameTag(editing.old, editing.new);
      this.editingTag.set(null);
      this.successMessage.set(`Tag "${editing.old}" renamed to "${editing.new}"`);
      setTimeout(() => this.successMessage.set(''), 3000);
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to rename tag');
    }
  }

  cancelEditTag(): void {
    this.editingTag.set(null);
  }

  confirmDeleteTag(tag: string): void {
    this.tagToDelete.set(tag);
  }

  cancelDeleteTag(): void {
    this.tagToDelete.set(null);
  }

  async deleteTag(): Promise<void> {
    const tag = this.tagToDelete();
    if (!tag) return;
    try {
      await this.transactionService.deleteTag(tag);
      this.tagToDelete.set(null);
      this.successMessage.set(`Tag "${tag}" deleted from all transactions`);
      setTimeout(() => this.successMessage.set(''), 3000);
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to delete tag');
    }
  }

  async updateBaseCurrency(): Promise<void> {
    try {
      await this.profileService.updateBaseCurrency(this.baseCurrency());
      this.successMessage.set('Base currency updated');
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to update currency');
    }
  }
}
