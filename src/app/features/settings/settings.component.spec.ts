import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { LanguageService } from '../../core/services/language.service';
import { db } from '../../core/db/database';

describe('SettingsComponent - inline editing', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    const category = await categoryService.create('Food', 'expense');
    categoryId = category.id!;
    await component.ngOnInit();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should start editing account initialBalance', () => {
    component.startEditAccountBalance(accountId, 100000);
    expect(component.editingAccountBalance()).toEqual({ id: accountId, value: 100000 });
  });

  it('should cancel editing account initialBalance', () => {
    component.startEditAccountBalance(accountId, 100000);
    component.cancelEditAccountBalance();
    expect(component.editingAccountBalance()).toBeNull();
  });

  it('should save account initialBalance', async () => {
    component.startEditAccountBalance(accountId, 100000);
    component.editingAccountBalance.set({ id: accountId, value: 200000 });
    await component.saveAccountBalance();
    expect(component.editingAccountBalance()).toBeNull();
    const updated = await accountService.getById(accountId);
    expect(updated?.initialBalance).toBe(200000);
  });

  it('should validate account initialBalance is not negative', async () => {
    component.startEditAccountBalance(accountId, 100000);
    component.editingAccountBalance.set({ id: accountId, value: -100 });
    await component.saveAccountBalance();
    expect(component.errorMessage()).toContain('cannot be negative');
    expect(component.editingAccountBalance()).not.toBeNull();
  });

  it('should start editing account name', () => {
    component.startEditAccountName(accountId, 'Cash');
    expect(component.editingAccountName()).toEqual({ id: accountId, value: 'Cash' });
  });

  it('should cancel editing account name', () => {
    component.startEditAccountName(accountId, 'Cash');
    component.cancelEditAccountName();
    expect(component.editingAccountName()).toBeNull();
  });

  it('should save account name', async () => {
    component.startEditAccountName(accountId, 'Cash');
    component.editingAccountName.set({ id: accountId, value: 'Wallet' });
    await component.saveAccountName();
    expect(component.editingAccountName()).toBeNull();
    const updated = await accountService.getById(accountId);
    expect(updated?.name).toBe('Wallet');
  });

  it('should validate account name is required', async () => {
    component.startEditAccountName(accountId, 'Cash');
    component.editingAccountName.set({ id: accountId, value: '' });
    await component.saveAccountName();
    expect(component.errorMessage()).toContain('required');
    expect(component.editingAccountName()).not.toBeNull();
  });

  it('should validate account name is unique', async () => {
    await accountService.create('Bank', 'EUR', 0);
    component.startEditAccountName(accountId, 'Cash');
    component.editingAccountName.set({ id: accountId, value: 'Bank' });
    await component.saveAccountName();
    expect(component.errorMessage()).toContain('unique');
    expect(component.editingAccountName()).not.toBeNull();
  });

  it('should start editing category name', () => {
    component.startEditCategoryName(categoryId, 'Food');
    expect(component.editingCategoryName()).toEqual({ id: categoryId, value: 'Food' });
  });

  it('should cancel editing category name', () => {
    component.startEditCategoryName(categoryId, 'Food');
    component.cancelEditCategoryName();
    expect(component.editingCategoryName()).toBeNull();
  });

  it('should save category name', async () => {
    component.startEditCategoryName(categoryId, 'Food');
    component.editingCategoryName.set({ id: categoryId, value: 'Groceries' });
    await component.saveCategoryName();
    expect(component.editingCategoryName()).toBeNull();
    const updated = await categoryService.getById(categoryId);
    expect(updated?.name).toBe('Groceries');
  });

  it('should validate category name is required', async () => {
    component.startEditCategoryName(categoryId, 'Food');
    component.editingCategoryName.set({ id: categoryId, value: '' });
    await component.saveCategoryName();
    expect(component.errorMessage()).toContain('required');
    expect(component.editingCategoryName()).not.toBeNull();
  });

  it('should validate category name is unique', async () => {
    await categoryService.create('Transport', 'expense');
    component.startEditCategoryName(categoryId, 'Food');
    component.editingCategoryName.set({ id: categoryId, value: 'Transport' });
    await component.saveCategoryName();
    expect(component.errorMessage()).toContain('unique');
    expect(component.editingCategoryName()).not.toBeNull();
  });
});

describe('SettingsComponent - account deactivation confirmation', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let accountId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    await component.ngOnInit();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should set and clear the deactivation confirmation target', () => {
    component.requestDeactivate(accountId);
    expect(component.confirmingDeactivate()).toBe(accountId);

    component.cancelDeactivate();
    expect(component.confirmingDeactivate()).toBeNull();
  });

  it('should not deactivate an account until confirmed', async () => {
    component.requestDeactivate(accountId);
    component.cancelDeactivate();

    const account = await accountService.getById(accountId);
    expect(account?.active).toBe(true);
  });

  it('should deactivate an account only after confirming', async () => {
    component.requestDeactivate(accountId);
    await component.confirmDeactivate();

    const account = await accountService.getById(accountId);
    expect(account?.active).toBe(false);
    expect(component.confirmingDeactivate()).toBeNull();
  });

  it('should do nothing when confirming with no target', async () => {
    await component.confirmDeactivate();
    const account = await accountService.getById(accountId);
    expect(account?.active).toBe(true);
  });
});

describe('SettingsComponent - category deactivation confirmation', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let categoryService: CategoryService;
  let categoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    categoryService = TestBed.inject(CategoryService);

    const category = await categoryService.create('Food', 'expense');
    categoryId = category.id!;
    await component.ngOnInit();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should set and clear the category deactivation confirmation target', () => {
    component.requestCategoryDeactivate(categoryId);
    expect(component.confirmingCategoryDeactivate()).toBe(categoryId);

    component.cancelCategoryDeactivate();
    expect(component.confirmingCategoryDeactivate()).toBeNull();
  });

  it('should not deactivate a category until confirmed', async () => {
    component.requestCategoryDeactivate(categoryId);
    component.cancelCategoryDeactivate();

    const category = await categoryService.getById(categoryId);
    expect(category?.active).toBe(true);
  });

  it('should deactivate a category only after confirming', async () => {
    component.requestCategoryDeactivate(categoryId);
    await component.confirmCategoryDeactivate();

    const category = await categoryService.getById(categoryId);
    expect(category?.active).toBe(false);
    expect(component.confirmingCategoryDeactivate()).toBeNull();
  });

  it('should do nothing when confirming a category with no target', async () => {
    await component.confirmCategoryDeactivate();
    const category = await categoryService.getById(categoryId);
    expect(category?.active).toBe(true);
  });
});

describe('SettingsComponent - no tag affordances', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);

    await accountService.create('Cash', 'EUR', 100000);
    await categoryService.create('Food', 'expense');
    await component.ngOnInit();
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('renders no Tags card among the settings cards', () => {
    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>,
    ).map((h) => h.textContent!.trim());
    expect(headings).not.toContain('Tags');
  });

  it('renders no tag management controls', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('Rename');
    expect(text).not.toContain('Delete');
    expect(text).not.toContain('No tags yet');
    expect(text).not.toContain('transaction(s)?');
  });

  it('renders no tag list markup', () => {
    const el: HTMLElement = fixture.nativeElement;
    for (const cls of ['tag-list', 'tag-name', 'tag-count', 'tag-delete-confirm']) {
      expect(el.querySelectorAll(`.${cls}`).length).toBe(0);
    }
  });

  it('exposes no tag rename/delete/count flows', () => {
    const api = component as unknown as Record<string, unknown>;
    for (const member of [
      'tagCounts',
      'editingTag',
      'startEditTag',
      'saveTagRename',
      'cancelEditTag',
      'tagToDelete',
      'confirmDeleteTag',
      'deleteTag',
      'cancelDeleteTag',
    ]) {
      expect(api[member]).toBeUndefined();
    }
  });
});

describe('SettingsComponent - LedgerFlow restyle', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let incomeCategoryId: number;
  let expenseCategoryId: number;

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    const income = await categoryService.create('Salary', 'income');
    incomeCategoryId = income.id!;
    const expense = await categoryService.create('Food', 'expense');
    expenseCategoryId = expense.id!;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  function rowFor(selector: string, name: string): HTMLElement {
    const rows = Array.from(
      fixture.nativeElement.querySelectorAll(selector) as NodeListOf<HTMLElement>,
    );
    return rows.find((r) => r.textContent!.includes(name))!;
  }

  it('renders the cards in a single top-to-bottom flow', () => {
    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>,
    ).map((h) => h.textContent!.trim());
    expect(headings).toEqual(['Base Currency', 'Language', 'Accounts', 'Categories', 'Backup']);

    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('Save Changes');
    expect(text).not.toContain('Danger Zone');
    expect(text).not.toContain('Wipe Data');
  });

  it('places Base Currency and Language side by side in the top row', () => {
    const topRow = fixture.nativeElement.querySelector('.settings-top-row') as HTMLElement;
    expect(topRow).toBeTruthy();
    expect(topRow.textContent).toContain('Base Currency');
    expect(topRow.querySelector('app-language-card')).toBeTruthy();
  });

  it('edits the account name by clicking it, with no pencil icon', async () => {
    const row = rowFor('.account-row', 'Cash');
    expect(row.querySelector('.account-edit')).toBeNull();

    const name = row.querySelector('.account-name') as HTMLButtonElement;
    name.click();
    fixture.detectChanges();
    expect(component.editingAccountName()).toEqual({ id: accountId, value: 'Cash' });

    component.editingAccountName.set({ id: accountId, value: 'Wallet' });
    await component.saveAccountName();
    const updated = await accountService.getById(accountId);
    expect(updated?.name).toBe('Wallet');
  });

  it('keeps the opening balance click-to-edit', async () => {
    const row = rowFor('.account-row', 'Cash');
    const balance = row.querySelector('.account-balance') as HTMLButtonElement;
    balance.click();
    fixture.detectChanges();
    expect(component.editingAccountBalance()).toEqual({ id: accountId, value: 100000 });
  });

  it('deactivates an account via an X icon that swaps to tick/X confirmation with no text', async () => {
    const row = rowFor('.account-row', 'Cash');
    const deactivate = row.querySelector(
      'button[aria-label="Deactivate account"]',
    ) as HTMLButtonElement;
    expect(deactivate).toBeTruthy();
    expect(deactivate.textContent!.trim()).toBe('');

    deactivate.click();
    fixture.detectChanges();

    const confirm = row.querySelector(
      'button[aria-label="Confirm deactivation"]',
    ) as HTMLButtonElement;
    const cancel = row.querySelector(
      'button[aria-label="Cancel deactivation"]',
    ) as HTMLButtonElement;
    expect(confirm).toBeTruthy();
    expect(confirm.textContent!.trim()).toBe('');
    expect(cancel).toBeTruthy();

    const side = row.querySelector('.account-side') as HTMLElement;
    const visibleButtons = Array.from(
      side.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).map((b) => b.textContent!.trim());
    expect(visibleButtons.every((t) => t === '')).toBe(true);

    const live = row.querySelector('.visually-hidden[aria-live="polite"]') as HTMLElement;
    expect(live).toBeTruthy();
    expect(live.textContent).toBeTruthy();

    confirm.click();
    await flush();

    const updated = await accountService.getById(accountId);
    expect(updated?.active).toBe(false);
  });

  it('keeps the account active when the confirmation is cancelled', async () => {
    const row = rowFor('.account-row', 'Cash');
    (row.querySelector('button[aria-label="Deactivate account"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (row.querySelector('button[aria-label="Cancel deactivation"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const account = await accountService.getById(accountId);
    expect(account?.active).toBe(true);
  });

  it('offers a textual Reactivate button on inactive accounts', async () => {
    await accountService.setActive(accountId, false);
    await component.refresh();
    fixture.detectChanges();

    const row = rowFor('.account-row', 'Cash');
    expect(row.classList.contains('inactive')).toBe(true);
    const reactivate = Array.from(row.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (b) => b.textContent!.trim() === 'Reactivate',
    )!;
    expect(reactivate).toBeTruthy();

    reactivate.click();
    await flush();

    const updated = await accountService.getById(accountId);
    expect(updated?.active).toBe(true);
  });

  it('renders one category per row with a green/red type stripe', () => {
    const incomeRow = rowFor('.category-row', 'Salary');
    const expenseRow = rowFor('.category-row', 'Food');
    expect(incomeRow.classList.contains('stripe-income')).toBe(true);
    expect(expenseRow.classList.contains('stripe-expense')).toBe(true);
  });

  it('deactivates a category via an X icon that swaps to tick/X confirmation', async () => {
    const row = rowFor('.category-row', 'Food');
    const deactivate = row.querySelector(
      'button[aria-label="Deactivate category"]',
    ) as HTMLButtonElement;
    expect(deactivate).toBeTruthy();

    deactivate.click();
    fixture.detectChanges();

    let updated = await categoryService.getById(expenseCategoryId);
    expect(updated?.active).toBe(true);

    const live = row.querySelector('.visually-hidden[aria-live="polite"]') as HTMLElement;
    expect(live).toBeTruthy();

    const confirm = row.querySelector(
      'button[aria-label="Confirm deactivation"]',
    ) as HTMLButtonElement;
    confirm.click();
    await flush();

    updated = await categoryService.getById(expenseCategoryId);
    expect(updated?.active).toBe(false);
  });

  it('offers a textual Reactivate button on inactive categories', async () => {
    await categoryService.setActive(expenseCategoryId, false);
    await component.refresh();
    fixture.detectChanges();

    const row = rowFor('.category-row', 'Food');
    expect(row.classList.contains('inactive')).toBe(true);
    const reactivate = Array.from(row.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (b) => b.textContent!.trim() === 'Reactivate',
    )!;
    expect(reactivate).toBeTruthy();

    reactivate.click();
    await flush();

    const updated = await categoryService.getById(expenseCategoryId);
    expect(updated?.active).toBe(true);
  });

  it('renders dashed add affordances for accounts and categories', () => {
    const dashed = Array.from(
      fixture.nativeElement.querySelectorAll('.btn.dashed') as NodeListOf<HTMLButtonElement>,
    ).map((b) => b.textContent!.trim());
    expect(dashed.length).toBe(2);
    expect(dashed[0]).toContain('Add Account');
    expect(dashed[1]).toContain('Add');
  });

  it('sizes every add-form field uniformly', () => {
    const forms = Array.from(
      fixture.nativeElement.querySelectorAll('.inline-form') as NodeListOf<HTMLElement>,
    );
    expect(forms.length).toBe(2);

    for (const form of forms) {
      const fields = Array.from(form.querySelectorAll('.input') as NodeListOf<HTMLElement>);
      expect(fields.length).toBeGreaterThanOrEqual(2);
      for (const field of fields) {
        expect(field.classList.contains('small')).toBe(false);
      }
    }
  });
});

describe('SettingsComponent - language card', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let profileService: ProfileService;
  let languageService: LanguageService;

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    profileService = TestBed.inject(ProfileService);
    languageService = TestBed.inject(LanguageService);
    await profileService.completeOnboarding('EUR', 'en');
    await languageService.init();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  function languageSelect(): HTMLSelectElement {
    return fixture.nativeElement.querySelector('select[aria-label="Language"]');
  }

  function languageUpdateButton(): HTMLButtonElement {
    const card = fixture.nativeElement.querySelector('app-language-card');
    return Array.from(card.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (b) => b.textContent!.trim() === 'Update',
    )!;
  }

  it('renders a Language card offering both languages in their own language', () => {
    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>,
    ).map((h) => h.textContent!.trim());
    expect(headings).toContain('Language');

    const options = Array.from(languageSelect().options).map((o) => o.textContent!.trim());
    expect(options).toEqual(['English', 'Español']);
    expect(languageSelect().value).toBe('en');
  });

  it('switches to Spanish only after clicking Update, without reload', async () => {
    languageSelect().value = 'es';
    languageSelect().dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(languageService.activeLanguage()).toBe('en');
    expect((await profileService.get())!.language).toBe('en');

    const updateButton = languageUpdateButton();
    updateButton!.click();
    await flush();
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('h1');
    expect(title.textContent!.trim()).toBe('Ajustes');
    expect(languageService.activeLanguage()).toBe('es');
    expect(document.documentElement.getAttribute('lang')).toBe('es');
    expect((await profileService.get())!.language).toBe('es');
  });

  it('keeps the choice across reloads', async () => {
    languageSelect().value = 'es';
    languageSelect().dispatchEvent(new Event('change'));
    const updateButton = languageUpdateButton();
    updateButton!.click();
    await flush();

    await languageService.init();

    expect(languageService.activeLanguage()).toBe('es');
  });

  it('brings the language card success note back after dismissal on the next save', async () => {
    const select = languageSelect();
    const updateButton = languageUpdateButton();
    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    updateButton.click();
    await flush();
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('app-language-card');
    const alert = card.querySelector('.alert') as HTMLElement;
    expect(alert).toBeTruthy();

    (alert.querySelector('.alert-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(card.querySelector('.alert')).toBeNull();

    select.value = 'en';
    select.dispatchEvent(new Event('change'));
    updateButton.click();
    await flush();
    fixture.detectChanges();
    expect(card.querySelector('.alert')).toBeTruthy();
  });
});

describe('SettingsComponent - dismissible alerts', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let accountId: number;

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    accountService = TestBed.inject(AccountService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  function errorAlert(): HTMLElement {
    return fixture.nativeElement.querySelector('app-dismissible-alert[role="alert"] .alert');
  }

  function successAlert(): HTMLElement {
    return fixture.nativeElement.querySelector('app-dismissible-alert[role="status"] .alert');
  }

  function dismissOf(alert: HTMLElement): HTMLButtonElement {
    return alert.querySelector('.alert-dismiss') as HTMLButtonElement;
  }

  it('renders the error strip with an icon-only dismiss button', async () => {
    component.startEditAccountName(accountId, 'Cash');
    component.editingAccountName.set({ id: accountId, value: '' });
    await component.saveAccountName();
    fixture.detectChanges();

    const alert = errorAlert();
    expect(alert).toBeTruthy();
    const dismiss = dismissOf(alert);
    expect(dismiss.querySelector('svg')).toBeTruthy();
    expect(dismiss.textContent!.trim()).toBe('');
    expect(dismiss.getAttribute('aria-label')).toBeTruthy();
  });

  it('hides the error strip when dismissed and brings it back on the next failure', async () => {
    component.startEditAccountName(accountId, 'Cash');
    component.editingAccountName.set({ id: accountId, value: '' });
    await component.saveAccountName();
    fixture.detectChanges();
    expect(errorAlert()).toBeTruthy();

    dismissOf(errorAlert()).click();
    fixture.detectChanges();
    expect(errorAlert()).toBeNull();

    component.startEditAccountBalance(accountId, -100);
    await component.saveAccountBalance();
    fixture.detectChanges();
    expect(errorAlert()).toBeTruthy();
  });

  it('dismisses the success strip', async () => {
    component.startEditAccountName(accountId, 'Cash');
    component.editingAccountName.set({ id: accountId, value: 'Wallet' });
    await component.saveAccountName();
    fixture.detectChanges();
    expect(successAlert()).toBeTruthy();

    dismissOf(successAlert()).click();
    fixture.detectChanges();
    expect(successAlert()).toBeNull();
  });
});
