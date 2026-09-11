import { Component, ElementRef, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountService, DeleteRefusalReason } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { LanguageService } from '../../core/services/language.service';
import { DataVersionService } from '../../core/services/data-version.service';
import { SUPPORTED_CURRENCIES } from '../../core/constants/currencies';
import { Account } from '../../core/models/account.model';
import { Category, CategoryType } from '../../core/models/category.model';
import { errorCopy, TranslationError } from '../../core/models/translation-error';
import { BackupCardComponent } from './backup-card/backup-card.component';
import { LanguageCardComponent } from './language-card/language-card.component';
import { EraseCardComponent } from './erase-card/erase-card.component';
import { DismissibleAlertComponent } from '../../shared/components/dismissible-alert/dismissible-alert.component';

interface AccountEditState {
  id: number;
  name: string;
  initialBalance: number;
}

interface CardEditState {
  id: number;
  name: string;
  initialBalance: number;
  limit: number | null;
  linkedAccountId: number;
}

interface CategoryEditState {
  id: number;
  name: string;
}

type PencilTarget = { kind: 'account' | 'card' | 'category' | 'base-currency'; id: number };

@Component({
  selector: 'app-settings',
  imports: [FormsModule, BackupCardComponent, LanguageCardComponent, EraseCardComponent, DismissibleAlertComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private profileService = inject(ProfileService);
  private dataVersion = inject(DataVersionService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  language = inject(LanguageService);

  supportedCurrencies = SUPPORTED_CURRENCIES;
  accounts = signal<Account[]>([]);
  cards = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  baseCurrency = signal('EUR');

  newAccountName = signal('');
  newAccountCurrency = signal('EUR');
  /* Null while the field is empty; an empty field creates the account with balance 0. */
  newAccountBalance = signal<number | null>(null);
  newCardName = signal('');
  newCardLinkedAccountId = signal<number | null>(null);
  newCardLimit = signal<number | null>(null);
  /* Null while the field is empty; an empty field creates the card with debt 0. */
  newCardBalance = signal<number | null>(null);
  newCardCreateCategory = signal(true);
  newCategoryName = signal('');
  newCategoryType = signal<CategoryType>('expense');
  addingAccount = signal(false);
  addingCard = signal(false);
  addingCategory = signal(false);
  errorMessage = signal('');
  statusEpoch = signal(0);
  editingAccount = signal<AccountEditState | null>(null);
  editingCard = signal<CardEditState | null>(null);
  editingCategory = signal<CategoryEditState | null>(null);
  editingBaseCurrency = signal(false);
  baseCurrencyDraft = signal('EUR');
  editError = signal('');
  confirmingAccountDelete = signal<number | null>(null);
  confirmingCardDelete = signal<number | null>(null);
  confirmingCategoryDelete = signal<number | null>(null);
  refusedAccount = signal<number | null>(null);
  refusedAccountReason = signal<DeleteRefusalReason | null>(null);
  refusedCard = signal<number | null>(null);
  refusedCategory = signal<number | null>(null);

  accountNameInput = viewChild<ElementRef<HTMLInputElement>>('accountNameInput');
  cardNameInput = viewChild<ElementRef<HTMLInputElement>>('cardNameInput');
  categoryNameInput = viewChild<ElementRef<HTMLInputElement>>('categoryNameInput');
  baseCurrencySelect = viewChild<ElementRef<HTMLSelectElement>>('baseCurrencySelect');
  newAccountNameInput = viewChild<ElementRef<HTMLInputElement>>('newAccountNameInput');
  newCardNameInput = viewChild<ElementRef<HTMLInputElement>>('newCardNameInput');
  newCategoryNameInput = viewChild<ElementRef<HTMLInputElement>>('newCategoryNameInput');

  /* On open, focus the first input of the expanded edit state or of the
     New-button-revealed add form. */
  private focusEditState = effect(() => {
    if (this.editingAccount()) {
      this.accountNameInput()?.nativeElement.focus();
    }
    if (this.editingCard()) {
      this.cardNameInput()?.nativeElement.focus();
    }
    if (this.editingCategory()) {
      this.categoryNameInput()?.nativeElement.focus();
    }
    if (this.editingBaseCurrency()) {
      this.baseCurrencySelect()?.nativeElement.focus();
    }
    if (this.addingAccount()) {
      this.newAccountNameInput()?.nativeElement.focus();
    }
    if (this.addingCard()) {
      this.newCardNameInput()?.nativeElement.focus();
    }
    if (this.addingCategory()) {
      this.newCategoryNameInput()?.nativeElement.focus();
    }
  });

  private reloadDataOnVersionChange = this.dataVersion.reloadOnChange(() => this.loadAll());

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.baseCurrency.set(await this.profileService.getBaseCurrency());
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.accounts.set(await this.accountService.getCashAccounts());
    this.cards.set(await this.accountService.getCards());
    this.categories.set(await this.categoryService.getAll());
  }

  /* Creation lives behind a New button: the reveal resets the draft so
     every open starts from a fresh form; saving or cancelling hides it. */
  startAddAccount(): void {
    this.newAccountName.set('');
    this.newAccountCurrency.set('EUR');
    this.newAccountBalance.set(null);
    this.clearStatus();
    this.addingAccount.set(true);
  }

  cancelAddAccount(): void {
    this.addingAccount.set(false);
    this.clearStatus();
  }

  async addAccount(): Promise<void> {
    this.clearStatus();
    try {
      await this.accountService.create(
        this.newAccountName(),
        this.newAccountCurrency(),
        this.newAccountBalance() ?? 0,
      );
      this.addingAccount.set(false);
      this.newAccountName.set('');
      this.newAccountBalance.set(null);
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(e, this.language.translateFn, 'settings.failedAddAccount'),
      );
    }
  }

  startEditAccount(id: number): void {
    const account = this.accounts().find((a) => a.id === id);
    if (!account) return;
    this.editingCategory.set(null);
    this.editingCard.set(null);
    this.editingAccount.set({
      id,
      name: account.name,
      initialBalance: account.initialBalance,
    });
    this.editError.set('');
  }

  editAccountName(value: string): void {
    this.editingAccount.update((e) => (e ? { ...e, name: value } : e));
  }

  editAccountBalance(value: number): void {
    this.editingAccount.update((e) => (e ? { ...e, initialBalance: value } : e));
  }

  cancelEditAccount(): void {
    const id = this.editingAccount()?.id;
    this.editingAccount.set(null);
    this.editError.set('');
    if (id !== undefined) this.returnToPencil({ kind: 'account', id });
  }

  async saveAccountEdit(): Promise<void> {
    const editing = this.editingAccount();
    if (!editing) return;
    try {
      await this.accountService.update(editing.id, {
        name: editing.name,
        initialBalance: editing.initialBalance,
      });
      this.editingAccount.set(null);
      this.editError.set('');
      await this.refresh();
      this.returnToPencil({ kind: 'account', id: editing.id });
    } catch (e: unknown) {
      this.editError.set(
        errorCopy(e, this.language.translateFn, 'settings.failedSaveAccount'),
      );
    }
  }

  startEditCategory(id: number): void {
    const category = this.categories().find((c) => c.id === id);
    if (!category) return;
    this.editingAccount.set(null);
    this.editingCard.set(null);
    this.editingCategory.set({ id, name: category.name });
    this.editError.set('');
  }

  editCategoryName(value: string): void {
    this.editingCategory.update((c) => (c ? { ...c, name: value } : c));
  }

  cancelEditCategory(): void {
    const id = this.editingCategory()?.id;
    this.editingCategory.set(null);
    this.editError.set('');
    if (id !== undefined) this.returnToPencil({ kind: 'category', id });
  }

  async saveCategoryEdit(): Promise<void> {
    const editing = this.editingCategory();
    if (!editing) return;
    try {
      await this.categoryService.update(editing.id, { name: editing.name });
      this.editingCategory.set(null);
      this.editError.set('');
      await this.refresh();
      this.returnToPencil({ kind: 'category', id: editing.id });
    } catch (e: unknown) {
      this.editError.set(
        errorCopy(e, this.language.translateFn, 'settings.failedSaveCategory'),
      );
    }
  }

  startEditBaseCurrency(): void {
    this.baseCurrencyDraft.set(this.baseCurrency());
    this.editingBaseCurrency.set(true);
    this.editError.set('');
  }

  editBaseCurrency(currency: string): void {
    this.baseCurrencyDraft.set(currency);
  }

  cancelEditBaseCurrency(): void {
    this.editingBaseCurrency.set(false);
    this.editError.set('');
    this.returnToPencil({ kind: 'base-currency', id: 0 });
  }

  async saveBaseCurrency(): Promise<void> {
    try {
      await this.profileService.updateBaseCurrency(this.baseCurrencyDraft());
      this.baseCurrency.set(this.baseCurrencyDraft());
      this.editingBaseCurrency.set(false);
      this.editError.set('');
      this.returnToPencil({ kind: 'base-currency', id: 0 });
    } catch (e: unknown) {
      this.editError.set(
        errorCopy(e, this.language.translateFn, 'settings.failedSaveCurrency'),
      );
    }
  }

  /* ADR 0018: one remove action per row, branching on the data. An unused
     item opens the inline delete confirm; an item with movements is refused
     with an explanation that offers Deactivation as the fallback. */
  async requestDeleteAccount(id: number): Promise<void> {
    this.confirmingCategoryDelete.set(null);
    this.refusedCategory.set(null);
    this.confirmingAccountDelete.set(null);
    this.refusedAccount.set(null);
    this.refusedAccountReason.set(null);
    const reason = await this.accountService.getDeleteRefusal(id);
    if (reason) {
      this.refusedAccount.set(id);
      this.refusedAccountReason.set(reason);
    } else {
      this.confirmingAccountDelete.set(id);
    }
  }

  cancelDeleteAccount(): void {
    this.confirmingAccountDelete.set(null);
  }

  cancelRefuseAccount(): void {
    this.refusedAccount.set(null);
    this.refusedAccountReason.set(null);
  }

  async confirmDeleteAccount(): Promise<void> {
    const id = this.confirmingAccountDelete();
    if (id === null) return;
    this.confirmingAccountDelete.set(null);
    try {
      await this.accountService.delete(id);
    } catch (e: unknown) {
      if (e instanceof TranslationError && e.key === 'errors.accountHasMovements') {
        this.refusedAccount.set(id);
        this.refusedAccountReason.set('movements');
        return;
      }
      if (e instanceof TranslationError && e.key === 'errors.accountLinkedToCard') {
        this.refusedAccount.set(id);
        this.refusedAccountReason.set('linked-card');
        return;
      }
      throw e;
    }
    await this.refresh();
  }

  async deactivateInstead(id: number): Promise<void> {
    this.refusedAccount.set(null);
    this.refusedAccountReason.set(null);
    await this.accountService.setActive(id, false);
    await this.refresh();
  }

  async reactivateAccount(id: number): Promise<void> {
    await this.accountService.setActive(id, true);
    await this.refresh();
  }

  /* Credit Cards (ADR 0022): a card is an Account of kind credit-card, so it
     is created and managed through the AccountService, in its own section. */

  startAddCard(): void {
    this.newCardName.set('');
    this.newCardLinkedAccountId.set(this.accounts()[0]?.id ?? null);
    this.newCardLimit.set(null);
    this.newCardBalance.set(null);
    this.newCardCreateCategory.set(true);
    this.clearStatus();
    this.addingCard.set(true);
  }

  cancelAddCard(): void {
    this.addingCard.set(false);
    this.clearStatus();
  }

  async addCard(): Promise<void> {
    this.clearStatus();
    const name = this.newCardName().trim();
    try {
      await this.accountService.createCard(
        {
          name: this.newCardName(),
          linkedAccountId: this.newCardLinkedAccountId()!,
          limit: this.newCardLimit(),
          initialBalance: this.newCardBalance() ?? 0,
        },
        this.newCardCreateCategory()
          ? this.language.t('category.cardPayment', { name })
          : null,
      );
      this.addingCard.set(false);
      this.newCardName.set('');
      this.newCardBalance.set(null);
      this.newCardLimit.set(null);
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(errorCopy(e, this.language.translateFn, 'settings.failedAddCard'));
    }
  }

  currencyForAccount(id: number | null): string {
    if (id == null) return '';
    return this.accounts().find((a) => a.id === id)?.currency ?? '';
  }

  accountNameFor(id: number | undefined): string {
    if (id == null) return '';
    return this.accounts().find((a) => a.id === id)?.name ?? '';
  }

  startEditCard(id: number): void {
    const card = this.cards().find((c) => c.id === id);
    if (!card) return;
    this.editingAccount.set(null);
    this.editingCategory.set(null);
    this.editingCard.set({
      id,
      name: card.name,
      initialBalance: card.initialBalance,
      limit: card.limit ?? null,
      linkedAccountId: card.linkedAccountId ?? this.accounts()[0]?.id ?? 0,
    });
    this.editError.set('');
  }

  editCardName(value: string): void {
    this.editingCard.update((c) => (c ? { ...c, name: value } : c));
  }

  editCardBalance(value: number): void {
    this.editingCard.update((c) => (c ? { ...c, initialBalance: value } : c));
  }

  editCardLimit(value: number | null): void {
    this.editingCard.update((c) => (c ? { ...c, limit: value } : c));
  }

  editCardLinkedAccount(value: number): void {
    this.editingCard.update((c) => (c ? { ...c, linkedAccountId: value } : c));
  }

  cancelEditCard(): void {
    const id = this.editingCard()?.id;
    this.editingCard.set(null);
    this.editError.set('');
    if (id !== undefined) this.returnToPencil({ kind: 'card', id });
  }

  async saveCardEdit(): Promise<void> {
    const editing = this.editingCard();
    if (!editing) return;
    try {
      await this.accountService.update(editing.id, {
        name: editing.name,
        initialBalance: editing.initialBalance,
        limit: editing.limit,
        linkedAccountId: editing.linkedAccountId,
      });
      this.editingCard.set(null);
      this.editError.set('');
      await this.refresh();
      this.returnToPencil({ kind: 'card', id: editing.id });
    } catch (e: unknown) {
      this.editError.set(errorCopy(e, this.language.translateFn, 'settings.failedSaveCard'));
    }
  }

  async requestDeleteCard(id: number): Promise<void> {
    this.confirmingAccountDelete.set(null);
    this.refusedAccount.set(null);
    this.refusedCategory.set(null);
    this.confirmingCardDelete.set(null);
    this.refusedCard.set(null);
    if (await this.accountService.hasMovements(id)) {
      this.refusedCard.set(id);
    } else {
      this.confirmingCardDelete.set(id);
    }
  }

  cancelDeleteCard(): void {
    this.confirmingCardDelete.set(null);
  }

  cancelRefuseCard(): void {
    this.refusedCard.set(null);
  }

  async confirmDeleteCard(): Promise<void> {
    const id = this.confirmingCardDelete();
    if (id === null) return;
    this.confirmingCardDelete.set(null);
    try {
      await this.accountService.delete(id);
    } catch (e: unknown) {
      if (e instanceof TranslationError && e.key === 'errors.accountHasMovements') {
        this.refusedCard.set(id);
        return;
      }
      throw e;
    }
    await this.refresh();
  }

  async deactivateCardInstead(id: number): Promise<void> {
    this.refusedCard.set(null);
    await this.accountService.setActive(id, false);
    await this.refresh();
  }

  async reactivateCard(id: number): Promise<void> {
    await this.accountService.setActive(id, true);
    await this.refresh();
  }

  startAddCategory(): void {
    this.newCategoryName.set('');
    this.newCategoryType.set('expense');
    this.clearStatus();
    this.addingCategory.set(true);
  }

  cancelAddCategory(): void {
    this.addingCategory.set(false);
    this.clearStatus();
  }

  async addCategory(): Promise<void> {
    this.clearStatus();
    try {
      await this.categoryService.create(this.newCategoryName(), this.newCategoryType());
      this.addingCategory.set(false);
      this.newCategoryName.set('');
      await this.refresh();
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(e, this.language.translateFn, 'settings.failedAddCategory'),
      );
    }
  }

  async requestDeleteCategory(id: number): Promise<void> {
    this.confirmingAccountDelete.set(null);
    this.refusedAccount.set(null);
    this.confirmingCategoryDelete.set(null);
    this.refusedCategory.set(null);
    if (await this.categoryService.hasMovements(id)) {
      this.refusedCategory.set(id);
    } else {
      this.confirmingCategoryDelete.set(id);
    }
  }

  cancelDeleteCategory(): void {
    this.confirmingCategoryDelete.set(null);
  }

  cancelRefuseCategory(): void {
    this.refusedCategory.set(null);
  }

  async confirmDeleteCategory(): Promise<void> {
    const id = this.confirmingCategoryDelete();
    if (id === null) return;
    this.confirmingCategoryDelete.set(null);
    try {
      await this.categoryService.delete(id);
    } catch (e: unknown) {
      if (e instanceof TranslationError && e.key === 'errors.categoryHasMovements') {
        this.refusedCategory.set(id);
        return;
      }
      throw e;
    }
    await this.refresh();
  }

  async deactivateCategoryInstead(id: number): Promise<void> {
    this.refusedCategory.set(null);
    await this.categoryService.setActive(id, false);
    await this.refresh();
  }

  async reactivateCategory(id: number): Promise<void> {
    await this.categoryService.setActive(id, true);
    await this.refresh();
  }

  /* After the edit state collapses, hand focus back to the pencil that
     opened it. Runs on a macrotask so the pencil element is back in the
     DOM before it is focused. */
  private returnToPencil(target: PencilTarget): void {
    setTimeout(() => {
      this.host.nativeElement
        .querySelector<HTMLButtonElement>(`[data-edit-pencil="${target.kind}-${target.id}"]`)
        ?.focus();
    });
  }

  private clearStatus(): void {
    this.statusEpoch.update((n) => n + 1);
    this.errorMessage.set('');
  }
}
