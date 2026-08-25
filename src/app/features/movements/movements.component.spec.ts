import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovementsComponent } from './movements.component';
import { TransactionService } from '../../core/services/transaction.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { db } from '../../core/db/database';

describe('MovementsComponent - tags integration', () => {
  let fixture: ComponentFixture<MovementsComponent>;
  let component: MovementsComponent;
  let transactionService: TransactionService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let accountId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsComponent);
    component = fixture.componentInstance;
    transactionService = TestBed.inject(TransactionService);
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);

    const account = await accountService.create('Cash', 'EUR', 100000);
    accountId = account.id!;
    const category = await categoryService.create('Food', 'Expense');
    categoryId = category.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should initialize with empty allTags', async () => {
    await component.ngOnInit();
    expect(component.allTags()).toEqual([]);
  });

  it('should load existing tags into allTags', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'January', ['groceries']);
    await component.ngOnInit();
    expect(component.allTags()).toEqual(['food', 'groceries', 'weekly']);
  });

  it('should initialize txForm.tags as empty array', async () => {
    await component.ngOnInit();
    expect(component.txForm().tags).toEqual([]);
  });

  it('should populate tags when editing a transaction', async () => {
    const t = await transactionService.create(
      accountId, categoryId, 1500, new Date('2026-01-15'), 'January',
      ['vacation', 'food'],
    );
    await component.ngOnInit();
    component.openTransactionForm(t.id!);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.txForm().tags).toEqual(['vacation', 'food']);
  });

  it('should save transaction with tags from txForm', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({
      ...f, tags: ['groceries', 'weekly'], accountId, categoryId, amount: 500, date: '2026-01-15',
    }));
    await component.saveTransaction();

    const transactions = await transactionService.getAll();
    expect(transactions.length).toBe(1);
    expect(transactions[0].tags).toEqual(['groceries', 'weekly']);
  });

  it('should update allTags after saving a transaction', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({
      ...f, tags: ['newtag'], accountId, categoryId, amount: 500, date: '2026-01-15',
    }));
    await component.saveTransaction();
    expect(component.allTags()).toEqual(['newtag']);
  });

  it('should reset tags when cancelling form', async () => {
    await component.ngOnInit();
    component.txForm.update(f => ({ ...f, tags: ['test'] }));
    component.cancelForm();
    expect(component.txForm().tags).toEqual([]);
  });
});
