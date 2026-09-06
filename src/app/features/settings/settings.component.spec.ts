import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SettingsComponent } from './settings.component';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { LanguageService } from '../../core/services/language.service';
import { DataVersionService } from '../../core/services/data-version.service';
import { db } from '../../core/db/database';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

describe('SettingsComponent - pencil edit state (component)', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let profileService: ProfileService;
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
    profileService = TestBed.inject(ProfileService);

    await profileService.completeOnboarding('EUR', 'en');
    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    const category = await categoryService.create('Food', 'expense');
    categoryId = category.id!;
    await component.ngOnInit();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('opens the account edit state with name and initial balance', () => {
    component.startEditAccount(accountId);
    expect(component.editingAccount()).toEqual({
      id: accountId,
      name: 'Cash',
      initialBalance: 100000,
    });
    expect(component.editError()).toBe('');
  });

  it('cancels the account edit state', () => {
    component.startEditAccount(accountId);
    component.cancelEditAccount();
    expect(component.editingAccount()).toBeNull();
  });

  it('saves account name and initial balance from the single edit state', async () => {
    component.startEditAccount(accountId);
    component.editAccountName('Wallet');
    component.editAccountBalance(200000);
    await component.saveAccountEdit();

    expect(component.editingAccount()).toBeNull();
    const updated = await accountService.getById(accountId);
    expect(updated?.name).toBe('Wallet');
    expect(updated?.initialBalance).toBe(200000);
  });

  it('keeps the edit state open with an inline error for a negative balance', async () => {
    component.startEditAccount(accountId);
    component.editAccountBalance(-100);
    await component.saveAccountEdit();

    expect(component.editError()).toContain('cannot be negative');
    expect(component.editingAccount()).not.toBeNull();
    const updated = await accountService.getById(accountId);
    expect(updated?.initialBalance).toBe(100000);
  });

  it('keeps the edit state open with an inline error for a required name', async () => {
    component.startEditAccount(accountId);
    component.editAccountName('');
    await component.saveAccountEdit();

    expect(component.editError()).toContain('required');
    expect(component.editingAccount()).not.toBeNull();
  });

  it('shows a translated uniqueness error for a duplicate account name', async () => {
    await accountService.create('Bank', 'EUR', 0);
    component.startEditAccount(accountId);
    component.editAccountName('Bank');
    await component.saveAccountEdit();

    expect(component.editError()).toBe('An account named "Bank" already exists');
    expect(component.editingAccount()).not.toBeNull();
  });

  it('renders the duplicate account error in Spanish and re-renders on re-trigger', async () => {
    await accountService.create('Bank', 'EUR', 0);
    const languageService = TestBed.inject(LanguageService);

    component.startEditAccount(accountId);
    component.editAccountName('Bank');
    await component.saveAccountEdit();
    expect(component.editError()).toBe('An account named "Bank" already exists');

    await languageService.setLanguage('es');
    await component.saveAccountEdit();
    expect(component.editError()).toBe('Ya hay una cuenta llamada "Bank"');

    await languageService.setLanguage('en');
    await component.saveAccountEdit();
    expect(component.editError()).toBe('An account named "Bank" already exists');
  });

  it('renders negative balance errors in Spanish when the Language is Spanish', async () => {
    await TestBed.inject(LanguageService).setLanguage('es');
    component.startEditAccount(accountId);
    component.editAccountBalance(-100);
    await component.saveAccountEdit();
    expect(component.editError()).toBe('El saldo inicial no puede ser negativo');
  });

  it('clears the inline error when another edit is started or the edit is cancelled', async () => {
    component.startEditAccount(accountId);
    component.editAccountName('');
    await component.saveAccountEdit();
    expect(component.editError()).not.toBe('');

    component.cancelEditAccount();
    expect(component.editError()).toBe('');

    component.startEditAccount(accountId);
    expect(component.editError()).toBe('');
  });

  it('opens only one row edit at a time', () => {
    component.startEditAccount(accountId);
    component.startEditCategory(categoryId);
    expect(component.editingCategory()).toEqual({ id: categoryId, name: 'Food' });
    expect(component.editingAccount()).toBeNull();
  });

  it('opens, saves and cancels the category edit state', async () => {
    component.startEditCategory(categoryId);
    expect(component.editingCategory()).toEqual({ id: categoryId, name: 'Food' });

    component.editCategoryName('Groceries');
    await component.saveCategoryEdit();
    expect(component.editingCategory()).toBeNull();
    const updated = await categoryService.getById(categoryId);
    expect(updated?.name).toBe('Groceries');

    component.startEditCategory(categoryId);
    component.cancelEditCategory();
    expect(component.editingCategory()).toBeNull();
  });

  it('keeps the edit state open with an inline error for a required category name', async () => {
    component.startEditCategory(categoryId);
    component.editCategoryName('');
    await component.saveCategoryEdit();
    expect(component.editError()).toContain('required');
    expect(component.editingCategory()).not.toBeNull();
  });

  it('shows a translated uniqueness error for a duplicate category name', async () => {
    await categoryService.create('Transport', 'expense');
    component.startEditCategory(categoryId);
    component.editCategoryName('Transport');
    await component.saveCategoryEdit();
    expect(component.editError()).toBe('A category named "Transport" already exists');
  });

  it('edits the base currency through a draft that only persists on save', async () => {
    component.startEditBaseCurrency();
    expect(component.editingBaseCurrency()).toBe(true);
    expect(component.baseCurrencyDraft()).toBe('EUR');
    expect((await profileService.get())!.baseCurrency).toBe('EUR');

    component.editBaseCurrency('USD');
    await component.saveBaseCurrency();
    expect(component.editingBaseCurrency()).toBe(false);
    expect(component.baseCurrency()).toBe('USD');
    expect((await profileService.get())!.baseCurrency).toBe('USD');

    component.startEditBaseCurrency();
    component.editBaseCurrency('CHF');
    component.cancelEditBaseCurrency();
    expect(component.editingBaseCurrency()).toBe(false);
    expect(component.baseCurrency()).toBe('USD');
  });
});

describe('SettingsComponent - account delete-if-unused (ADR 0018)', () => {
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

  it('branches on the data: an unused account gets the inline delete confirm', async () => {
    await component.requestDeleteAccount(accountId);
    expect(component.confirmingAccountDelete()).toBe(accountId);
    expect(component.refusedAccount()).toBeNull();

    component.cancelDeleteAccount();
    expect(component.confirmingAccountDelete()).toBeNull();
  });

  it('does not delete an unused account until confirmed', async () => {
    await component.requestDeleteAccount(accountId);
    component.cancelDeleteAccount();

    expect(await accountService.getById(accountId)).toBeDefined();
  });

  it('deletes an unused account only after confirming', async () => {
    await component.requestDeleteAccount(accountId);
    await component.confirmDeleteAccount();

    expect(await accountService.getById(accountId)).toBeUndefined();
    expect(component.confirmingAccountDelete()).toBeNull();
    expect(component.accounts().some((a) => a.id === accountId)).toBe(false);
  });

  it('refuses to delete an account with movements and records the refusal target', async () => {
    await db.transactions.add({
      accountId,
      categoryId: await db.categories.add({
        name: 'Food',
        type: 'expense',
        active: true,
        createdAt: new Date(),
      }),
      amount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
      createdAt: new Date(),
    });

    await component.requestDeleteAccount(accountId);
    expect(component.refusedAccount()).toBe(accountId);
    expect(component.confirmingAccountDelete()).toBeNull();

    expect(await accountService.getById(accountId)).toBeDefined();
  });

  it('clears the refusal target on cancel', async () => {
    await component.requestDeleteAccount(accountId);
    component.cancelRefuseAccount();
    expect(component.refusedAccount()).toBeNull();
  });

  it('does nothing when confirming with no target', async () => {
    await component.confirmDeleteAccount();
    expect(await accountService.getById(accountId)).toBeDefined();
  });

  it('refuses at confirm time when movements appear after the request', async () => {
    await component.requestDeleteAccount(accountId);
    expect(component.confirmingAccountDelete()).toBe(accountId);

    const category = await db.categories.add({
      name: 'Food',
      type: 'expense',
      active: true,
      createdAt: new Date(),
    });
    await db.transactions.add({
      accountId,
      categoryId: category,
      amount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
      createdAt: new Date(),
    });

    await component.confirmDeleteAccount();
    expect(component.refusedAccount()).toBe(accountId);
    expect(await accountService.getById(accountId)).toBeDefined();
  });
});

describe('SettingsComponent - category delete-if-unused (ADR 0018)', () => {
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

  it('branches on the data: an unused category gets the inline delete confirm', async () => {
    await component.requestDeleteCategory(categoryId);
    expect(component.confirmingCategoryDelete()).toBe(categoryId);
    expect(component.refusedCategory()).toBeNull();

    component.cancelDeleteCategory();
    expect(component.confirmingCategoryDelete()).toBeNull();
  });

  it('does not delete an unused category until confirmed', async () => {
    await component.requestDeleteCategory(categoryId);
    component.cancelDeleteCategory();

    expect(await categoryService.getById(categoryId)).toBeDefined();
  });

  it('deletes an unused category only after confirming', async () => {
    await component.requestDeleteCategory(categoryId);
    await component.confirmDeleteCategory();

    expect(await categoryService.getById(categoryId)).toBeUndefined();
    expect(component.confirmingCategoryDelete()).toBeNull();
  });

  it('refuses to delete a category referenced by a transaction and records the refusal target', async () => {
    const account = await db.accounts.add({
      name: 'Cash',
      currency: 'EUR',
      initialBalance: 0,
      active: true,
      createdAt: new Date(),
    });
    await db.transactions.add({
      accountId: account,
      categoryId,
      amount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
      createdAt: new Date(),
    });

    await component.requestDeleteCategory(categoryId);
    expect(component.refusedCategory()).toBe(categoryId);
    expect(component.confirmingCategoryDelete()).toBeNull();

    expect(await categoryService.getById(categoryId)).toBeDefined();
  });

  it('does nothing when confirming with no target', async () => {
    await component.confirmDeleteCategory();
    expect(await categoryService.getById(categoryId)).toBeDefined();
  });

  it('clears the refusal target on cancel', async () => {
    await component.requestDeleteCategory(categoryId);
    component.cancelRefuseCategory();
    expect(component.refusedCategory()).toBeNull();
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

describe('SettingsComponent - edit-on-demand rows', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let categoryId: number;

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
    const category = await categoryService.create('Food', 'expense');
    categoryId = category.id!;
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

  function pencilFor(row: HTMLElement): HTMLButtonElement {
    return row.querySelector('button[data-edit-pencil]') as HTMLButtonElement;
  }

  it('displays account name, currency and balance as plain text with a pencil action', () => {
    const row = rowFor('.account-row', 'Cash');
    expect(row.querySelector('.account-name')!.textContent!.trim()).toBe('Cash');
    expect(row.querySelector('.account-meta')!.textContent).toContain('EUR');
    expect(row.querySelector('.account-meta')!.textContent).toContain('100000');

    const pencil = pencilFor(row);
    expect(pencil.getAttribute('aria-label')).toBe('Edit account');
    expect(row.querySelector('.account-name button')).toBeNull();
    expect(row.querySelector('.account-balance')).toBeNull();
  });

  it('opens the expanded account edit state from the pencil; tick saves', async () => {
    const row = rowFor('.account-row', 'Cash');
    pencilFor(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    expect(editState).toBeTruthy();
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    const balanceInput = editState.querySelector('input[type="number"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Cash');
    expect(balanceInput.value).toBe('100000');
    expect(editState.textContent).toContain('EUR');

    nameInput.value = 'Wallet';
    nameInput.dispatchEvent(new Event('input'));
    balanceInput.value = '250000';
    balanceInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (editState.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const updated = await accountService.getById(accountId);
    expect(updated?.name).toBe('Wallet');
    expect(updated?.initialBalance).toBe(250000);
    expect(row.querySelector('.edit-state')).toBeNull();
    expect(row.querySelector('.account-name')!.textContent!.trim()).toBe('Wallet');
  });

  it('discards changes from the X button without touching the service', async () => {
    const row = rowFor('.account-row', 'Cash');
    pencilFor(row).click();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Wallet';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (editState.querySelector('button[aria-label="Discard changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const updated = await accountService.getById(accountId);
    expect(updated?.name).toBe('Cash');
    expect(row.querySelector('.edit-state')).toBeNull();
  });

  it('saves on Enter and cancels on Escape', async () => {
    const row = rowFor('.account-row', 'Cash');
    pencilFor(row).click();
    fixture.detectChanges();

    let editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Wallet';
    nameInput.dispatchEvent(new Event('input'));
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await flush();
    fixture.detectChanges();
    expect((await accountService.getById(accountId))?.name).toBe('Wallet');

    pencilFor(row).click();
    fixture.detectChanges();
    editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput2 = editState.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput2.value = 'Changed';
    nameInput2.dispatchEvent(new Event('input'));
    nameInput2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    fixture.detectChanges();
    expect((await accountService.getById(accountId))?.name).toBe('Wallet');
  });

  it('moves focus to the first input on open and back to the pencil on cancel', async () => {
    const row = rowFor('.account-row', 'Cash');
    pencilFor(row).click();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    expect(document.activeElement).toBe(nameInput);

    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    fixture.detectChanges();

    const pencil = row.querySelector(
      `button[data-edit-pencil="account-${accountId}"]`,
    ) as HTMLButtonElement;
    expect(pencil).toBeTruthy();
    expect(document.activeElement).toBe(pencil);
  });

  it('renders edit-state validation errors inline, announced, without a page-level alert', async () => {
    await accountService.create('Bank', 'EUR', 0);
    fixture.detectChanges();

    const row = rowFor('.account-row', 'Cash');
    pencilFor(row).click();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Bank';
    nameInput.dispatchEvent(new Event('input'));
    (editState.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const inlineError = row.querySelector('.edit-error') as HTMLElement;
    expect(inlineError).toBeTruthy();
    expect(inlineError.getAttribute('role')).toBe('alert');
    expect(inlineError.textContent).toContain('already exists');

    const pageAlert = fixture.nativeElement.querySelector(
      'app-dismissible-alert[role="alert"] .alert',
    );
    expect(pageAlert).toBeNull();
    expect(row.querySelector('.edit-state')).toBeTruthy();
  });

  it('opens the expanded category edit state from the pencil; tick saves, X discards', async () => {
    const row = rowFor('.category-row', 'Food');
    pencilFor(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Food');

    nameInput.value = 'Groceries';
    nameInput.dispatchEvent(new Event('input'));
    (editState.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();
    expect((await categoryService.getById(categoryId))?.name).toBe('Groceries');

    pencilFor(row).click();
    fixture.detectChanges();
    const editState2 = row.querySelector('.edit-state') as HTMLElement;
    const nameInput2 = editState2.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput2.value = 'Renamed';
    nameInput2.dispatchEvent(new Event('input'));
    (editState2.querySelector('button[aria-label="Discard changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();
    expect((await categoryService.getById(categoryId))?.name).toBe('Groceries');
  });

  it('keeps the delete-if-unused confirmation grammar on account rows', async () => {
    const row = rowFor('.account-row', 'Cash');
    const remove = row.querySelector(
      'button[aria-label="Delete account"]',
    ) as HTMLButtonElement;
    expect(remove).toBeTruthy();

    remove.click();
    await flush();
    fixture.detectChanges();
    expect(row.querySelector('button[aria-label="Confirm deletion"]')).toBeTruthy();
    expect(row.querySelector('button[aria-label="Cancel deletion"]')).toBeTruthy();

    (
      row.querySelector('button[aria-label="Confirm deletion"]') as HTMLButtonElement
    ).click();
    await flush();
    fixture.detectChanges();

    expect(await accountService.getById(accountId)).toBeUndefined();
    expect(rowFor('.account-row', 'Cash')).toBeUndefined();
  });

  it('refuses to delete an account with movements with an inline explanation and Deactivate fallback', async () => {
    await db.transactions.add({
      accountId,
      categoryId,
      amount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
      createdAt: new Date(),
    });
    await component.refresh();
    fixture.detectChanges();

    const row = rowFor('.account-row', 'Cash');
    (row.querySelector('button[aria-label="Delete account"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const refusal = row.querySelector('.delete-refusal') as HTMLElement;
    expect(refusal).toBeTruthy();
    expect(refusal.getAttribute('role')).toBe('alert');
    expect(refusal.textContent).toContain('movements');
    expect(refusal.textContent).toContain("can't be deleted");
    expect(await accountService.getById(accountId)).toBeDefined();

    const fallback = Array.from(
      refusal.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent!.trim() === 'Deactivate instead')!;
    expect(fallback).toBeTruthy();
    fallback.click();
    await flush();

    expect((await accountService.getById(accountId))?.active).toBe(false);
  });

  it('closes the refusal explanation on cancel without touching the account', async () => {
    await db.transactions.add({
      accountId,
      categoryId,
      amount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
      createdAt: new Date(),
    });
    await component.refresh();
    fixture.detectChanges();

    const row = rowFor('.account-row', 'Cash');
    (row.querySelector('button[aria-label="Delete account"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();
    const refusal = row.querySelector('.delete-refusal') as HTMLElement;
    expect(refusal).toBeTruthy();

    const cancel = Array.from(
      refusal.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent!.trim() === 'Cancel')!;
    expect(cancel).toBeTruthy();
    cancel.click();
    fixture.detectChanges();

    expect(row.querySelector('.delete-refusal')).toBeNull();
    expect(await accountService.getById(accountId)).toBeDefined();
  });
});

describe('SettingsComponent - base currency card', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let profileService: ProfileService;

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    profileService = TestBed.inject(ProfileService);
    await profileService.completeOnboarding('EUR', 'en');
    await TestBed.inject(LanguageService).init();
    await component.ngOnInit();
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  function currencyCard(): HTMLElement {
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('section.card') as NodeListOf<HTMLElement>,
    );
    return cards.find((c) => c.querySelector('h2')!.textContent!.includes('Base Currency'))!;
  }

  function pencil(card: HTMLElement): HTMLButtonElement {
    return card.querySelector('button[data-edit-pencil="base-currency-0"]') as HTMLButtonElement;
  }

  it('displays the base currency value by default and keeps the neutral currency icon', () => {
    const card = currencyCard();
    expect(card.querySelector('.card-value')!.textContent).toContain('EUR');
    expect(card.querySelector('select')).toBeNull();
    expect(pencil(card).getAttribute('aria-label')).toBe('Edit base currency');
    expect(card.querySelector('h2 circle')).toBeTruthy();
    expect(card.querySelector('h2 path[stroke-linecap="round"]')).toBeTruthy();
  });

  it('reveals select with tick and X on pencil and saves on tick', async () => {
    const card = currencyCard();
    pencil(card).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const select = card.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('EUR');
    expect(card.querySelector('button[aria-label="Save changes"]')).toBeTruthy();
    expect(card.querySelector('button[aria-label="Discard changes"]')).toBeTruthy();

    select.value = 'USD';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (card.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect((await profileService.get())!.baseCurrency).toBe('USD');
    expect(card.querySelector('.card-value')!.textContent).toContain('USD');
    expect(card.querySelector('select')).toBeNull();
  });

  it('discards the base currency change on X and Escape', async () => {
    const card = currencyCard();
    pencil(card).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const select = card.querySelector('select') as HTMLSelectElement;
    select.value = 'USD';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (card.querySelector('button[aria-label="Discard changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect((await profileService.get())!.baseCurrency).toBe('EUR');
    expect(card.querySelector('select')).toBeNull();

    pencil(card).click();
    fixture.detectChanges();
    const select2 = card.querySelector('select') as HTMLSelectElement;
    select2.value = 'USD';
    select2.dispatchEvent(new Event('change'));
    select2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    fixture.detectChanges();
    expect((await profileService.get())!.baseCurrency).toBe('EUR');
    expect(card.querySelector('select')).toBeNull();
  });

  it('saves the base currency on Enter from the select', async () => {
    const card = currencyCard();
    pencil(card).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const select = card.querySelector('select') as HTMLSelectElement;
    select.value = 'USD';
    select.dispatchEvent(new Event('change'));
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await flush();
    fixture.detectChanges();

    expect((await profileService.get())!.baseCurrency).toBe('USD');
    expect(card.querySelector('select')).toBeNull();
  });

  it('renders a translated inline error when the base currency save fails', async () => {
    vi.spyOn(profileService, 'updateBaseCurrency').mockRejectedValue(new Error('boom'));

    const card = currencyCard();
    pencil(card).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const select = card.querySelector('select') as HTMLSelectElement;
    select.value = 'USD';
    select.dispatchEvent(new Event('change'));
    (card.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const inlineError = card.querySelector('.edit-error') as HTMLElement;
    expect(inlineError).toBeTruthy();
    expect(inlineError.getAttribute('role')).toBe('alert');
    expect(inlineError.textContent).toContain('Failed to save currency');
    expect(card.querySelector('select')).toBeTruthy();
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

  function languageCard(): HTMLElement {
    return fixture.nativeElement.querySelector('app-language-card') as HTMLElement;
  }

  function pencil(): HTMLButtonElement {
    return languageCard().querySelector(
      'button[data-edit-pencil="language"]',
    ) as HTMLButtonElement;
  }

  it('renders a Language card displaying the active language by default', () => {
    const card = languageCard();
    const headings = Array.from(card.querySelectorAll('h2') as NodeListOf<HTMLElement>).map((h) =>
      h.textContent!.trim(),
    );
    expect(headings).toContain('Language');
    expect(card.querySelector('.card-value')!.textContent).toContain('English');
    expect(card.querySelector('select')).toBeNull();
    expect(pencil().getAttribute('aria-label')).toBe('Edit language');
  });

  it('reveals the select on pencil and switches language only on tick', async () => {
    pencil().click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const select = languageCard().querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('en');

    const options = Array.from(select.options).map((o) => o.textContent!.trim());
    expect(options).toEqual(['English', 'Español']);

    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(languageService.activeLanguage()).toBe('en');
    (languageCard().querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect(languageService.activeLanguage()).toBe('es');
    expect((await profileService.get())!.language).toBe('es');
    expect(document.documentElement.getAttribute('lang')).toBe('es');
    expect(languageCard().querySelector('.card-value')!.textContent).toContain('Español');
    expect(languageCard().querySelector('select')).toBeNull();
  });

  it('keeps the choice across reloads', async () => {
    pencil().click();
    fixture.detectChanges();
    const select = languageCard().querySelector('select') as HTMLSelectElement;
    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    (languageCard().querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    await flush();

    await languageService.init();
    expect(languageService.activeLanguage()).toBe('es');
  });

  it('discards the language change on X and returns focus to the pencil', async () => {
    pencil().click();
    fixture.detectChanges();
    const select = languageCard().querySelector('select') as HTMLSelectElement;
    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (languageCard().querySelector('button[aria-label="Discard changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect(languageService.activeLanguage()).toBe('en');
    expect((await profileService.get())!.language).toBe('en');
    expect(languageCard().querySelector('select')).toBeNull();

    const restoredPencil = pencil();
    expect(document.activeElement).toBe(restoredPencil);
  });

  it('applies the language on Enter from the select', async () => {
    pencil().click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const select = languageCard().querySelector('select') as HTMLSelectElement;
    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await flush();
    fixture.detectChanges();

    expect(languageService.activeLanguage()).toBe('es');
    expect(languageCard().querySelector('select')).toBeNull();
  });

  it('renders a translated inline error when the language save fails', async () => {
    vi.spyOn(languageService, 'setLanguage').mockRejectedValue(new Error('boom'));

    pencil().click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const select = languageCard().querySelector('select') as HTMLSelectElement;
    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    (languageCard().querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const inlineError = languageCard().querySelector('.edit-error') as HTMLElement;
    expect(inlineError).toBeTruthy();
    expect(inlineError.getAttribute('role')).toBe('alert');
    expect(inlineError.textContent).toContain('Failed to update language');
    expect(languageService.activeLanguage()).toBe('en');
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

  function dismissOf(alert: HTMLElement): HTMLButtonElement {
    return alert.querySelector('.alert-dismiss') as HTMLButtonElement;
  }

  it('keeps the page-level error strip for add-form failures', async () => {
    component.startAddAccount();
    component.newAccountName.set('Cash');
    await component.addAccount();
    fixture.detectChanges();

    const alert = errorAlert();
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('already exists');
    const dismiss = dismissOf(alert);
    expect(dismiss.querySelector('svg')).toBeTruthy();
    expect(dismiss.textContent!.trim()).toBe('');
    expect(dismiss.getAttribute('aria-label')).toBeTruthy();
  });

  it('hides the error strip when dismissed and brings it back on the next failure', async () => {
    component.startAddAccount();
    component.newAccountName.set('Cash');
    await component.addAccount();
    fixture.detectChanges();
    expect(errorAlert()).toBeTruthy();

    dismissOf(errorAlert()).click();
    fixture.detectChanges();
    expect(errorAlert()).toBeNull();

    component.newAccountName.set('Cash');
    await component.addAccount();
    fixture.detectChanges();
    expect(errorAlert()).toBeTruthy();
  });

  it('does not render a success strip anywhere on the settings page', async () => {
    component.startEditAccount(accountId);
    component.editAccountName('Wallet');
    await component.saveAccountEdit();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('app-dismissible-alert[role="status"] .alert'),
    ).toBeNull();
  });
});

describe('SettingsComponent - LedgerFlow restyle', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
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

    await accountService.create('Cash', 'EUR', 100000);
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

  it('renders no click-to-edit or dashed-underline affordances', () => {
    expect(fixture.nativeElement.querySelectorAll('button.account-name').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('button.category-name').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.account-balance').length).toBe(0);
  });

  it('offers a textual Reactivate button on inactive accounts', async () => {
    const accountId = (await accountService.getAll())[0].id!;
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

  it('deletes an unused category after the inline confirm', async () => {
    const row = rowFor('.category-row', 'Food');
    (row.querySelector('button[aria-label="Delete category"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect(row.querySelector('button[aria-label="Confirm deletion"]')).toBeTruthy();
    (
      row.querySelector('button[aria-label="Confirm deletion"]') as HTMLButtonElement
    ).click();
    await flush();
    fixture.detectChanges();

    expect(await categoryService.getById(expenseCategoryId)).toBeUndefined();
    expect(rowFor('.category-row', 'Food')).toBeUndefined();
  });

  it('refuses to delete a used category with an inline explanation and Deactivate fallback', async () => {
    const accountId = (await accountService.getAll())[0].id!;
    await db.transactions.add({
      accountId,
      categoryId: expenseCategoryId,
      amount: 1000,
      date: new Date(),
      period: 1,
      year: 2026,
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: '',
      createdAt: new Date(),
    });
    await component.refresh();
    fixture.detectChanges();

    const row = rowFor('.category-row', 'Food');
    (row.querySelector('button[aria-label="Delete category"]') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const refusal = row.querySelector('.delete-refusal') as HTMLElement;
    expect(refusal).toBeTruthy();
    expect(refusal.getAttribute('role')).toBe('alert');
    expect(refusal.textContent).toContain('movements');
    expect(refusal.textContent).toContain("can't be deleted");
    expect((await categoryService.getById(expenseCategoryId))?.active).toBe(true);

    const fallback = Array.from(
      refusal.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent!.trim() === 'Deactivate instead')!;
    expect(fallback).toBeTruthy();
    fallback.click();
    await flush();

    expect((await categoryService.getById(expenseCategoryId))?.active).toBe(false);
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

  it('renders New buttons before reveal and dashed add affordances inside the revealed forms', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).map((b) => b.textContent!.trim());
    expect(buttons).toContain('New account');
    expect(buttons).toContain('New category');

    component.startAddAccount();
    component.startAddCategory();
    fixture.detectChanges();

    const dashed = Array.from(
      fixture.nativeElement.querySelectorAll('.btn.dashed') as NodeListOf<HTMLButtonElement>,
    ).map((b) => b.textContent!.trim());
    expect(dashed.length).toBe(2);
    expect(dashed[0]).toContain('Add Account');
    expect(dashed[1]).toContain('Add');
  });

  it('sizes every revealed add-form field uniformly', () => {
    component.startAddAccount();
    component.startAddCategory();
    fixture.detectChanges();

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

describe('SettingsComponent - New-button creation forms', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let categoryId: number;

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
    const category = await categoryService.create('Food', 'expense');
    categoryId = category.id!;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  function cardFor(title: string): HTMLElement {
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('section.card') as NodeListOf<HTMLElement>,
    );
    return cards.find((c) => c.querySelector('h2')!.textContent!.includes(title))!;
  }

  function revealForm(card: HTMLElement): void {
    const reveal = Array.from(
      card.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent!.trim() === 'New account' || b.textContent!.trim() === 'New category')!;
    reveal.click();
    fixture.detectChanges();
  }

  it('shows a New button instead of always-visible add inputs on both cards', () => {
    for (const [card, label] of [
      [cardFor('Accounts'), 'New account'],
      [cardFor('Categories'), 'New category'],
    ] as const) {
      expect(Array.from(card.querySelectorAll('button')).map((b) => b.textContent!.trim())).toContain(label);
      expect(card.querySelector('.inline-form')).toBeNull();
      expect(card.querySelector('input')).toBeNull();
    }
  });

  it('reveals the inline form when New is clicked and focuses its name input', async () => {
    const card = cardFor('Accounts');
    revealForm(card);
    await flush();
    fixture.detectChanges();

    const form = card.querySelector('.inline-form') as HTMLElement;
    expect(form).toBeTruthy();
    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    expect(nameInput.value).toBe('');
    expect(document.activeElement).toBe(nameInput);
    expect(form.textContent).toContain('Add Account');
  });

  it('hides the form again on cancel without creating anything', async () => {
    const card = cardFor('Accounts');
    revealForm(card);
    const form = card.querySelector('.inline-form') as HTMLElement;
    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Wallet';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const cancel = Array.from(
      form.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent!.trim() === 'Cancel')!;
    expect(cancel).toBeTruthy();
    cancel.click();
    await flush();
    fixture.detectChanges();

    expect(card.querySelector('.inline-form')).toBeNull();
    expect(card.querySelector('button[data-edit-pencil]')).toBeTruthy();
    expect((await accountService.getAll()).some((a) => a.name === 'Wallet')).toBe(false);
    expect(component.addingAccount()).toBe(false);
  });

  it('persists immediately through the revealed account form and hides it on save', async () => {
    const card = cardFor('Accounts');
    revealForm(card);
    const form = card.querySelector('.inline-form') as HTMLElement;
    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Wallet';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (form.querySelector('button.btn.dashed') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const created = (await accountService.getAll()).find((a) => a.name === 'Wallet');
    expect(created).toBeDefined();
    expect(created?.currency).toBe('EUR');
    expect(card.querySelector('.inline-form')).toBeNull();
    expect(component.addingAccount()).toBe(false);
  });

  it('persists immediately through the revealed category form and hides it on save', async () => {
    const card = cardFor('Categories');
    revealForm(card);
    const form = card.querySelector('.inline-form') as HTMLElement;
    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Transport';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (form.querySelector('button.btn.dashed') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    const created = (await categoryService.getAll()).find((c) => c.name === 'Transport');
    expect(created).toBeDefined();
    expect(created?.type).toBe('expense');
    expect(card.querySelector('.inline-form')).toBeNull();
    expect(component.addingCategory()).toBe(false);
  });

  it('keeps the form open when creation fails', async () => {
    const card = cardFor('Accounts');
    revealForm(card);
    const form = card.querySelector('.inline-form') as HTMLElement;
    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Cash';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (form.querySelector('button.btn.dashed') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect(card.querySelector('.inline-form')).toBeTruthy();
    expect(component.addingAccount()).toBe(true);
    expect((await accountService.getAll()).filter((a) => a.name === 'Cash').length).toBe(1);
  });

  it('starts each reveal with a fresh empty form', async () => {
    const card = cardFor('Accounts');
    revealForm(card);
    let form = card.querySelector('.inline-form') as HTMLElement;
    let nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Wallet';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (form.querySelector('button.btn.dashed') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    revealForm(card);
    await flush();
    fixture.detectChanges();
    form = card.querySelector('.inline-form') as HTMLElement;
    nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput.value).toBe('');
    expect(component.newAccountName()).toBe('');
  });
});

describe('SettingsComponent - data version refresh', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let dataVersion: DataVersionService;

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
    dataVersion = TestBed.inject(DataVersionService);

    await accountService.create('Cash', 'EUR', 100000);
    await component.ngOnInit();
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('reloads accounts and categories when the data version changes while mounted', async () => {
    expect(component.accounts().some((a) => a.name === 'Bank')).toBe(false);

    await accountService.create('Bank', 'EUR', 0);
    await categoryService.create('Transport', 'expense');

    dataVersion.bump();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(component.accounts().some((a) => a.name === 'Bank')).toBe(true);
    expect(component.categories().some((c) => c.name === 'Transport')).toBe(true);
  });

  it('does not reload while the data version stays unchanged', async () => {
    await accountService.create('Bank', 'EUR', 0);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(component.accounts().some((a) => a.name === 'Bank')).toBe(false);
  });
});
