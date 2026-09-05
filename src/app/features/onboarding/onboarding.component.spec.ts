import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';
import { DriveBackupService } from '../../core/services/drive-backup.service';
import { LanguageService } from '../../core/services/language.service';
import { NoBackupFoundError } from '../../backup/drive-backup-provider';
import { TranslationError } from '../../core/models/translation-error';
import { db } from '../../core/db/database';

function stubNavigator(language: string): void {
  vi.stubGlobal('navigator', { language, languages: [language], userAgent: 'vitest' });
}

describe('OnboardingComponent', () => {
  let fixture: ComponentFixture<OnboardingComponent>;
  let component: OnboardingComponent;
  let router: Router;
  let driveBackupService: {
    method: string;
    connect: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    restoreFromFile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    await db.delete();
    await db.open();

    driveBackupService = {
      method: 'Google Drive',
      connect: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      restoreFromFile: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        provideRouter([]),
        { provide: DriveBackupService, useValue: driveBackupService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    stubNavigator('en-GB');
    await createComponent();
  });

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
  });

  it('starts on the language step preselected from the browser language', async () => {
    stubNavigator('es-ES');
    await createComponent();

    expect(component.step()).toBe('language');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Language');
    expect(component.language()).toBe('es');
  });

  it('offers the restore step after the language step', () => {
    component.goTo('restore');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Restore from Google Drive');
    expect(text).toContain('Restore from file');
    expect(text).toContain('Start fresh');
  });

  it('returns to the language step from the restore step via its Back button', () => {
    component.goTo('restore');
    fixture.detectChanges();

    const back = fixture.nativeElement.querySelector(
      '.nav-buttons .btn:not(.primary)',
    ) as HTMLButtonElement;
    expect(back).toBeTruthy();
    back.click();

    expect(component.step()).toBe('language');
  });

  it('keeps restore state when going back from the restore step and returning', async () => {
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    await component.restoreFromCloud();
    expect(component.infoMessage()).toContain('No backup');

    component.goTo('language');
    expect(component.step()).toBe('language');

    component.goTo('restore');
    fixture.detectChanges();
    expect(component.infoMessage()).toContain('No backup');
    expect(component.language()).toBe('en');
  });

  it('renders the following steps in the chosen language immediately', async () => {
    await component.onLanguageChange('es');
    fixture.detectChanges();

    component.goTo('currency');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Moneda base');
    expect(text).not.toContain('Base Currency');
  });

  it('shows the base currency step when starting fresh', () => {
    component.startFresh();
    fixture.detectChanges();

    expect(component.step()).toBe('currency');
    expect(fixture.nativeElement.textContent).toContain('Base Currency');
  });

  it('derives step numbers from the named steps instead of hard-coding them', () => {
    component.goTo('currency');

    expect(component.stepNumber('language')).toBe(1);
    expect(component.stepNumber('restore')).toBe(2);
    expect(component.stepNumber('currency')).toBe(3);
    expect(component.stepNumber('accounts')).toBe(4);
    expect(component.stepNumber('categories')).toBe(5);
  });

  it('walks the whole flow in order: language, restore, currency, accounts, categories', () => {
    expect(component.step()).toBe('language');

    component.goTo('restore');
    component.startFresh();
    expect(component.step()).toBe('currency');

    component.goTo('accounts');
    expect(component.step()).toBe('accounts');

    component.goTo('categories');
    expect(component.step()).toBe('categories');

    component.goTo('accounts');
    expect(component.step()).toBe('accounts');
  });

  it('reflects the wizard state in the step tab bar', () => {
    component.goTo('currency');
    fixture.detectChanges();

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('.step-tab'),
    ) as HTMLElement[];
    expect(tabs.length).toBe(5);
    expect(tabs[0].classList).toContain('completed');
    expect(tabs[1].classList).toContain('completed');
    expect(tabs[2].classList).toContain('current');
    expect(tabs[2].getAttribute('aria-current')).toBe('step');
    expect(tabs[3].classList).not.toContain('completed');
    expect(tabs[3].classList).not.toContain('current');
    expect(tabs[4].classList).not.toContain('completed');
    expect(tabs[4].classList).not.toContain('current');
  });

  it('offers the featured currency tiles and marks the selection', () => {
    component.startFresh();
    fixture.detectChanges();

    const tiles = Array.from(
      fixture.nativeElement.querySelectorAll('.currency-grid .select-tile'),
    ) as HTMLElement[];
    const codes = tiles.map(t => t.querySelector('.tile-code')!.textContent!.trim());
    expect(codes).toEqual(['EUR', 'USD', 'GBP', 'JPY']);

    const selected = tiles.find(t => t.classList.contains('selected'));
    expect(selected!.querySelector('.tile-code')!.textContent!.trim()).toBe('EUR');
  });

  it('pins the currency search above the grid and drops the symbol caption', () => {
    component.startFresh();
    fixture.detectChanges();

    const panel = fixture.nativeElement as HTMLElement;
    const search = panel.querySelector('.currency-search') as HTMLElement;
    const grid = panel.querySelector('.currency-grid') as HTMLElement;
    expect(search).toBeTruthy();
    expect(grid).toBeTruthy();
    // The search block precedes the grid instead of being a grid child.
    expect(search.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(grid.querySelector('.currency-search')).toBeNull();

    const text = panel.textContent as string;
    expect(text).not.toContain('Symbol:');
    expect(panel.querySelector('.tile-symbol-line')).toBeNull();
    // Tiles keep the top-right symbol.
    expect(grid.querySelector('.tile-symbol')).toBeTruthy();
  });

  it('selects a currency tile on click', () => {
    component.startFresh();
    fixture.detectChanges();

    const usd = (
      Array.from(fixture.nativeElement.querySelectorAll('.select-tile')) as HTMLElement[]
    ).find(t => t.querySelector('.tile-code')!.textContent!.trim() === 'USD')!;
    usd.click();

    expect(component.baseCurrency()).toBe('USD');
  });

  it('filters currency tiles from the search field by code or name', () => {
    component.startFresh();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#currency-search') as HTMLInputElement;
    const codes = (): string[] =>
      (
        Array.from(fixture.nativeElement.querySelectorAll('.select-tile')) as HTMLElement[]
      ).map(t => t.querySelector('.tile-code')!.textContent!.trim());

    input.value = 'swiss';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(codes()).toEqual(['CHF']);
    expect(fixture.nativeElement.querySelector('#currency-search')).toBeTruthy();

    input.value = 'japan';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(codes()).toEqual(['JPY']);

    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(codes()).toEqual(['EUR', 'USD', 'GBP', 'JPY']);
  });

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

  function stageAccounts(): void {
    component.goTo('accounts');
    fixture.detectChanges();

    component.accounts.set([
      { name: 'Checking', currency: 'EUR', balance: 1250 },
      { name: 'Cash', currency: 'CLP', balance: 30000 },
    ]);
    fixture.detectChanges();
  }

  function accountRows(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.account-list .account-row'),
    ) as HTMLElement[];
  }

  function rowFor(name: string): HTMLElement {
    return accountRows().find((r) => r.textContent!.includes(name))!;
  }

  function pencilFor(row: HTMLElement): HTMLButtonElement {
    return row.querySelector('button[data-edit-pencil]') as HTMLButtonElement;
  }

  function setNgModelValue(input: HTMLInputElement | HTMLSelectElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
  }

  // Issue #141: the accounts step adopts the Settings accounts-card
  // composition — list tiles, inline add form, the shared edit grammar
  // (pencil / tick / X, Enter / Escape) and the inline tick/X remove
  // confirmation. Nothing row-level is red at rest.
  it('renders account rows as Settings-style list tiles with pencil and remove actions', () => {
    stageAccounts();

    const rows = accountRows();
    expect(rows.length).toBe(2);

    const checking = rowFor('Checking');
    expect(checking.querySelector('.account-name')!.textContent!.trim()).toBe('Checking');
    expect(checking.querySelector('.account-meta')!.textContent).toContain('EUR');
    expect(checking.querySelector('.account-meta')!.textContent).toContain('1250');

    const pencil = pencilFor(checking);
    expect(pencil.getAttribute('data-edit-pencil')).toBe('account-0');
    expect(pencil.getAttribute('aria-label')).toBe('Edit account');
    expect(checking.querySelector('.account-name button')).toBeNull();

    const remove = checking.querySelector('button[aria-label="Remove"]') as HTMLButtonElement;
    expect(remove).toBeTruthy();
    expect(remove.classList).toContain('icon-btn');
    // No confirm-less deletes and nothing row-level is red at rest.
    expect(remove.classList).not.toContain('danger');
    expect(checking.querySelector('button[aria-label="Confirm removal"]')).toBeNull();
  });

  it('removes an account only after the inline tick/X confirmation', () => {
    stageAccounts();

    const row = rowFor('Checking');
    (row.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(row.querySelector('button[aria-label="Confirm removal"]')).toBeTruthy();
    expect(row.querySelector('button[aria-label="Cancel removal"]')).toBeTruthy();
    expect(accountRows().length).toBe(2);

    (row.querySelector('button[aria-label="Cancel removal"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(accountRows().length).toBe(2);
    expect(row.querySelector('button[aria-label="Confirm removal"]')).toBeNull();

    (row.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (row.querySelector('button[aria-label="Confirm removal"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(accountRows().length).toBe(1);
    expect(component.accounts()[0].name).toBe('Cash');
  });

  it('adds an account through the Settings-style inline add form', async () => {
    component.goTo('accounts');
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('.inline-form') as HTMLElement;
    expect(form.querySelector('.btn.dashed')).toBeTruthy();
    expect(form.textContent).toContain('Add');

    setNgModelValue(form.querySelector('input[type="text"]') as HTMLInputElement, 'Wallet');
    setNgModelValue(form.querySelector('select') as HTMLSelectElement, 'USD');
    setNgModelValue(form.querySelector('input[type="number"]') as HTMLInputElement, '500');
    fixture.detectChanges();
    (form.querySelector('.btn.dashed') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(accountRows().length).toBe(1);
    const row = rowFor('Wallet');
    expect(row.querySelector('.account-meta')!.textContent).toContain('USD');
    expect(row.querySelector('.account-meta')!.textContent).toContain('500');

    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    const balanceInput = form.querySelector('input[type="number"]') as HTMLInputElement;
    await flush();
    expect(nameInput.value).toBe('');
    expect(balanceInput.value).toBe('0');
  });

  it('rejects a negative initial balance inline when adding', () => {    component.goTo('accounts');
    fixture.detectChanges();

    setNgModelValue(
      fixture.nativeElement.querySelector('.inline-form input[type="text"]'),
      'Wallet',
    );
    setNgModelValue(
      fixture.nativeElement.querySelector('.inline-form input[type="number"]'),
      '-5',
    );
    component.addAccount();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert.textContent).toContain('cannot be negative');
    expect(accountRows().length).toBe(0);
  });

  it('opens the inline edit state from the pencil; tick saves', async () => {
    stageAccounts();

    const row = rowFor('Checking');
    pencilFor(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    expect(editState).toBeTruthy();
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    const balanceInput = editState.querySelector('input[type="number"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Checking');
    expect(balanceInput.value).toBe('1250');
    expect(editState.textContent).toContain('EUR');

    setNgModelValue(nameInput, 'Wallet');
    setNgModelValue(balanceInput, '250000');
    (editState.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(component.accounts()[0]).toEqual({ name: 'Wallet', currency: 'EUR', balance: 250000 });
    expect(row.querySelector('.edit-state')).toBeNull();
    expect(row.querySelector('.account-name')!.textContent!.trim()).toBe('Wallet');
  });

  it('discards inline edit changes from the X without touching the staged row', async () => {
    stageAccounts();

    const row = rowFor('Checking');
    pencilFor(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Wallet');
    (editState.querySelector('button[aria-label="Discard changes"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(component.accounts()[0].name).toBe('Checking');
    expect(row.querySelector('.edit-state')).toBeNull();
  });

  it('saves inline edits on Enter and cancels them on Escape', async () => {
    stageAccounts();

    const row = rowFor('Checking');
    pencilFor(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    let editState = row.querySelector('.edit-state') as HTMLElement;
    let nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Wallet');
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.accounts()[0].name).toBe('Wallet');
    expect(row.querySelector('.edit-state')).toBeNull();

    pencilFor(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    editState = row.querySelector('.edit-state') as HTMLElement;
    nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Changed');
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(component.accounts()[0].name).toBe('Wallet');
    expect(row.querySelector('.edit-state')).toBeNull();
  });

  it('moves focus to the first edit input on open and back to the pencil on cancel', async () => {
    stageAccounts();

    const row = rowFor('Checking');
    pencilFor(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const nameInput = row.querySelector(
      '.edit-state input[type="text"]',
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(nameInput);

    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    fixture.detectChanges();

    const pencil = row.querySelector('button[data-edit-pencil="account-0"]') as HTMLButtonElement;
    expect(pencil).toBeTruthy();
    expect(document.activeElement).toBe(pencil);
  });

  it('renders inline edit validation errors announced, without a page-level alert', async () => {
    stageAccounts();

    const row = rowFor('Checking');
    pencilFor(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Cash');
    (editState.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const inlineError = row.querySelector('.edit-error') as HTMLElement;
    expect(inlineError).toBeTruthy();
    expect(inlineError.getAttribute('role')).toBe('alert');
    expect(inlineError.textContent).toContain('already exists');
    expect(fixture.nativeElement.querySelector('app-dismissible-alert .alert')).toBeNull();
    expect(row.querySelector('.edit-state')).toBeTruthy();
  });

  it('discards an open edit when a removal is requested on another row', () => {
    stageAccounts();

    const cash = rowFor('Cash');
    pencilFor(accountRows()[0]).click();
    fixture.detectChanges();
    expect(accountRows()[0].querySelector('.edit-state')).toBeTruthy();

    (cash.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.editingAccount()).toBeNull();
    expect(cash.querySelector('button[aria-label="Confirm removal"]')).toBeTruthy();

    (cash.querySelector('button[aria-label="Confirm removal"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.accounts().map((a) => a.name)).toEqual(['Checking']);
  });

  it('keeps staged accounts and confirmed removals across back navigation', () => {
    stageAccounts();

    const row = rowFor('Cash');
    (row.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (row.querySelector('button[aria-label="Confirm removal"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(accountRows().length).toBe(1);

    component.goTo('currency');
    component.goTo('accounts');
    fixture.detectChanges();

    expect(accountRows().length).toBe(1);
    expect(accountRows()[0].textContent).toContain('Checking');
  });

  function stageCategories(): void {
    component.goTo('categories');
    fixture.detectChanges();
  }

  function categoryRows(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.category-list .category-row'),
    ) as HTMLElement[];
  }

  function rowForCategory(name: string): HTMLElement {
    return categoryRows().find((r) => r.textContent!.includes(name))!;
  }

  function pencilForCategory(row: HTMLElement): HTMLButtonElement {
    return row.querySelector('button[data-edit-pencil]') as HTMLButtonElement;
  }

  // Issue #142: the categories step adopts the Settings categories-card
  // composition — list tiles plus a fixed-width inline add form, the shared
  // edit grammar (pencil / tick / X, Enter / Escape) and the inline tick/X
  // remove confirmation. Nothing row-level is red at rest.
  it('renders category rows as Settings-style list tiles with pencil and remove actions', () => {
    stageCategories();

    const rows = categoryRows();
    expect(rows.length).toBe(9);

    const food = rowForCategory('Food');
    expect(food.querySelector('.category-name')!.textContent!.trim()).toBe('Food');
    expect(food.querySelector('.category-meta')!.textContent).toContain('Expense');

    const pencil = pencilForCategory(food);
    expect(pencil.getAttribute('data-edit-pencil')).toBe('category-0');
    expect(pencil.getAttribute('aria-label')).toBe('Edit category');
    expect(food.querySelector('.category-name button')).toBeNull();

    const remove = food.querySelector('button[aria-label="Remove"]') as HTMLButtonElement;
    expect(remove).toBeTruthy();
    expect(remove.classList).toContain('icon-btn');
    // No confirm-less deletes and nothing row-level is red at rest.
    expect(remove.classList).not.toContain('danger');
    expect(food.querySelector('button[aria-label="Confirm removal"]')).toBeNull();
  });

  it('removes a category only after the inline tick/X confirmation', () => {
    stageCategories();

    const row = rowForCategory('Food');
    (row.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(row.querySelector('button[aria-label="Confirm removal"]')).toBeTruthy();
    expect(row.querySelector('button[aria-label="Cancel removal"]')).toBeTruthy();
    expect(categoryRows().length).toBe(9);

    (row.querySelector('button[aria-label="Cancel removal"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(categoryRows().length).toBe(9);
    expect(row.querySelector('button[aria-label="Confirm removal"]')).toBeNull();

    (row.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (row.querySelector('button[aria-label="Confirm removal"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(categoryRows().length).toBe(8);
    expect(component.categories().map(c => c.name)).not.toContain('Food');
  });

  it('adds a category through the Settings-style inline add form', async () => {
    stageCategories();

    const form = fixture.nativeElement.querySelector('.inline-form') as HTMLElement;
    expect(form.querySelector('.btn.dashed')).toBeTruthy();
    expect(form.textContent).toContain('Add');

    setNgModelValue(form.querySelector('input[type="text"]') as HTMLInputElement, 'Groceries');
    setNgModelValue(form.querySelector('select') as HTMLSelectElement, 'income');
    fixture.detectChanges();
    (form.querySelector('.btn.dashed') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(categoryRows().length).toBe(10);
    const row = rowForCategory('Groceries');
    expect(row.querySelector('.category-meta')!.textContent).toContain('Income');
    expect(row.classList).toContain('stripe-income');

    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    await flush();
    expect(nameInput.value).toBe('');
  });

  it('rejects an empty and a duplicate category name when adding', () => {
    stageCategories();

    const form = fixture.nativeElement.querySelector('.inline-form') as HTMLElement;
    (form.querySelector('.btn.dashed') as HTMLButtonElement).click();
    fixture.detectChanges();

    let alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert.textContent).toContain('required');
    expect(categoryRows().length).toBe(9);

    setNgModelValue(form.querySelector('input[type="text"]') as HTMLInputElement, 'Transport');
    fixture.detectChanges();
    (form.querySelector('.btn.dashed') as HTMLButtonElement).click();
    fixture.detectChanges();

    alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert.textContent).toContain('already exists');
    expect(categoryRows().length).toBe(9);
  });

  it('opens the inline edit state from the pencil; tick saves', async () => {
    stageCategories();

    const row = rowForCategory('Food');
    pencilForCategory(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    expect(editState).toBeTruthy();
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    const typeSelect = editState.querySelector('select') as HTMLSelectElement;
    expect(nameInput.value).toBe('Food');
    expect(typeSelect.value).toBe('expense');

    setNgModelValue(nameInput, 'Groceries');
    setNgModelValue(typeSelect, 'income');
    (editState.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(row.querySelector('.edit-state')).toBeNull();
    expect(row.querySelector('.category-name')!.textContent!.trim()).toBe('Groceries');
    expect(row.querySelector('.category-meta')!.textContent).toContain('Income');

    // A rename detaches the row from the seeded defaults, so the chosen
    // Language no longer rewrites it.
    await component.onLanguageChange('es');
    expect(component.categories()[0].name).toBe('Groceries');
  });

  it('discards inline edit changes from the X without touching the staged row', async () => {
    stageCategories();

    const row = rowForCategory('Food');
    pencilForCategory(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Groceries');
    (editState.querySelector('button[aria-label="Discard changes"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(component.categories()[0].name).toBe('Food');
    expect(row.querySelector('.edit-state')).toBeNull();
  });

  it('saves inline edits on Enter and cancels them on Escape', async () => {
    stageCategories();

    const row = rowForCategory('Food');
    pencilForCategory(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    let editState = row.querySelector('.edit-state') as HTMLElement;
    let nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Groceries');
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.categories()[0].name).toBe('Groceries');
    expect(row.querySelector('.edit-state')).toBeNull();

    pencilForCategory(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    editState = row.querySelector('.edit-state') as HTMLElement;
    nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Changed');
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(component.categories()[0].name).toBe('Groceries');
    expect(row.querySelector('.edit-state')).toBeNull();
  });

  it('renders inline edit validation errors announced, without a page-level alert', async () => {
    stageCategories();

    const row = rowForCategory('Food');
    pencilForCategory(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const editState = row.querySelector('.edit-state') as HTMLElement;
    const nameInput = editState.querySelector('input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Transport');
    (editState.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const inlineError = row.querySelector('.edit-error') as HTMLElement;
    expect(inlineError).toBeTruthy();
    expect(inlineError.getAttribute('role')).toBe('alert');
    expect(inlineError.textContent).toContain('already exists');
    expect(fixture.nativeElement.querySelector('app-dismissible-alert .alert')).toBeNull();
    expect(row.querySelector('.edit-state')).toBeTruthy();
  });

  it('discards an open category edit when a removal is requested on another row', () => {
    stageCategories();

    const transport = rowForCategory('Transport');
    pencilForCategory(categoryRows()[0]).click();
    fixture.detectChanges();
    expect(categoryRows()[0].querySelector('.edit-state')).toBeTruthy();

    (transport.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.editingCategory()).toBeNull();
    expect(transport.querySelector('button[aria-label="Confirm removal"]')).toBeTruthy();

    (transport.querySelector('button[aria-label="Confirm removal"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.categories().map((c) => c.name)).not.toContain('Transport');
  });

  it('moves focus to the first edit input on open and back to the pencil on cancel', async () => {
    stageCategories();

    const row = rowForCategory('Food');
    pencilForCategory(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const nameInput = row.querySelector(
      '.edit-state input[type="text"]',
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(nameInput);

    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    fixture.detectChanges();

    const pencil = row.querySelector('button[data-edit-pencil="category-0"]') as HTMLButtonElement;
    expect(pencil).toBeTruthy();
    expect(document.activeElement).toBe(pencil);
  });

  it('keeps staged categories and confirmed removals across back navigation', () => {
    stageCategories();

    const row = rowForCategory('Food');
    (row.querySelector('button[aria-label="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (row.querySelector('button[aria-label="Confirm removal"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(categoryRows().length).toBe(8);

    component.goTo('accounts');
    component.goTo('categories');
    fixture.detectChanges();

    expect(categoryRows().length).toBe(8);
    expect(component.categories().map(c => c.name)).not.toContain('Food');
  });

  it('lands on Movements when the fresh wizard completes', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.completeOnboarding();

    expect(navigate).toHaveBeenCalledWith(['/movements']);
  });

  it('persists the chosen language to the profile when completing onboarding', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.onLanguageChange('es');

    await component.completeOnboarding();

    expect((await db.profile.get(1))!.language).toBe('es');
  });

  it('prefills the categories in the browser language', async () => {
    stubNavigator('es-ES');
    await createComponent();

    const names = component.categories().map(c => c.name);
    expect(names).toContain('Comida');
    expect(names).toContain('Transporte');
    expect(names).not.toContain('Food');
  });

  it('re-applies the chosen Language to untouched default categories', async () => {
    expect(component.categories().map(c => c.name)).toContain('Food');

    await component.onLanguageChange('es');

    const names = component.categories().map(c => c.name);
    expect(names).toContain('Comida');
    expect(names).not.toContain('Food');
  });

  it('keeps user-renamed categories when the language changes', async () => {
    stageCategories();

    const row = rowForCategory('Food');
    pencilForCategory(row).click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const nameInput = row.querySelector('.edit-state input[type="text"]') as HTMLInputElement;
    setNgModelValue(nameInput, 'Groceries');
    (row.querySelector('button[aria-label="Save changes"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    await component.onLanguageChange('es');

    const names = component.categories().map(c => c.name);
    expect(names).toContain('Groceries');
    expect(names).toContain('Transporte');
  });

  it('seeds Spanish category names into the database when completing onboarding in Spanish', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.onLanguageChange('es');

    await component.completeOnboarding();

    const cats = await db.categories.toArray();
    expect(cats.length).toBe(9);
    expect(cats.map(c => c.name)).toContain('Comida');
    expect(cats.map(c => c.name)).not.toContain('Food');
  });

  it('seeds English category names into the database when completing onboarding in English', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.completeOnboarding();

    const cats = await db.categories.toArray();
    expect(cats.length).toBe(9);
    expect(cats.map(c => c.name)).toContain('Food');
    expect(cats.map(c => c.name)).not.toContain('Comida');
  });

  it('restores from cloud: connects, restores, and lands on Movements', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.restoreFromCloud();

    expect(driveBackupService.connect).toHaveBeenCalled();
    expect(driveBackupService.restore).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/movements']);
  });

  it('stays on the restore step with a clear message when no cloud backup exists', async () => {
    component.goTo('restore');
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    const navigate = vi.spyOn(router, 'navigate');

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.step()).toBe('restore');
    expect(component.infoMessage()).toContain('No backup');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the no-backup message when the user starts fresh', async () => {
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    await component.restoreFromCloud();
    expect(component.infoMessage()).not.toBe('');

    component.startFresh();

    expect(component.infoMessage()).toBe('');
    expect(component.errorMessage()).toBe('');
  });

  it('shows an error when the cloud restore fails for another reason', async () => {
    driveBackupService.restore.mockRejectedValue(
      new TranslationError('backup.error.offlineRestore'),
    );

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.infoMessage()).toBe('');
    expect(component.errorMessage()).toBe('Cannot restore while offline');
  });

  it('re-enables the restore step with a neutral notice when sign-in is cancelled', async () => {
    component.goTo('restore');
    driveBackupService.connect.mockRejectedValue(
      new TranslationError('backup.error.oauth.cancelled'),
    );
    const navigate = vi.spyOn(router, 'navigate');

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.isRestoring()).toBe(false);
    expect(component.step()).toBe('restore');
    expect(component.infoMessage()).toContain('cancelled');
    expect(component.errorMessage()).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('restores from an uploaded file and lands on Movements', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    await component.restoreFromFile(file);

    expect(driveBackupService.restoreFromFile).toHaveBeenCalledWith(file);
    expect(navigate).toHaveBeenCalledWith(['/movements']);
  });

  it('shows an error when the uploaded file is invalid', async () => {
    driveBackupService.restoreFromFile.mockRejectedValue(
      new TranslationError('backup.error.invalidFile'),
    );
    const navigate = vi.spyOn(router, 'navigate');
    const file = new File(['nope'], 'backup.json', { type: 'application/json' });

    await component.restoreFromFile(file);

    expect(component.errorMessage()).toBe('Invalid backup file');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('dismisses an error note and shows it again on the next failure', () => {
    component.goTo('accounts');
    fixture.detectChanges();

    component.addAccount();
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('required');

    (alert.querySelector('.alert-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();

    component.addAccount();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeTruthy();
  });
});

describe('OnboardingComponent restore language override', () => {
  let fixture: ComponentFixture<OnboardingComponent>;
  let component: OnboardingComponent;
  let router: Router;
  let languageService: LanguageService;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    router = TestBed.inject(Router);
    languageService = TestBed.inject(LanguageService);
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('applies the backup language over the one chosen during onboarding', async () => {
    component.onLanguageChange('en');
    expect(languageService.activeLanguage()).toBe('en');

    const snapshot = {
      accounts: [],
      categories: [],
      transactions: [],
      transfers: [],
      profile: [
        { id: 1, baseCurrency: 'EUR', language: 'es', onboardingCompleted: true, lastBackupAt: null },
      ],
      exportedAt: new Date().toISOString(),
    };
    const file = new File([JSON.stringify(snapshot)], 'backup.json', {
      type: 'application/json',
    });
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.restoreFromFile(file);

    expect((await db.profile.get(1))!.language).toBe('es');
    expect(languageService.activeLanguage()).toBe('es');
  });
});
