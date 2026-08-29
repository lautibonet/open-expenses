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

  it('should deactivate an account only after confirming and name it inline', async () => {
    expect(component.deactivationConfirmationLabel(accountId)).toContain('Cash');

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

    const updateButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent!.trim() === 'Update');
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
    const updateButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent!.trim() === 'Update');
    updateButton!.click();
    await flush();

    await languageService.init();

    expect(languageService.activeLanguage()).toBe('es');
  });
});
