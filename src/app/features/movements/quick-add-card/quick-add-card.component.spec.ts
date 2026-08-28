import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickAddCardComponent } from './quick-add-card.component';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { Account } from '../../../core/models/account.model';
import { Category } from '../../../core/models/category.model';
import { Transaction } from '../../../core/models/transaction.model';

const STORAGE_KEY = 'open-expenses.quick-add.last-selection';

function makeAccount(id: number, name: string, currency: string): Account {
  return { id, name, currency, initialBalance: 0, active: true, createdAt: new Date() };
}

function makeCategory(id: number, name: string, type: 'Income' | 'Expense'): Category {
  return { id, name, type, active: true, createdAt: new Date() };
}

describe('QuickAddCardComponent', () => {
  let fixture: ComponentFixture<QuickAddCardComponent>;
  let component: QuickAddCardComponent;
  let exchangeRateService: { getRate: ReturnType<typeof vi.fn> };

  const eurAccount = makeAccount(1, 'Cash', 'EUR');
  const usdAccount = makeAccount(2, 'Dollars', 'USD');
  const food = makeCategory(10, 'Food', 'Expense');
  const payroll = makeCategory(11, 'Payroll', 'Income');

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
      tags: [],
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

  it('emits a save with tags and note from the expanded new-transaction form', async () => {
    await component.ngOnInit();
    component.expandForm();
    component.form.update((f) => ({
      ...f,
      amount: 25,
      tags: ['food'],
      note: 'lunch',
    }));

    let saved: any;
    component.save.subscribe((data) => (saved = data));
    component.onSubmitForm();

    expect(saved.id).toBeNull();
    expect(saved.amount).toBe(25);
    expect(saved.tags).toEqual(['food']);
    expect(saved.note).toBe('lunch');
  });

  it('opens the expanded form pre-filled when an existing transaction is edited', async () => {
    const txn: Transaction = {
      id: 7,
      accountId: 2,
      categoryId: 11,
      amount: 120,
      date: new Date('2026-03-10'),
      period: 'March',
      year: 2026,
      tags: ['travel'],
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
    expect(component.form().tags).toEqual(['travel']);
    expect(component.form().note).toBe('flight');
  });

  it('emits a save payload carrying the id when saving an edit', async () => {
    const txn: Transaction = {
      id: 7,
      accountId: 1,
      categoryId: 10,
      amount: 120,
      date: new Date('2026-03-10'),
      period: 'March',
      year: 2026,
      tags: [],
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
});
