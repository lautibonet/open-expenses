import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickAddCardComponent } from './quick-add-card.component';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { LanguageService } from '../../../core/services/language.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { AccountService } from '../../../core/services/account.service';
import { CategoryService } from '../../../core/services/category.service';
import { Account } from '../../../core/models/account.model';
import { Category } from '../../../core/models/category.model';
import { Transaction } from '../../../core/models/transaction.model';
import { db } from '../../../core/db/database';
import { getCurrentPeriod, getCurrentYear } from '../../../core/types/period.type';

const STORAGE_KEY = 'open-expenses.quick-add.last-selection';

function flush(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeAccount(id: number, name: string, currency: string): Account {
  return { id, name, currency, initialBalance: 0, active: true, createdAt: new Date() };
}

function makeCategory(id: number, name: string, type: 'income' | 'expense'): Category {
  return { id, name, type, active: true, createdAt: new Date() };
}

describe('QuickAddCardComponent', () => {
  let fixture: ComponentFixture<QuickAddCardComponent>;
  let component: QuickAddCardComponent;
  let exchangeRateService: { getRate: ReturnType<typeof vi.fn> };
  let transactionService: TransactionService;
  let eurAccount: Account;
  let usdAccount: Account;
  let food: Category;
  let payroll: Category;

  beforeEach(async () => {
    localStorage.clear();
    await db.delete();
    await db.open();

    exchangeRateService = {
      getRate: vi
        .fn()
        .mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };

    await TestBed.configureTestingModule({
      imports: [QuickAddCardComponent],
      providers: [{ provide: ExchangeRateService, useValue: exchangeRateService }],
    }).compileComponents();

    transactionService = TestBed.inject(TransactionService);

    const accountService = TestBed.inject(AccountService);
    const categoryService = TestBed.inject(CategoryService);
    const cash = await accountService.create('Cash', 'EUR', 0);
    const dollars = await accountService.create('Dollars', 'USD', 0);
    const foodCat = await categoryService.create('Food', 'expense');
    const payrollCat = await categoryService.create('Payroll', 'income');
    eurAccount = { ...makeAccount(cash.id!, 'Cash', 'EUR') };
    usdAccount = { ...makeAccount(dollars.id!, 'Dollars', 'USD') };
    food = { ...makeCategory(foodCat.id!, 'Food', 'expense') };
    payroll = { ...makeCategory(payrollCat.id!, 'Payroll', 'income') };

    fixture = TestBed.createComponent(QuickAddCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accounts', [eurAccount, usdAccount]);
    fixture.componentRef.setInput('categories', [food, payroll]);
    fixture.componentRef.setInput('baseCurrency', 'EUR');
  });

  afterEach(async () => {
    localStorage.clear();
    await db.delete();
  });

  it('renders the full form with every field and no compact mode', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect(el.querySelector('h3').textContent).toContain('New Transaction');
    expect(el.querySelector('select[name="account"]')).toBeTruthy();
    expect(el.querySelector('select[name="category"]')).toBeTruthy();
    expect(el.querySelector('input[name="amount"]')).toBeTruthy();
    expect(el.querySelector('input[name="note"]')).toBeTruthy();
    expect(el.querySelector('input[name="date"]')).toBeTruthy();
    expect(el.querySelector('select[name="period"]')).toBeTruthy();
    expect(el.querySelector('select[name="year"]')).toBeTruthy();
    expect(el.textContent).not.toContain('More...');
  });

  // jsdom does no layout, so "amount, note and date inputs are exactly as
  // wide as the dropdown fields inside the sheet" is asserted at the
  // compiled-stylesheet seam (#107).
  it('resolves text-like inputs and selects to the same rendered width (box-sizing)', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    // Angular's emulated encapsulation inserts [_ngcontent-*] attributes
    // between the selector parts, so the descendant chain is matched
    // piecewise.
    expect(css).toMatch(
      /\.form-grid[^{]*label[^{]*input[^{]*\{[^}]*box-sizing:\s*border-box/,
    );
    expect(css).toMatch(
      /\.form-grid[^{]*label[^{]*select[^{]*\{[^}]*box-sizing:\s*border-box/,
    );
    expect(css).toMatch(/\.form-grid[^{]*label[^{]*input[^{]*\{[^}]*width:\s*100%/);
  });

  it('starts with the first account and category when nothing was stored', async () => {
    await component.ngOnInit();
    expect(component.form().accountId).toBe(eurAccount.id);
    expect(component.form().categoryId).toBe(food.id);
  });

  it('focuses the amount input on arrival', async () => {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'input[aria-label="Amount"]',
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
  });

  it('saves a base-currency transaction through the transaction store and emits saved', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    component.form.update((f) => ({ ...f, amount: 50 }));

    let savedWasEdit: boolean | undefined;
    component.saved.subscribe((wasEdit) => (savedWasEdit = wasEdit));
    await component.onSubmit();

    const txns = await transactionService.getAll();
    expect(txns).toHaveLength(1);
    expect(txns[0].accountId).toBe(eurAccount.id);
    expect(txns[0].categoryId).toBe(food.id);
    expect(txns[0].amount).toBe(50);
    expect(txns[0].exchangeRate).toBeNull();
    expect(txns[0].baseCurrencyAmount).toBeNull();
    expect(txns[0].year).toBe(component.form().year);
    expect(savedWasEdit).toBe(false);
    expect(component.saving()).toBe(false);
  });

  it('saves the fetched rate and converted amount for a foreign-currency transaction', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    component.onAccountChange(usdAccount.id!);
    fixture.detectChanges();
    await flush();

    component.form.update((f) => ({ ...f, amount: 100 }));
    let saved = 0;
    component.saved.subscribe(() => saved++);
    await component.onSubmit();

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', component.form().date);
    const txns = await transactionService.getAll();
    expect(txns).toHaveLength(1);
    expect(txns[0].exchangeRate).toBe(1.08);
    expect(txns[0].baseCurrencyAmount).toBe(108);
    expect(saved).toBe(1);
  });

  it('blocks submit until a foreign-currency rate is available and accepts a manual entry', async () => {
    exchangeRateService.getRate.mockRejectedValue(new Error('offline'));
    await component.ngOnInit();
    fixture.detectChanges();
    component.onAccountChange(usdAccount.id!);
    fixture.detectChanges();
    await flush();

    component.form.update((f) => ({ ...f, amount: 100 }));
    let saved = 0;
    component.saved.subscribe(() => saved++);

    await component.onSubmit();

    expect(saved).toBe(0);
    expect(await transactionService.getAll()).toHaveLength(0);
    expect(component.errorMessage()).toBeTruthy();

    component.form.update((f) => ({ ...f, exchangeRate: 1.2 }));
    component.onAmountOrRateChange();
    await component.onSubmit();

    expect(saved).toBe(1);
    const txns = await transactionService.getAll();
    expect(txns[0].exchangeRate).toBe(1.2);
    expect(txns[0].baseCurrencyAmount).toBe(120);
  });

  it('re-fetches the rate when the date changes on a foreign-currency account', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    component.onAccountChange(usdAccount.id!);
    fixture.detectChanges();
    await flush();
    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', component.form().date);

    exchangeRateService.getRate.mockResolvedValueOnce({
      rate: 1.12, from: 'USD', to: 'EUR', date: '2026-01-15',
    });

    component.onDateChange('2026-01-15');
    fixture.detectChanges();
    await flush();

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-01-15');
    expect(component.form().exchangeRate).toBe(1.12);
  });

  it('re-derives the period and year when the date changes', async () => {
    await component.ngOnInit();

    await component.onDateChange('2025-12-22');

    expect(component.form().date).toBe('2025-12-22');
    expect(component.form().period).toBe(12);
    expect(component.form().year).toBe(2025);

    await component.onDateChange('2026-03-10');

    expect(component.form().period).toBe(3);
    expect(component.form().year).toBe(2026);
  });

  it('keeps a manually overridden period and year after the date derivation', async () => {
    await component.ngOnInit();

    await component.onDateChange('2026-03-10');
    component.form.update((f) => ({ ...f, period: 1, year: 2024 }));

    expect(component.form().period).toBe(1);
    expect(component.form().year).toBe(2024);
  });

  it('defaults the period and year from today, not any browsed scope', async () => {
    await component.ngOnInit();

    expect(component.form().date).toBe(new Date().toISOString().split('T')[0]);
    expect(component.form().period).toBe(getCurrentPeriod());
    expect(component.form().year).toBe(getCurrentYear());
  });

  it('persists the last-used account and category to localStorage on save', async () => {
    await component.ngOnInit();
    component.onAccountChange(usdAccount.id!);
    component.onCategoryChange(payroll.id!);
    await new Promise((resolve) => setTimeout(resolve, 10));
    component.form.update((f) => ({ ...f, amount: 50 }));
    await component.onSubmit();

    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ accountId: usdAccount.id, categoryId: payroll.id }),
    );
  });

  it('restores the stored selection as defaults on a later init', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accountId: usdAccount.id, categoryId: payroll.id }),
    );

    await component.ngOnInit();

    expect(component.form().accountId).toBe(usdAccount.id);
    expect(component.form().categoryId).toBe(payroll.id);
  });

  it('falls back to the first selection when the stored account is gone', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accountId: 999, categoryId: payroll.id }));

    await component.ngOnInit();

    expect(component.form().accountId).toBe(eurAccount.id);
    expect(component.form().categoryId).toBe(payroll.id);
  });

  it('opens prefilled when an existing transaction is set for edit', async () => {
    const txn: Transaction = {
      id: 7,
      accountId: usdAccount.id!,
      categoryId: payroll.id!,
      amount: 120,
      date: new Date('2026-03-10'),
      period: 3,
      year: 2026,
      note: 'flight',
      exchangeRate: 1.1,
      baseCurrencyAmount: 132,
      createdAt: new Date(),
    };
    fixture.componentRef.setInput('editTransaction', txn);
    fixture.detectChanges();

    expect(component.editingId()).toBe(7);
    expect(component.form().accountId).toBe(usdAccount.id);
    expect(component.form().amount).toBe(120);
    expect(component.form().note).toBe('flight');
    expect(fixture.nativeElement.querySelector('h3').textContent).toContain('Edit Transaction');
  });

  it('saves the edit against the carried id', async () => {
    const t = await transactionService.create(
      eurAccount.id!,
      food.id!,
      120,
      new Date('2026-03-10'),
      3,
    );
    fixture.componentRef.setInput('editTransaction', t);
    fixture.detectChanges();
    component.form.update((f) => ({ ...f, amount: 130 }));

    let savedWasEdit: boolean | undefined;
    component.saved.subscribe((wasEdit) => (savedWasEdit = wasEdit));
    await component.onSubmit();

    expect(await transactionService.getAll()).toHaveLength(1);
    const updated = await transactionService.getById(t.id!);
    expect(updated!.amount).toBe(130);
    expect(savedWasEdit).toBe(true);
  });

  it('restores a saved draft instead of the stored selection when initialDraft is provided', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accountId: usdAccount.id, categoryId: payroll.id }),
    );
    fixture.componentRef.setInput('initialDraft', {
      form: {
        ...component.form(),
        accountId: eurAccount.id,
        categoryId: food.id,
        amount: 42,
        note: 'cinema tickets',
      },
      editingId: null,
      rateState: { loading: false, error: '', rate: null, date: '' },
    });

    await component.ngOnInit();

    expect(component.editingId()).toBeNull();
    expect(component.form().accountId).toBe(eurAccount.id);
    expect(component.form().categoryId).toBe(food.id);
    expect(component.form().amount).toBe(42);
    expect(component.form().note).toBe('cinema tickets');
  });

  it('restores an edit draft so the save keeps the id', async () => {
    const t = await transactionService.create(
      eurAccount.id!,
      food.id!,
      60,
      new Date('2026-03-10'),
      3,
    );
    fixture.componentRef.setInput('initialDraft', {
      form: {
        ...component.form(),
        accountId: usdAccount.id,
        categoryId: payroll.id,
        amount: 60,
        note: 'drafted edit',
        exchangeRate: 1.1,
        baseCurrencyAmount: 66,
      },
      editingId: t.id!,
      rateState: { loading: false, error: '', rate: 1.1, date: 'stored' },
    });

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.editingId()).toBe(t.id);
    expect(component.form().amount).toBe(60);
    expect(component.rateState().rate).toBe(1.1);

    await component.onSubmit();

    const updated = await transactionService.getById(t.id!);
    expect(updated!.accountId).toBe(usdAccount.id);
    expect(updated!.categoryId).toBe(payroll.id);
  });

  it('emits close when the user cancels', async () => {
    await component.ngOnInit();
    let closed = false;
    component.close.subscribe(() => (closed = true));

    component.cancel();

    expect(closed).toBe(true);
  });

  it('keeps the form values and reports the failure when the save fails', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    component.form.update((f) => ({ ...f, accountId: 999, amount: 25 }));

    let saved = 0;
    component.saved.subscribe(() => saved++);
    await component.onSubmit();

    expect(saved).toBe(0);
    expect(component.saving()).toBe(false);
    expect(component.canSubmit()).toBe(true);
    expect(component.errorMessage()).toBeTruthy();
    expect(component.form().amount).toBe(25);
  });

  it('explains why the save button is disabled while the form is incomplete', async () => {
    await component.ngOnInit();

    component.form.update((f) => ({ ...f, accountId: 0 }));
    expect(component.disabledReason()).toBe('Choose an account first.');

    component.form.update((f) => ({ ...f, accountId: eurAccount.id!, categoryId: 0 }));
    expect(component.disabledReason()).toBe('Choose a category first.');

    component.form.update((f) => ({ ...f, categoryId: food.id!, amount: 0 }));
    expect(component.disabledReason()).toBe('Enter an amount greater than zero.');

    component.form.update((f) => ({ ...f, amount: 25 }));
    expect(component.disabledReason()).toBe('');
  });

  it('explains why the save button is disabled while the rate is missing', async () => {
    await component.ngOnInit();
    component.onAccountChange(usdAccount.id!);
    await new Promise((resolve) => setTimeout(resolve, 10));
    component.form.update((f) => ({ ...f, amount: 25 }));

    component.rateState.set({ loading: true, error: '', rate: null, date: '' });
    component.form.update((f) => ({ ...f, exchangeRate: null }));
    expect(component.disabledReason()).toBe('The exchange rate is needed before saving.');

    component.rateState.set({ loading: false, error: '', rate: 1.08, date: '2026-08-26' });
    component.form.update((f) => ({ ...f, exchangeRate: 1.08 }));
    expect(component.disabledReason()).toBe('');
  });

  it('stays quiet about the disabled save while a save is in flight', async () => {
    await component.ngOnInit();
    component.form.update((f) => ({ ...f, amount: 0 }));
    component.saving.set(true);

    expect(component.disabledReason()).toBe('');
  });

  function tagControls(root: HTMLElement): Element[] {
    return Array.from(root.querySelectorAll('input, select')).filter((el) => {
      const name = el.getAttribute('name') ?? '';
      const label = el.getAttribute('aria-label') ?? '';
      return name.toLowerCase().includes('tag') || label.toLowerCase().includes('tag');
    });
  }

  it('collects no tags in the form or the saved transaction', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tag')).toHaveLength(0);
    expect(tagControls(fixture.nativeElement)).toHaveLength(0);
    component.form.update((f) => ({ ...f, amount: 25 }));
    await component.onSubmit();

    const txns = await transactionService.getAll();
    expect(txns).toHaveLength(1);
    expect(txns[0]).not.toHaveProperty('tags');
  });

  it('pre-fills an edit without tags and saves none', async () => {
    const t = await transactionService.create(
      eurAccount.id!,
      food.id!,
      120,
      new Date('2026-03-10'),
      3,
    );
    fixture.componentRef.setInput('editTransaction', t);
    fixture.detectChanges();

    expect(tagControls(fixture.nativeElement)).toHaveLength(0);
    await component.onSubmit();

    const updated = await transactionService.getById(t.id!);
    expect(updated).toBeTruthy();
    expect(updated!).not.toHaveProperty('tags');
  });
});

describe('QuickAddCardComponent - translations', () => {
  let fixture: ComponentFixture<QuickAddCardComponent>;
  let component: QuickAddCardComponent;

  beforeEach(async () => {
    localStorage.clear();
    // The previous describe's teardown deleted (and closed) the database;
    // setLanguage writes the profile, so open a fresh one.
    await db.open();
    const exchangeRateService = {
      getRate: vi.fn().mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };
    await TestBed.configureTestingModule({
      imports: [QuickAddCardComponent],
      providers: [{ provide: ExchangeRateService, useValue: exchangeRateService }],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickAddCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accounts', []);
    fixture.componentRef.setInput('categories', []);
    fixture.componentRef.setInput('baseCurrency', 'EUR');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows the empty state in Spanish when there are no accounts', async () => {
    await TestBed.inject(LanguageService).setLanguage('es');
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Aún no hay cuentas. Añade una en Ajustes para empezar a registrar.',
    );
  });

  it('renders the full form in Spanish when the active Language is Spanish', async () => {
    const now = new Date();
    const accounts: Account[] = [
      { id: 1, name: 'Cash', currency: 'EUR', initialBalance: 0, active: true, createdAt: now },
    ];
    const categories: Category[] = [
      { id: 10, name: 'Food', type: 'expense', active: true, createdAt: now },
    ];
    fixture.componentRef.setInput('accounts', accounts);
    fixture.componentRef.setInput('categories', categories);
    await TestBed.inject(LanguageService).setLanguage('es');
    await component.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Nueva transacción');
    expect(text).toContain('Importe');
    expect(text).toContain('Cuenta');
    expect(text).toContain('Categoría');
    expect(text).toContain('Guardar');
    expect(text).not.toContain('Más...');
  });

  it('re-renders in Spanish immediately when the Language changes after render', async () => {
    const now = new Date();
    fixture.componentRef.setInput('accounts', [
      { id: 1, name: 'Cash', currency: 'EUR', initialBalance: 0, active: true, createdAt: now } as Account,
    ]);
    fixture.componentRef.setInput('categories', [
      { id: 10, name: 'Food', type: 'expense', active: true, createdAt: now } as Category,
    ]);
    await component.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('New Transaction');

    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nueva transacción');
  });
});
