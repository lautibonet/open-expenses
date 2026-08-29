import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickAddCardComponent } from './quick-add-card.component';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { LanguageService } from '../../../core/services/language.service';
import { Account } from '../../../core/models/account.model';
import { Category } from '../../../core/models/category.model';
import { Transaction } from '../../../core/models/transaction.model';

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

  it('starts in compact mode with the first account and category when nothing was stored', async () => {
    await component.ngOnInit();
    expect(component.mode()).toBe('compact');
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

  it('emits a save payload for a base-currency quick-add', async () => {
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

  it('emits a save payload with the fetched rate for a foreign-currency quick-add', async () => {
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

  it('expands to the full form when a foreign-currency rate cannot be resolved', async () => {
    exchangeRateService.getRate.mockRejectedValue(new Error('offline'));
    await component.ngOnInit();
    component.onAccountChange(2);
    await new Promise(resolve => setTimeout(resolve, 10));

    component.form.update(f => ({ ...f, amount: 100 }));
    let saved = false;
    component.save.subscribe(() => (saved = true));

    component.onSubmit();

    expect(saved).toBe(false);
    expect(component.mode()).toBe('expanded');
  });

  it('re-fetches the rate when the date changes on a foreign-currency account', async () => {
    await component.ngOnInit();
    component.onAccountChange(2);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', component.form().date);

    exchangeRateService.getRate.mockResolvedValueOnce({
      rate: 1.12, from: 'USD', to: 'EUR', date: '2026-01-15',
    });

    await component.onDateChange('2026-01-15');

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-01-15');
    expect(component.form().exchangeRate).toBe(1.12);
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

  it('expands in place via More options and preserves the compact selection', async () => {
    await component.ngOnInit();
    component.form.update((f) => ({ ...f, amount: 42 }));
    component.onAccountChange(2);
    await new Promise((resolve) => setTimeout(resolve, 10));

    component.expandForm();

    expect(component.mode()).toBe('expanded');
    expect(component.form().accountId).toBe(2);
    expect(component.form().amount).toBe(42);
    expect(component.editingId()).toBeNull();
  });

  it('emits a save with note from the expanded new-transaction form', async () => {
    await component.ngOnInit();
    component.expandForm();
    component.form.update((f) => ({
      ...f,
      amount: 25,
      note: 'lunch',
    }));

    let saved: any;
    component.save.subscribe((data) => (saved = data));
    component.onSubmitForm();

    expect(saved.id).toBeNull();
    expect(saved.amount).toBe(25);
    expect(saved.note).toBe('lunch');
  });

  it('opens the expanded form pre-filled when an existing transaction is edited', async () => {
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

    expect(component.mode()).toBe('expanded');
    expect(component.editingId()).toBe(7);
    expect(component.form().accountId).toBe(2);
    expect(component.form().amount).toBe(120);
    expect(component.form().note).toBe('flight');
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
    component.onSubmitForm();

    expect(saved.id).toBe(7);
    expect(saved.amount).toBe(130);
  });

  it('collapses and announces success after markSaved', async () => {
    await component.ngOnInit();
    component.expandForm();

    component.markSaved(false);

    expect(component.mode()).toBe('compact');
    expect(component.announcement()).toBe('Transaction saved');
    expect(component.form().amount).toBe(0);
  });

  it('exposes the announcement to assistive tech in the expanded form', async () => {
    await component.ngOnInit();
    component.expandForm();
    component.announcement.set('Transaction saved');
    fixture.detectChanges();

    const live = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live.textContent).toContain('Transaction saved');
  });

  it('does not pop focus back to the amount input when a save completes', async () => {
    await component.ngOnInit();
    const focusSpy = vi.spyOn(component, 'focusAmount');

    component.markSaved(false);

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('clears saving and surfaces the error after markFailed', async () => {
    await component.ngOnInit();
    component.form.update((f) => ({ ...f, amount: 25 }));
    component.saving.set(true);

    component.markFailed('Boom');

    expect(component.saving()).toBe(false);
    expect(component.errorMessage()).toBe('Boom');
  });

  it('cancels an expanded new form by collapsing to compact', async () => {
    await component.ngOnInit();
    component.expandForm();
    expect(component.mode()).toBe('expanded');

    component.cancelExpand();

    expect(component.mode()).toBe('compact');
    expect(component.editingId()).toBeNull();
  });

  it('blocks compact submit while a save is in flight and unblocks on success', async () => {
    await component.ngOnInit();
    component.form.update((f) => ({ ...f, amount: 25 }));

    component.onSubmit();
    expect(component.canSubmit()).toBe(false);

    component.markSaved(false);
    component.form.update((f) => ({ ...f, amount: 30 }));
    expect(component.canSubmit()).toBe(true);
  });

  function tagControls(root: HTMLElement): Element[] {
    return Array.from(root.querySelectorAll('input, select')).filter((el) => {
      const name = el.getAttribute('name') ?? '';
      const label = el.getAttribute('aria-label') ?? '';
      return name.toLowerCase().includes('tag') || label.toLowerCase().includes('tag');
    });
  }

  it('collects no tags in the compact form or its payload', async () => {
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

  it('collects no tags in the expanded form or its payload', async () => {
    await component.ngOnInit();
    component.expandForm();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tag')).toHaveLength(0);
    expect(tagControls(fixture.nativeElement)).toHaveLength(0);
    component.form.update((f) => ({ ...f, amount: 25 }));
    let saved: any;
    component.save.subscribe((data) => (saved = data));
    component.onSubmitForm();

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

    expect(component.mode()).toBe('expanded');
    expect(tagControls(fixture.nativeElement)).toHaveLength(0);
    let saved: any;
    component.save.subscribe((data) => (saved = data));
    component.onSubmitForm();

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

  it('renders the compact form in Spanish when the active Language is Spanish', async () => {
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
    expect(text).toContain('Importe');
    expect(text).toContain('Cuenta');
    expect(text).toContain('Categoría');
    expect(text).toContain('Registrar');
    expect(text).toContain('Más opciones');
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
    expect(fixture.nativeElement.textContent).toContain('Record');

    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Registrar');
  });
});
