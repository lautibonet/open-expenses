import { db, eraseAllLocalData } from './database';
import { AccountService } from '../services/account.service';
import { CategoryService } from '../services/category.service';
import { ProfileService } from '../services/profile.service';

describe('eraseAllLocalData', () => {
  let accountService: AccountService;
  let categoryService: CategoryService;
  let profileService: ProfileService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    accountService = new AccountService();
    categoryService = new CategoryService();
    profileService = new ProfileService();

    await accountService.create('Cash', 'EUR', 100);
    await accountService.create('Bank', 'USD', 500);
    await categoryService.create('Salary', 'income');
    await categoryService.create('Food', 'expense');
    const account = (await accountService.getAll())[0];
    const category = (await categoryService.getAll())[0];
    await db.transactions.add({
      accountId: account.id!,
      categoryId: category.id!,
      amount: 25,
      note: 'Lunch',
      date: new Date('2026-01-15'),
      period: 1,
      year: 2026,
    } as never);
    await db.transfers.add({
      sourceAccountId: account.id!,
      destinationAccountId: (await accountService.getAll())[1].id!,
      sourceAmount: 10,
      destinationAmount: 10,
      exchangeRate: 1,
      baseCurrencyAmount: 10,
      note: '',
      date: new Date('2026-01-16'),
      period: 1,
      year: 2026,
    } as never);
    await profileService.completeOnboarding('EUR', 'en');
  });

  afterEach(async () => {
    await db.delete();
  });

  it('wipes Accounts, Categories, Transactions, Transfers, and the Profile', async () => {
    await eraseAllLocalData();

    expect(await db.accounts.count()).toBe(0);
    expect(await db.categories.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.transfers.count()).toBe(0);
    expect(await db.profile.count()).toBe(0);
  });

  it('leaves the app un-onboarded afterwards', async () => {
    expect(await profileService.isOnboardingCompleted()).toBe(true);

    await eraseAllLocalData();

    expect(await profileService.isOnboardingCompleted()).toBe(false);
  });
});
