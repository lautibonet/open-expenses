import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { EraseCardComponent } from './erase-card.component';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { ProfileService } from '../../../core/services/profile.service';
import { AccountService } from '../../../core/services/account.service';
import { CategoryService } from '../../../core/services/category.service';
import { db } from '../../../core/db/database';

@Component({ template: '' })
class StubOnboardingComponent {}

describe('EraseCardComponent', () => {
  let fixture: ComponentFixture<EraseCardComponent>;
  let component: EraseCardComponent;
  let driveBackupService: DriveBackupService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let profileService: ProfileService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();
    localStorage.setItem(
      'open-expenses_google_token',
      JSON.stringify({ accessToken: 'token-123', expiresAt: Date.now() + 3600_000 }),
    );

    await TestBed.configureTestingModule({
      imports: [EraseCardComponent],
      providers: [
        provideRouter([{ path: 'onboarding', component: StubOnboardingComponent }]),
      ],
    }).compileComponents();

    profileService = TestBed.inject(ProfileService);
    await profileService.completeOnboarding('EUR');

    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    driveBackupService = TestBed.inject(DriveBackupService);
    await accountService.create('Cash', 'EUR', 100);
    await categoryService.create('Food', 'expense');

    fixture = TestBed.createComponent(EraseCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    await db.delete();
  });

  function confirmPanel(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.erase-confirm');
  }

  function confirmButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.erase-confirm .btn.danger.filled');
  }

  it('renders a danger-styled Erase card without a confirm panel', () => {
    const card = fixture.nativeElement.querySelector('#erase') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('Erase all data');

    const erase = fixture.nativeElement.querySelector('.erase-actions .btn.danger') as HTMLButtonElement;
    expect(erase).toBeTruthy();
    expect(confirmPanel()).toBeNull();
  });

  it('reveals a restore-style confirm panel with a warning when Erase is pressed', () => {
    (fixture.nativeElement.querySelector('.erase-actions .btn.danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(confirmPanel()).toBeTruthy();
    expect(confirmPanel()!.textContent).toContain('permanently deletes');
    expect(confirmButton()).toBeTruthy();
    expect(confirmPanel()!.textContent).toContain('Cancel');
  });

  it('cancelling changes nothing', async () => {
    (fixture.nativeElement.querySelector('.erase-actions .btn.danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.erase-confirm .btn:not(.danger)') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(confirmPanel()).toBeNull();
    expect(await db.accounts.count()).toBe(1);
    expect(await db.categories.count()).toBe(1);
    expect(await db.profile.count()).toBe(1);
    expect(localStorage.getItem('open-expenses_google_token')).not.toBeNull();
  });

  it('confirming wipes all data tables and the stored Google sign-in token', async () => {
    (fixture.nativeElement.querySelector('.erase-actions .btn.danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    confirmButton().click();
    await fixture.whenStable();

    expect(await db.accounts.count()).toBe(0);
    expect(await db.categories.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.transfers.count()).toBe(0);
    expect(await db.profile.count()).toBe(0);
    expect(localStorage.getItem('open-expenses_google_token')).toBeNull();
    expect(driveBackupService.isConnected()).toBe(false);
  });

  it('after Erase the app returns to Onboarding', async () => {
    (fixture.nativeElement.querySelector('.erase-actions .btn.danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    confirmButton().click();
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    await vi.waitFor(() => expect(router.url).toBe('/onboarding'), { timeout: 2000 });
    expect(await profileService.isOnboardingCompleted()).toBe(false);
  });
});
