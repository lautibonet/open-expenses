import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { TransactionService } from '../../core/services/transaction.service';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { ProfileService } from '../../core/services/profile.service';
import { DriveBackupService } from '../../core/services/drive-backup.service';
import { db } from '../../core/db/database';

describe('SettingsComponent - tags', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let transactionService: TransactionService;
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

  it('should load tag counts on init', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'January', ['food']);
    await component.ngOnInit();
    expect(component.tagCounts()).toEqual([
      { tag: 'food', count: 2 },
      { tag: 'weekly', count: 1 },
    ]);
  });

  it('should have empty tagCounts when no tags exist', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January');
    await component.ngOnInit();
    expect(component.tagCounts()).toEqual([]);
  });

  it('should delete a tag and refresh tag counts', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food', 'weekly']);
    await transactionService.create(accountId, categoryId, 200, new Date(), 'February', ['food']);
    await component.ngOnInit();
    expect(component.tagCounts().length).toBe(2);

    component.confirmDeleteTag('food');
    await component.deleteTag();

    expect(component.tagCounts()).toEqual([{ tag: 'weekly', count: 1 }]);
    expect(component.tagToDelete()).toBeNull();
  });

  it('should cancel tag deletion', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food']);
    await component.ngOnInit();
    component.confirmDeleteTag('food');
    expect(component.tagToDelete()).toBe('food');
    component.cancelDeleteTag();
    expect(component.tagToDelete()).toBeNull();
  });

  it('should rename a tag and refresh tag counts', async () => {
    await transactionService.create(accountId, categoryId, 100, new Date(), 'January', ['food']);
    await component.ngOnInit();
    component.startEditTag('food');
    component.editingTag.set({ old: 'food', new: 'groceries' });
    await component.saveTagRename();
    expect(component.tagCounts()).toEqual([{ tag: 'groceries', count: 1 }]);
  });
});

describe('SettingsComponent - backup', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let driveBackupService: DriveBackupService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    const profileService = TestBed.inject(ProfileService);
    await profileService.completeOnboarding('EUR');

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    driveBackupService = TestBed.inject(DriveBackupService);
  });

  afterEach(async () => {
    localStorage.clear();
    await db.delete();
  });

  it('should show not connected state initially', async () => {
    await component.ngOnInit();
    expect(driveBackupService.isConnected()).toBe(false);
  });

  it('should display relative time for lastBackupAt', async () => {
    const profileService = TestBed.inject(ProfileService);
    const now = new Date();
    await profileService.updateLastBackupAt(now);

    const freshService = new DriveBackupService(profileService);
    await new Promise((r) => setTimeout(r, 500));

    expect(freshService.lastBackupAt()).not.toBeNull();
    expect(freshService.lastBackupAt()?.getTime()).toBe(now.getTime());
  });

  it('should schedule auto-backup after adding an account', async () => {
    await component.ngOnInit();
    component.newAccountName.set('Savings');
    component.newAccountCurrency.set('EUR');
    component.newAccountBalance.set(0);

    const spy = vi.spyOn(driveBackupService, 'scheduleAutoBackup');

    await component.addAccount();
    expect(spy).toHaveBeenCalled();
  });

  it('should schedule auto-backup after deactivating an account', async () => {
    const accountService = TestBed.inject(AccountService);
    const account = await accountService.create('Cash', 'EUR', 0);
    await component.ngOnInit();

    const spy = vi.spyOn(driveBackupService, 'scheduleAutoBackup');

    await component.deactivateAccount(account.id!);
    expect(spy).toHaveBeenCalled();
  });

  it('should schedule auto-backup after adding a category', async () => {
    await component.ngOnInit();
    component.newCategoryName.set('Transport');
    component.newCategoryType.set('Expense');

    const spy = vi.spyOn(driveBackupService, 'scheduleAutoBackup');

    await component.addCategory();
    expect(spy).toHaveBeenCalled();
  });
});
