import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { TransactionService } from '../../core/services/transaction.service';
import { DriveBackupService } from '../../core/services/drive-backup.service';
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
  private driveBackupService = inject(DriveBackupService);

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

  lastBackupDisplay = computed(() => {
    const date = this.driveBackupService.lastBackupAt();
    if (!date) return 'Never';
    return this.formatRelativeTime(date);
  });

  isDriveConnected = computed(() => this.driveBackupService.isConnected());
  isDriveBackingUp = computed(() => this.driveBackupService.isBackingUp());
  driveError = computed(() => this.driveBackupService.error());

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
      this.showSuccess(`Tag "${editing.old}" renamed to "${editing.new}"`);
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
      this.showSuccess(`Tag "${tag}" deleted from all transactions`);
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to delete tag');
    }
  }

  async connectGoogle(): Promise<void> {
    try {
      this.errorMessage.set('');
      await this.driveBackupService.connect();
      this.showSuccess('Google Drive connected');
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to connect Google');
    }
  }

  async disconnectGoogle(): Promise<void> {
    try {
      this.errorMessage.set('');
      await this.driveBackupService.disconnect();
      this.showSuccess('Google Drive disconnected');
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to disconnect Google');
    }
  }

  async backupNow(): Promise<void> {
    try {
      this.errorMessage.set('');
      await this.driveBackupService.backupNow();
      this.showSuccess('Backup complete');
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Backup failed');
    }
  }

  async restoreFromBackup(): Promise<void> {
    if (!confirm('This will overwrite all local data with the backup. Continue?')) {
      return;
    }
    try {
      this.errorMessage.set('');
      await this.driveBackupService.restore();
      this.showSuccess('Data restored from backup');
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Restore failed');
    }
  }

  async updateBaseCurrency(): Promise<void> {
    try {
      this.errorMessage.set('');
      await this.profileService.updateBaseCurrency(this.baseCurrency());
      this.showSuccess('Currency updated');
      this.driveBackupService.scheduleAutoBackup();
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to update currency');
    }
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  }
}
