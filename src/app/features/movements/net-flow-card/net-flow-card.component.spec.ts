import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetFlowCardComponent, MovementItem } from './net-flow-card.component';
import { TransactionService } from '../../../core/services/transaction.service';
import { TransferService } from '../../../core/services/transfer.service';
import { AccountService } from '../../../core/services/account.service';
import { CategoryService } from '../../../core/services/category.service';
import { db } from '../../../core/db/database';
import { defaultScope, getCurrentPeriod } from '../../../core/types/period.type';

describe('NetFlowCardComponent', () => {
  let fixture: ComponentFixture<NetFlowCardComponent>;
  let component: NetFlowCardComponent;
  let transactionService: TransactionService;
  let transferService: TransferService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let eurAccountId: number;
  let usdAccountId: number;
  let expenseCategoryId: number;
  let incomeCategoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [NetFlowCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NetFlowCardComponent);
    component = fixture.componentInstance;
    // Zoneless tests run an initial render tick before the awaited seeds below
    // resolve, so the required inputs must have values from creation onwards.
    fixture.componentRef.setInput('movements', []);
    fixture.componentRef.setInput('accounts', []);
    fixture.componentRef.setInput('categories', []);
    fixture.componentRef.setInput('baseCurrency', 'EUR');
    transactionService = TestBed.inject(TransactionService);
    transferService = TestBed.inject(TransferService);
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);

    const eurAcc = await accountService.create('Cash EUR', 'EUR', 100000);
    eurAccountId = eurAcc.id!;
    const usdAcc = await accountService.create('Cash USD', 'USD', 50000);
    usdAccountId = usdAcc.id!;
    const expenseCat = await categoryService.create('Food', 'expense');
    expenseCategoryId = expenseCat.id!;
    const incomeCat = await categoryService.create('Payroll', 'income');
    incomeCategoryId = incomeCat.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  async function scopeMovements(): Promise<MovementItem[]> {
    const scope = defaultScope();
    const txns = await transactionService.getByScope(scope);
    const transfers = await transferService.getByScope(scope);
    return [
      ...txns.map((t) => ({ type: 'transaction' as const, data: t })),
      ...transfers.map((t) => ({ type: 'transfer' as const, data: t })),
    ];
  }

  async function render(): Promise<void> {
    const [movements, accounts, categories] = await Promise.all([
      scopeMovements(),
      accountService.getActive(),
      categoryService.getAll(),
    ]);
    fixture.componentRef.setInput('movements', movements);
    fixture.componentRef.setInput('accounts', accounts);
    fixture.componentRef.setInput('categories', categories);
    fixture.componentRef.setInput('baseCurrency', 'EUR');
    fixture.detectChanges();
  }

  it('nets scope income minus expense for single-currency data', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, incomeCategoryId, 3000, new Date(), period);
    await transactionService.create(eurAccountId, expenseCategoryId, 500, new Date(), period);
    await transactionService.create(eurAccountId, expenseCategoryId, 250, new Date(), period);
    await render();

    expect(component.incomeTotal()).toBe(3000);
    expect(component.expenseTotal()).toBe(750);
    expect(component.netTotal()).toBe(2250);
  });

  it('uses the base-currency amount for cross-currency transactions', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(
      usdAccountId,
      expenseCategoryId,
      10,
      new Date(),
      period,
      1.08,
      10.8,
    );
    await transactionService.create(eurAccountId, incomeCategoryId, 30, new Date(), period);
    await render();

    expect(component.expenseTotal()).toBeCloseTo(10.8, 2);
    expect(component.incomeTotal()).toBe(30);
    expect(component.netTotal()).toBeCloseTo(19.2, 2);
  });

  it('falls back to the face amount when a foreign transaction has no stored conversion', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(
      usdAccountId,
      expenseCategoryId,
      10,
      new Date(),
      period,
      null,
      null,
    );
    await render();

    expect(component.expenseTotal()).toBe(10);
  });

  it('excludes transfers from the flow', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, incomeCategoryId, 1000, new Date(), period);
    await transferService.create(eurAccountId, usdAccountId, 400, new Date(), period, 'savings');
    await render();

    expect(component.incomeTotal()).toBe(1000);
    expect(component.expenseTotal()).toBe(0);
    expect(component.netTotal()).toBe(1000);
  });

  it('renders a plus-signed mono net amount with IN/OUT sub-lines', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, incomeCategoryId, 5200, new Date(), period);
    await transactionService.create(eurAccountId, expenseCategoryId, 2750, new Date(), period);
    await render();

    const amount = fixture.nativeElement.querySelector('.net-amount').textContent;
    expect(amount).toContain('+');
    expect(amount).toContain('2,450.00');

    const lines = fixture.nativeElement.querySelector('.flow-lines').textContent;
    expect(lines).toContain('5,200.00');
    expect(lines).toContain('2,750.00');
    expect(lines).toContain('IN');
    expect(lines).toContain('OUT');
  });

  it('shows a negative net without the plus prefix', async () => {
    const period = getCurrentPeriod();
    await transactionService.create(eurAccountId, expenseCategoryId, 800, new Date(), period);
    await render();

    const amount = fixture.nativeElement.querySelector('.net-amount').textContent;
    expect(amount).not.toContain('+');
    expect(amount).toContain('-');
  });

  it('shows zero without a sign for an empty scope', async () => {
    await render();

    const amount = fixture.nativeElement.querySelector('.net-amount').textContent;
    expect(amount).not.toContain('+');
    expect(amount).toContain('0.00');
  });
});
