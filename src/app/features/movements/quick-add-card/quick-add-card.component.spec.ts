import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickAddCardComponent } from './quick-add-card.component';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { LanguageService } from '../../../core/services/language.service';
import { Account } from '../../../core/models/account.model';
import { Category } from '../../../core/models/category.model';
import { Transaction } from '../../../core/models/transaction.model';
import { getCurrentPeriod, getCurrentYear } from '../../../core/types/period.type';

const STORAGE_KEY = 'open-expenses.quick-add.last-selection';

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

  const eurAccount = makeAccount(1, 'Cash', 'EUR');
  const usdAccount = makeAccount(2, 'Dollars', 'USD');
  const food = makeCategory(10, 'Food', 'expense');
  const payroll = makeCategory(11, 'Payroll', 'income');

  beforeEach(async () => {
    localStorage.clear();
    exchangeRateService = {
      getRate: vi
        .fn()
        .mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };

    await TestBed.configureTestingModule({
      imports: [QuickAddCardComponent],
      providers: [{ provide: ExchangeRateService, useValue: exchangeRateService }],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickAddCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accounts', [eurAccount, usdAccount]);
    fixture.componentRef.setInput('categories', [food, payroll]);
    fixture.componentRef.setInput('baseCurrency', 'EUR');
  });

  afterEach(() => {
    localStorage.clear();
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

  it('starts with the first account and category when nothing was stored', async () => {
    await component.ngOnInit();
    expect(component.form().accountId).toBe(1);
    expect(component.form().categoryId).toBe(10);
  });

  it('focuses the amount input on arrival', async () => {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'input[aria-label="Amount"]',
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
  });

  it('emits a save payload for a base-currency transaction', async () => {
    await component.ngOnInit();
    component.form.update((f) => ({ ...f, amount: 50 }));
    let saved: any;
    component.save.subscribe((data) => (saved = data));

    component.onSubmit();

    expect(saved).toMatchObject({
      id: null,
      accountId: 1,
      categoryId: 10,
      amount: 50,
      period: component.form().period,
      year: component.form().year,
      exchangeRate: null,
      baseCurrencyAmount: null,
    });
  });

  it('emits a save payload with the fetched rate for a foreign-currency transaction', async () => {
    await component.ngOnInit();
    component.onAccountChange(2);
    await new Promise((resolve) => setTimeout(resolve, 10));

    component.form.update((f) => ({ ...f, amount: 100 }));
    let saved: any;
    component.save.subscribe((data) => (saved = data));

    component.onSubmit();

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', component.form().date);
    expect(saved.exchangeRate).toBe(1.08);
    expect(saved.baseCurrencyAmount).toBe(108);
  });

  it('blocks submit until a foreign-currency rate is available and accepts a manual entry', async () => {
    exchangeRateService.getRate.mockRejectedValue(new Error('offline'));
    await component.ngOnInit();
    component.onAccountChange(2);
    await new Promise((resolve) => setTimeout(resolve, 10));

    component.form.update((f) => ({ ...f, amount: 100 }));
    let saved: any;
    component.save.subscribe((data) => (saved = data));

    component.onSubmit();

    expect(saved).toBeUndefined();
    expect(component.errorMessage()).toBeTruthy();

    component.form.update((f) => ({ ...f, exchangeRate: 1.2 }));
    component.onAmountOrRateChange();
    component.onSubmit();

    expect(saved).toMatchObject({ exchangeRate: 1.2, baseCurrencyAmount: 120 });
  });

  it('re-fetches the rate when the date changes on a foreign-currency account', async () => {
    await component.ngOnInit();
    component.onAccountChange(2);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', component.form().date);

    exchangeRateService.getRate.mockResolvedValueOnce({
      rate: 1.12, from: 'USD', to: 'EUR', date: '2026-01-15',
    });

    await component.onDateChange('2026-01-15');

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
    component.onAccountChange(2);
    component.onCategoryChange(11);
    await new Promise((resolve) => setTimeout(resolve, 10));
    component.form.update((f) => ({ ...f, amount: 50 }));
    component.onSubmit();

    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ accountId: 2, categoryId: 11 }),
    );
  });

  it('restores the stored selection as defaults on a later init', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accountId: 2, categoryId: 11 }));

    await component.ngOnInit();

    expect(component.form().accountId).toBe(2);
    expect(component.form().categoryId).toBe(11);
  });

  it('falls back to the first selection when the stored account is gone', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accountId: 999, categoryId: 11 }));

    await component.ngOnInit();

    expect(component.form().accountId).toBe(1);
    expect(component.form().categoryId).toBe(11);
  });

  it('opens prefilled when an existing transaction is set for edit', async () => {
    const txn: Transaction = {
      id: 7,
      accountId: 2,
      categoryId: 11,
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
    expect(component.form().accountId).toBe(2);
    expect(component.form().amount).toBe(120);
    expect(component.form().note).toBe('flight');
    expect(fixture.nativeElement.querySelector('h3').textContent).toContain('Edit Transaction');
  });

  it('emits a save payload carrying the id when saving an edit', async () => {
    const txn: Transaction = {
      id: 7,
      accountId: 1,
      categoryId: 10,
      amount: 120,
      date: new Date('2026-03-10'),
      period: 3,
      year: 2026,
      note: '',
      exchangeRate: null,
      baseCurrencyAmount: null,
      createdAt: new Date(),
    };
    fixture.componentRef.setInput('editTransaction', txn);
    fixture.detectChanges();
    component.form.update((f) => ({ ...f, amount: 130 }));

    let saved: any;
    component.save.subscribe((data) => (saved = data));
    component.onSubmit();

    expect(saved.id).toBe(7);
    expect(saved.amount).toBe(130);
  });

  it('restores a saved draft instead of the stored selection when initialDraft is provided', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accountId: 2, categoryId: 11 }));
    fixture.componentRef.setInput('initialDraft', {
      form: {
        ...component.form(),
        accountId: 1,
        categoryId: 10,
        amount: 42,
        note: 'cinema tickets',
      },
      editingId: null,
      rateState: { loading: false, error: '', rate: null, date: '' },
    });

    await component.ngOnInit();

    expect(component.editingId()).toBeNull();
    expect(component.form().accountId).toBe(1);
    expect(component.form().categoryId).toBe(10);
    expect(component.form().amount).toBe(42);
    expect(component.form().note).toBe('cinema tickets');
  });

  it('restores an edit draft so the payload keeps the id', async () => {
    fixture.componentRef.setInput('initialDraft', {
      form: {
        ...component.form(),
        accountId: 2,
        categoryId: 11,
        amount: 60,
        note: 'drafted edit',
        exchangeRate: 1.1,
        baseCurrencyAmount: 66,
      },
      editingId: 7,
      rateState: { loading: false, error: '', rate: 1.1, date: 'stored' },
    });

    await component.ngOnInit();

    expect(component.editingId()).toBe(7);
    expect(component.form().amount).toBe(60);
    expect(component.rateState().rate).toBe(1.1);

    let saved: any;
    component.save.subscribe((data) => (saved = data));
    component.onSubmit();

    expect(saved.id).toBe(7);
  });

  it('emits close when the user cancels', async () => {
    await component.ngOnInit();
    let closed = false;
    component.close.subscribe(() => (closed = true));

    component.cancel();

    expect(closed).toBe(true);
  });

  it('blocks submit while a save is in flight and unblocks after failure', async () => {
    await component.ngOnInit();
    component.form.update((f) => ({ ...f, amount: 25 }));

    component.saving.set(true);
    expect(component.canSubmit()).toBe(false);

    component.markFailed('Boom');
    expect(component.saving()).toBe(false);
    expect(component.canSubmit()).toBe(true);
    expect(component.errorMessage()).toBe('Boom');
  });

  it('explains why the save button is disabled while the form is incomplete', async () => {
    await component.ngOnInit();

    component.form.update((f) => ({ ...f, accountId: 0 }));
    expect(component.disabledReason()).toBe('Choose an account first.');

    component.form.update((f) => ({ ...f, accountId: 1, categoryId: 0 }));
    expect(component.disabledReason()).toBe('Choose a category first.');

    component.form.update((f) => ({ ...f, categoryId: 10, amount: 0 }));
    expect(component.disabledReason()).toBe('Enter an amount greater than zero.');

    component.form.update((f) => ({ ...f, amount: 25 }));
    expect(component.disabledReason()).toBe('');
  });

  it('explains why the save button is disabled while the rate is missing', async () => {
    await component.ngOnInit();
    component.onAccountChange(2);
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

  it('collects no tags in the form or its payload', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tag')).toHaveLength(0);
    expect(tagControls(fixture.nativeElement)).toHaveLength(0);
    component.form.update((f) => ({ ...f, amount: 25 }));
    let saved: any;
    component.save.subscribe((data) => (saved = data));
    component.onSubmit();

    expect(saved).not.toHaveProperty('tags');
  });

  it('pre-fills an edit without tags and emits a payload without them', async () => {
    const txn: Transaction = {
      id: 7,
      accountId: 2,
      categoryId: 11,
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

    expect(tagControls(fixture.nativeElement)).toHaveLength(0);
    let saved: any;
    component.save.subscribe((data) => (saved = data));
    component.onSubmit();

    expect(saved.id).toBe(7);
    expect(saved).not.toHaveProperty('tags');
  });
});

describe('QuickAddCardComponent - translations', () => {
  let fixture: ComponentFixture<QuickAddCardComponent>;
  let component: QuickAddCardComponent;

  beforeEach(async () => {
    localStorage.clear();
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
