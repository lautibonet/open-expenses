import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupCardComponent } from './backup-card.component';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { ProfileService } from '../../../core/services/profile.service';
import { AccountService } from '../../../core/services/account.service';
import { db } from '../../../core/db/database';
import { BackupSnapshot } from '../../../backup/backup-snapshot';
import { NoBackupFoundError } from '../../../backup/drive-backup-provider';

function sampleSnapshot(): BackupSnapshot {
  return {
    accounts: [
      { id: 1, name: 'Restored Savings', currency: 'USD', initialBalance: 20000, active: true, createdAt: new Date().toISOString() },
    ],
    categories: [],
    transactions: [],
    transfers: [],
    profile: [{ id: 1, baseCurrency: 'USD', onboardingCompleted: true, lastBackupAt: null }],
    exportedAt: '2026-08-27T00:00:00.000Z',
  };
}

describe('BackupCardComponent', () => {
  let fixture: ComponentFixture<BackupCardComponent>;
  let component: BackupCardComponent;
  let backupService: DriveBackupService;
  let accountService: AccountService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [BackupCardComponent],
    }).compileComponents();

    const profileService = TestBed.inject(ProfileService);
    await profileService.completeOnboarding('EUR');

    accountService = TestBed.inject(AccountService);
    backupService = TestBed.inject(DriveBackupService);

    fixture = TestBed.createComponent(BackupCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    await db.delete();
  });

  it('renders the three backup actions', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Download backup file');
    expect(text).toContain('Restore from file');
    expect(text).toContain('Restore from Google Drive');
  });

  it('downloads the current snapshot as a file', async () => {
    await accountService.create('Cash', 'EUR', 100);

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await component.downloadBackup();

    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const parsed = JSON.parse(await blob.text());
    expect(parsed.accounts).toHaveLength(1);
    expect(parsed.accounts[0].name).toBe('Cash');
    expect(parsed.exportedAt).toBeTruthy();
    expect(component.message()).toContain('downloaded');
  });

  it('file restore shows the backup date and a replacement warning before confirming', async () => {
    await accountService.create('Old Cash', 'EUR', 100);

    const file = new File([JSON.stringify(sampleSnapshot())], 'open-expenses-backup.json', {
      type: 'application/json',
    });

    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();

    expect(component.pendingRestore()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(component.backupDate());
    expect(fixture.nativeElement.textContent).toContain('replaces all current data');
  });

  it('file restore cancel leaves local data unchanged', async () => {
    await accountService.create('Old Cash', 'EUR', 100);

    const file = new File([JSON.stringify(sampleSnapshot())], 'open-expenses-backup.json', {
      type: 'application/json',
    });
    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();

    component.cancelRestore();

    expect(component.pendingRestore()).toBeNull();
    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Old Cash');
  });

  it('file restore confirmed replaces the full local dataset', async () => {
    await accountService.create('Old Cash', 'EUR', 100);

    const file = new File([JSON.stringify(sampleSnapshot())], 'open-expenses-backup.json', {
      type: 'application/json',
    });
    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    await component.confirmRestore();

    expect(component.pendingRestore()).toBeNull();
    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Restored Savings');
    expect(accounts[0].currency).toBe('USD');
  });

  it('shows an error for an invalid backup file without opening confirmation', async () => {
    const file = new File(['not json'], 'backup.json', { type: 'application/json' });

    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(component.pendingRestore()).toBeNull();
    expect(component.errorMessage()).toContain('Invalid backup file');
  });

  it('cloud restore shows the backup date and warning before overwriting', async () => {
    await accountService.create('Old Cash', 'EUR', 100);

    vi.spyOn(backupService, 'getCloudSnapshot').mockResolvedValue(sampleSnapshot());

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.pendingRestore()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(component.backupDate());
    expect(fixture.nativeElement.textContent).toContain('replaces all current data');
  });

  it('cloud restore confirmed replaces the full local dataset and does not trigger a backup', async () => {
    await accountService.create('Old Cash', 'EUR', 100);

    vi.spyOn(backupService, 'getCloudSnapshot').mockResolvedValue(sampleSnapshot());

    await component.restoreFromCloud();
    await component.confirmRestore();

    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Restored Savings');
    expect(backupService.lastBackupAt()).toBeNull();
  });

  it('cloud restore cancel leaves local data unchanged', async () => {
    await accountService.create('Old Cash', 'EUR', 100);

    vi.spyOn(backupService, 'getCloudSnapshot').mockResolvedValue(sampleSnapshot());

    await component.restoreFromCloud();
    component.cancelRestore();

    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Old Cash');
  });

  it('surfaces a message when no cloud backup exists', async () => {
    vi.spyOn(backupService, 'getCloudSnapshot').mockRejectedValue(new NoBackupFoundError());

    await component.restoreFromCloud();

    expect(component.pendingRestore()).toBeNull();
    expect(component.errorMessage()).toContain('No backup');
  });
});