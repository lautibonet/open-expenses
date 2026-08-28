import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickAddCardComponent } from './quick-add-card.component';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { Account } from '../../../core/models/account.model';
import { Category } from '../../../core/models/category.model';

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
      getRate: vi.fn().mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };

    await TestBed.configureTestingModule({
      imports: [QuickAddCardComponent],
      providers: [
        { provide: ExchangeRateService, useValue: exchangeRateService },
      ],
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

  it('defaults to the first account and category when nothing was stored', async () => {
    await component.ngOnInit();
    expect(component.accountId()).toBe(1);
    expect(component.categoryId()).toBe(10);
  });

  it('focuses the amount input on arrival', async () => {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[aria-label="Amount"]') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
  });

  it('saves a base-currency transaction with null exchange rate and converted amount', async () => {
    await component.ngOnInit();
    component.amount.set(50);
    let saved: any;
    component.saved.subscribe((data) => (saved = data));

    component.onSubmit();

    expect(saved).toEqual({
      accountId: 1,
      categoryId: 10,
      amount: 50,
      date: component.date(),
      period: component.period(),
      year: component.year(),
      exchangeRate: null,
      baseCurrencyAmount: null,
    });
  });

  it('saves a foreign-currency transaction with the fetched rate and converted amount', async () => {
    await component.ngOnInit();
    component.onAccountChange(2);
    await new Promise(resolve => setTimeout(resolve, 10));

    component.amount.set(100);
    let saved: any;
    component.saved.subscribe((data) => (saved = data));

    component.onSubmit();

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', component.date());
    expect(saved.exchangeRate).toBe(1.08);
    expect(saved.baseCurrencyAmount).toBe(108);
  });

  it('expands to the full form when a foreign-currency rate cannot be resolved', async () => {
    exchangeRateService.getRate.mockRejectedValue(new Error('offline'));
    await component.ngOnInit();
    component.onAccountChange(2);
    await new Promise(resolve => setTimeout(resolve, 10));

    component.amount.set(100);
    let expanded: any = null;
    let saved = false;
    component.expand.subscribe((data) => (expanded = data));
    component.saved.subscribe(() => (saved = true));

    component.onSubmit();

    expect(saved).toBe(false);
    expect(expanded).toEqual({
      accountId: 2,
      categoryId: 10,
      amount: 100,
      date: component.date(),
      period: component.period(),
      year: component.year(),
    });
  });

  it('persists the last-used account and category to localStorage on save', async () => {
    await component.ngOnInit();
    component.onAccountChange(2);
    component.onCategoryChange(11);
    await new Promise(resolve => setTimeout(resolve, 10));
    component.amount.set(50);
    component.onSubmit();

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ accountId: 2, categoryId: 11 }));
  });

  it('restores the stored selection as defaults on a later init', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accountId: 2, categoryId: 11 }));

    await component.ngOnInit();

    expect(component.accountId()).toBe(2);
    expect(component.categoryId()).toBe(11);
  });

  it('falls back to the first selection when the stored account is gone', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accountId: 999, categoryId: 11 }));

    await component.ngOnInit();

    expect(component.accountId()).toBe(1);
    expect(component.categoryId()).toBe(11);
  });

  it('clears the amount and announces success after resetForNext', async () => {
    await component.ngOnInit();
    component.amount.set(25);
    component.resetForNext();

    expect(component.amount()).toBe(0);
    expect(component.announcement()).toBe('Transaction saved');
  });

  it('blocks submit while a save is in flight and unblocks on reset or failure', async () => {
    await component.ngOnInit();
    component.amount.set(25);

    let saved: any;
    component.saved.subscribe((data) => (saved = data));

    component.onSubmit();
    expect(component.canSubmit()).toBe(false);

    component.resetForNext();
    component.amount.set(30);
    expect(component.canSubmit()).toBe(true);

    component.onSubmit();
    component.failSave();
    expect(component.canSubmit()).toBe(true);
  });
});
