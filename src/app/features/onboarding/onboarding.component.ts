import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { DriveBackupService } from '../../core/services/drive-backup.service';
import { LanguageService } from '../../core/services/language.service';
import { NoBackupFoundError } from '../../backup/drive-backup-provider';
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from '../../core/constants/currencies';
import { CategoryType, isCategoryType } from '../../core/models/category.model';
import { isLanguage, LANGUAGES, detectBrowserLanguage, Language } from '../../core/types/language.type';
import { DismissibleAlertComponent } from '../../shared/components/dismissible-alert/dismissible-alert.component';
import { errorCopy, TranslationError } from '../../core/models/translation-error';

const STEPS = ['language', 'restore', 'currency', 'accounts', 'categories'] as const;

type Step = (typeof STEPS)[number];

const FEATURED_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY'] as const;

interface EditableCategory {
  name: string;
  type: CategoryType;
  defaultKey?: string;
}

interface AccountEditState {
  index: number;
  name: string;
  balance: number;
}

interface CategoryEditState {
  index: number;
  name: string;
  type: CategoryType;
}

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule, DismissibleAlertComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  private profileService = inject(ProfileService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private driveBackupService = inject(DriveBackupService);
  languageService = inject(LanguageService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  supportedCurrencies = SUPPORTED_CURRENCIES;
  languages = LANGUAGES;
  steps = STEPS;
  step = signal<Step>('language');
  statusEpoch = signal(0);
  stepIndex = computed(() => STEPS.indexOf(this.step()));
  currencyQuery = signal('');
  filteredCurrencies = computed(() => this.matchingCurrencies(this.currencyQuery()));
  language = signal(detectBrowserLanguage());
  isRestoring = signal(false);
  infoMessage = signal('');
  backupMethod = this.driveBackupService.method;
  baseCurrency = signal('EUR');
  accountName = signal('');
  accountCurrency = signal('EUR');
  accountBalance = signal(0);
  accounts = signal<{ name: string; currency: string; balance: number }[]>([]);
  editingAccount = signal<AccountEditState | null>(null);
  addingAccount = signal(false);
  confirmingRemove = signal<number | null>(null);
  editError = signal('');
  categories = signal<EditableCategory[]>(
    CategoryService.defaultCategories(detectBrowserLanguage()).map(c => ({
      name: c.name,
      type: c.type,
      defaultKey: c.key,
    })),
  );
  errorMessage = signal('');
  newCategoryName = signal('');
  newCategoryType = signal<CategoryType>('expense');
  editingCategory = signal<CategoryEditState | null>(null);
  addingCategory = signal(false);
  confirmingCategoryRemove = signal<number | null>(null);
  confirmingDeleteAll = signal(false);
  categoryEditError = signal('');
  accountNameInput = viewChild<ElementRef<HTMLInputElement>>('accountNameInput');
  categoryNameInput = viewChild<ElementRef<HTMLInputElement>>('categoryNameInput');
  newAccountNameInput = viewChild<ElementRef<HTMLInputElement>>('newAccountNameInput');
  newCategoryNameInput = viewChild<ElementRef<HTMLInputElement>>('newCategoryNameInput');

  /* On open, focus the first input of the expanded edit state or of the
     New-button-revealed add form — the same grammar as the Settings accounts
     and categories cards. */
  private focusEditState = effect(() => {
    if (this.editingAccount()) {
      this.accountNameInput()?.nativeElement.focus();
    }
    if (this.editingCategory()) {
      this.categoryNameInput()?.nativeElement.focus();
    }
    if (this.addingAccount()) {
      this.newAccountNameInput()?.nativeElement.focus();
    }
    if (this.addingCategory()) {
      this.newCategoryNameInput()?.nativeElement.focus();
    }
  });

  goTo(step: Step): void {
    this.step.set(step);
  }

  stepNumber(step: Step): number {
    return STEPS.indexOf(step) + 1;
  }

  currencySymbol(code: string): string {
    return CURRENCY_SYMBOLS[code as keyof typeof CURRENCY_SYMBOLS] ?? code;
  }

  currencyName(code: string): string {
    try {
      return (
        this.currencyDisplayNames().of(code) ?? code
      );
    } catch {
      return code;
    }
  }

  private currencyDisplayNames(): Intl.DisplayNames {
    const language = this.languageService.activeLanguage();
    if (!this.displayNames || this.displayNames.language !== language) {
      this.displayNames = {
        language,
        names: new Intl.DisplayNames([language], { type: 'currency' }),
      };
    }
    return this.displayNames.names;
  }

  private displayNames?: { language: Language; names: Intl.DisplayNames };

  private matchingCurrencies(query: string): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...FEATURED_CURRENCIES];
    return SUPPORTED_CURRENCIES.filter(
      c => c.toLowerCase().includes(q) || this.currencyName(c).toLowerCase().includes(q),
    );
  }

  async onLanguageChange(value: string): Promise<void> {
    if (!isLanguage(value)) return;
    this.language.set(value);
    this.refreshDefaultCategoryNames(value);
    await this.languageService.setLanguage(value);
  }

  private refreshDefaultCategoryNames(language: Language): void {
    this.categories.update(cats =>
      cats.map(c =>
        c.defaultKey
          ? { ...c, name: CategoryService.defaultCategoryName(c.defaultKey, language) }
          : c,
      ),
    );
  }

  startFresh(): void {
    this.errorMessage.set('');
    this.infoMessage.set('');
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
    this.resetError();
    this.infoMessage.set('');

    try {
      await action();
      this.router.navigate(['/movements']);
    } catch (e: unknown) {
      if (e instanceof NoBackupFoundError) {
        this.infoMessage.set(this.languageService.t('onboarding.restore.noBackupFound'));
      } else if (e instanceof TranslationError && e.key.startsWith('backup.error.oauth.')) {
        this.infoMessage.set(this.languageService.t(e.key));
      } else {
        this.errorMessage.set(
          errorCopy(
            e,
            this.languageService.translateFn,
            'backup.error.restoreFailed',
          ),
        );
      }
    } finally {
      this.isRestoring.set(false);
    }
  }

  private resetError(): void {
    this.statusEpoch.update((n) => n + 1);
    this.errorMessage.set('');
  }

  /* Creation lives behind a New button, like the Settings cards: the reveal
     resets the draft so every open starts from a fresh form; saving or
     cancelling hides it. Nothing is persisted until Onboarding completes. */
  startAddAccount(): void {
    this.accountName.set('');
    this.accountCurrency.set('EUR');
    this.accountBalance.set(0);
    this.resetError();
    this.addingAccount.set(true);
  }

  cancelAddAccount(): void {
    this.addingAccount.set(false);
    this.resetError();
  }

  addAccount(): void {
    this.resetError();
    if (!this.accountName()) {
      this.errorMessage.set(this.languageService.t('errors.accountNameRequired'));
      return;
    }
    const exists = this.accounts().some(
      a => a.name.toLowerCase() === this.accountName().toLowerCase(),
    );
    if (exists) {
      this.errorMessage.set(
        this.languageService.t('errors.accountNameTaken', { name: this.accountName() }),
      );
      return;
    }
    if (this.accountBalance() < 0) {
      this.errorMessage.set(this.languageService.t('errors.initialBalanceNegative'));
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
    this.addingAccount.set(false);
    this.errorMessage.set('');
  }

  /* Staged rows adopt the Settings accounts-card edit grammar (#141):
     pencil opens an expanded edit state, tick saves, X discards. */
  startEditAccount(index: number): void {
    const account = this.accounts()[index];
    if (!account) return;
    this.confirmingRemove.set(null);
    this.editingAccount.set({
      index,
      name: account.name,
      balance: account.balance,
    });
    this.editError.set('');
  }

  editAccountName(value: string): void {
    this.editingAccount.update((e) => (e ? { ...e, name: value } : e));
  }

  editAccountBalance(value: number): void {
    this.editingAccount.update((e) => (e ? { ...e, balance: value } : e));
  }

  cancelEditAccount(): void {
    const index = this.editingAccount()?.index;
    this.editingAccount.set(null);
    this.editError.set('');
    if (index !== undefined) this.returnToPencil(`account-${index}`);
  }

  saveAccountEdit(): void {
    const editing = this.editingAccount();
    if (!editing) return;
    if (!editing.name.trim()) {
      this.editError.set(this.languageService.t('errors.accountNameRequired'));
      return;
    }
    const taken = this.accounts().some(
      (a, i) => i !== editing.index && a.name.toLowerCase() === editing.name.toLowerCase(),
    );
    if (taken) {
      this.editError.set(
        this.languageService.t('errors.accountNameTaken', { name: editing.name }),
      );
      return;
    }
    if (editing.balance < 0) {
      this.editError.set(this.languageService.t('errors.initialBalanceNegative'));
      return;
    }
    this.accounts.update(accs =>
      accs.map((a, i) =>
        i === editing.index
          ? { name: editing.name, currency: a.currency, balance: editing.balance }
          : a,
      ),
    );
    this.editingAccount.set(null);
    this.editError.set('');
    this.returnToPencil(`account-${editing.index}`);
  }

  /* Removal swaps the X into an inline tick/X confirm — no confirm-less
     deletes (#141). Requesting a removal also discards any open edit, so
     only one staged row state is ever active, like the Settings card. */
  requestRemove(index: number): void {
    this.editingAccount.set(null);
    this.editError.set('');
    this.confirmingRemove.set(index);
  }

  cancelRemove(): void {
    this.confirmingRemove.set(null);
  }

  confirmRemove(index: number): void {
    this.accounts.update(accs => accs.filter((_, i) => i !== index));
    this.confirmingRemove.set(null);
  }

  /* After the edit state collapses, hand focus back to the pencil that
     opened it — the Settings accounts-card grammar. Runs on a macrotask so
     the pencil element is back in the DOM before it is focused. */
  private returnToPencil(key: string): void {
    setTimeout(() => {
      this.host.nativeElement
        .querySelector<HTMLButtonElement>(`[data-edit-pencil="${key}"]`)
        ?.focus();
    });
  }

  /* New rows come from the New-button-revealed inline add form — name plus
     type — validated before staging, the Settings categories-card grammar
     (#142). The reveal resets the draft; saving or cancelling hides it. A
     pending Delete all confirm disarms: the list it was about to clear just
     grew (#143). */
  startAddCategory(): void {
    this.newCategoryName.set('');
    this.newCategoryType.set('expense');
    this.resetError();
    this.addingCategory.set(true);
  }

  cancelAddCategory(): void {
    this.addingCategory.set(false);
    this.resetError();
  }

  addCategory(): void {
    this.resetError();
    const name = this.newCategoryName().trim();
    if (!name) {
      this.errorMessage.set(this.languageService.t('errors.categoryNameRequired'));
      return;
    }
    const exists = this.categories().some(
      c => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      this.errorMessage.set(
        this.languageService.t('errors.categoryNameTaken', { name }),
      );
      return;
    }
    this.categories.update(cats => [...cats, { name, type: this.newCategoryType() }]);
    this.newCategoryName.set('');
    this.addingCategory.set(false);
    this.confirmingDeleteAll.set(false);
    this.errorMessage.set('');
  }

  /* Staged rows adopt the Settings categories-card edit grammar (#142):
     pencil opens an expanded edit state, tick saves, X discards. Renaming a
     default category detaches it from the seeded defaults so a later
     language change no longer rewrites its name. */
  /* Only one staged category state is ever active — an open edit, a row
     removal confirm, or the Delete all confirm (#142, #143). Requesting one
     discards the others, like the Settings card. */
  private clearStagedCategoryState(): void {
    this.editingCategory.set(null);
    this.categoryEditError.set('');
    this.confirmingCategoryRemove.set(null);
    this.confirmingDeleteAll.set(false);
  }

  startEditCategory(index: number): void {
    const category = this.categories()[index];
    if (!category) return;
    this.clearStagedCategoryState();
    this.editingCategory.set({ index, name: category.name, type: category.type });
  }

  editCategoryName(value: string): void {
    this.editingCategory.update((c) => (c ? { ...c, name: value } : c));
  }

  editCategoryType(value: string): void {
    if (!isCategoryType(value)) return;
    this.editingCategory.update((c) => (c ? { ...c, type: value } : c));
  }

  cancelEditCategory(): void {
    const index = this.editingCategory()?.index;
    this.editingCategory.set(null);
    this.categoryEditError.set('');
    if (index !== undefined) this.returnToPencil(`category-${index}`);
  }

  saveCategoryEdit(): void {
    const editing = this.editingCategory();
    if (!editing) return;
    if (!editing.name.trim()) {
      this.categoryEditError.set(this.languageService.t('errors.categoryNameRequired'));
      return;
    }
    const taken = this.categories().some(
      (c, i) =>
        i !== editing.index && c.name.toLowerCase() === editing.name.trim().toLowerCase(),
    );
    if (taken) {
      this.categoryEditError.set(
        this.languageService.t('errors.categoryNameTaken', { name: editing.name.trim() }),
      );
      return;
    }
    const renamed = editing.name !== this.categories()[editing.index]?.name;
    this.categories.update(cats =>
      cats.map((c, i) => {
        if (i !== editing.index) return c;
        const next = { ...c, name: editing.name.trim(), type: editing.type };
        if (renamed) delete next.defaultKey;
        return next;
      }),
    );
    this.editingCategory.set(null);
    this.categoryEditError.set('');
    this.returnToPencil(`category-${editing.index}`);
  }

  /* Removal swaps the X into an inline tick/X confirm — no confirm-less
     deletes (#142). Requesting a removal also discards any open edit, so
     only one staged row state is ever active, like the Settings card. */
  requestRemoveCategory(index: number): void {
    this.clearStagedCategoryState();
    this.confirmingCategoryRemove.set(index);
  }

  cancelRemoveCategory(): void {
    this.confirmingCategoryRemove.set(null);
  }

  confirmRemoveCategory(index: number): void {
    this.categories.update(cats => cats.filter((_, i) => i !== index));
    this.confirmingCategoryRemove.set(null);
  }

  /* Delete all is the step's one red mass action (#143): red = mass or
     irreversible, so unlike the row X it is red at rest, behind a single
     lightweight confirm. Requesting it discards any staged row state so
     only one destructive moment is ever active. */
  requestDeleteAll(): void {
    this.clearStagedCategoryState();
    this.confirmingDeleteAll.set(true);
  }

  cancelDeleteAll(): void {
    this.confirmingDeleteAll.set(false);
  }

  confirmDeleteAll(): void {
    this.categories.set([]);
    this.confirmingDeleteAll.set(false);
  }

  /* The empty list's way back (#143): re-seed the localized defaults with
     their default keys attached, so a later Language change still rewrites
     their names. */
  restoreDefaultCategories(): void {
    this.categories.set(
      CategoryService.defaultCategories(this.language()).map(c => ({
        name: c.name,
        type: c.type,
        defaultKey: c.key,
      })),
    );
    this.clearStagedCategoryState();
    this.errorMessage.set('');
  }

  canProceedFromCategories(): boolean {
    return this.categories().length > 0;
  }

  async completeOnboarding(): Promise<void> {
    this.resetError();
    if (!this.canProceedFromCategories()) {
      this.errorMessage.set(this.languageService.t('onboarding.categories.minRequired'));
      return;
    }

    const emptyCategory = this.categories().find(c => !c.name.trim());
    if (emptyCategory) {
      this.errorMessage.set(this.languageService.t('errors.categoryNameRequired'));
      return;
    }

    try {
      await this.profileService.completeOnboarding(this.baseCurrency(), this.language());
      for (const acc of this.accounts()) {
        await this.accountService.create(acc.name, acc.currency, acc.balance);
      }
      for (const cat of this.categories()) {
        await this.categoryService.create(cat.name, cat.type);
      }
      this.router.navigate(['/movements']);
    } catch (e: unknown) {
      this.errorMessage.set(
        errorCopy(
          e,
          this.languageService.translateFn,
          'onboarding.completionFailed',
        ),
      );
    }
  }
}

