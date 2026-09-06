import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupCardComponent } from './backup-card.component';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { NetworkService } from '../../../core/services/network.service';
import { ProfileService } from '../../../core/services/profile.service';
import { AccountService } from '../../../core/services/account.service';
import { LanguageService } from '../../../core/services/language.service';
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

  it('renders the backup actions', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Back up to Google Drive');
    expect(text).toContain('Download backup file');
    expect(text).toContain('Restore from file');
    expect(text).toContain('Restore from Google Drive');
  });

  it('backs up to the cloud from the card', async () => {
    const spy = vi.spyOn(backupService, 'backupNow').mockResolvedValue(undefined);

    const button = fixture.nativeElement.querySelector('.backup-actions button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalled();
  });

  it('disables the cloud back-up button while offline', () => {
    TestBed.inject(NetworkService).isOnline.set(false);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.backup-actions button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    vi.spyOn(backupService, 'backupNow').mockResolvedValue(undefined);
    button.click();

    expect(backupService.backupNow).not.toHaveBeenCalled();
  });

  it('shows the last-backup time with the method, Never before the first backup', () => {
    const lastBackup = fixture.nativeElement.querySelector('.last-backup') as HTMLElement;
    expect(lastBackup.textContent?.trim()).toBe('Last backup: Never');

    backupService.lastBackupAt.set(new Date(Date.now() - 5 * 60 * 1000));
    fixture.detectChanges();

    expect(lastBackup.textContent?.trim()).toBe('Google Drive · Last backup: 5 minutes ago');
  });

  it('renders the last-backup time in Spanish', async () => {
    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();

    const lastBackup = fixture.nativeElement.querySelector('.last-backup') as HTMLElement;
    expect(lastBackup.textContent?.trim()).toBe('Última copia: Nunca');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Hacer copia en Google Drive');
  });

  it('surfaces a cloud backup failure as a dismissible alert', () => {
    backupService.error.set('popup_closed_by_user');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('app-dismissible-alert[role="alert"] .alert') as HTMLElement;
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('sign-in was cancelled');

    const host = alert.closest('app-dismissible-alert') as HTMLElement;
    expect(host.getAttribute('title')).toBe('popup_closed_by_user');

    (alert.querySelector('.alert-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-dismissible-alert[role="alert"] .alert')).toBeNull();
  });

  it('renders the cloud backup failure in Spanish', async () => {
    await TestBed.inject(LanguageService).setLanguage('es');
    backupService.error.set('popup_closed_by_user');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('app-dismissible-alert[role="alert"] .alert') as HTMLElement;
    expect(alert.textContent).toContain('se canceló');
  });

  it('clears a stale cloud backup error when the app goes offline', () => {
    backupService.error.set('popup_closed_by_user');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-dismissible-alert[role="alert"] .alert'),
    ).not.toBeNull();

    TestBed.inject(NetworkService).isOnline.set(false);
    fixture.detectChanges();

    expect(backupService.error()).toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-dismissible-alert[role="alert"] .alert'),
    ).toBeNull();
  });

  it('renders in Spanish with a locale-formatted backup date', async () => {
    await TestBed.inject(LanguageService).setLanguage('es');

    const snapshot = sampleSnapshot();
    snapshot.exportedAt = '2026-08-27T12:00:00.000Z';
    const file = new File([JSON.stringify(snapshot)], 'open-expenses-backup.json', {
      type: 'application/json',
    });
    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Copia de seguridad');
    expect(text).toContain('Restaurar desde archivo');
    expect(text).toContain('Restaurar desde Google Drive');
    expect(text).toContain('Esto reemplaza todos los datos actuales.');
    expect(component.backupDate()).toContain('ago 2026');
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

  it('shows the restored backup time immediately after confirming a restore', async () => {
    const snapshot = sampleSnapshot();
    snapshot.profile = [
      { id: 1, baseCurrency: 'USD', onboardingCompleted: true, lastBackupAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    ];
    const file = new File([JSON.stringify(snapshot)], 'open-expenses-backup.json', {
      type: 'application/json',
    });
    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    await component.confirmRestore();
    fixture.detectChanges();

    const lastBackup = fixture.nativeElement.querySelector('.last-backup') as HTMLElement;
    expect(lastBackup.textContent?.trim()).toBe('Google Drive · Last backup: 5 minutes ago');
  });

  it('cloud restore confirmed shows the restored backup time immediately', async () => {
    const snapshot = sampleSnapshot();
    snapshot.profile = [
      { id: 1, baseCurrency: 'USD', onboardingCompleted: true, lastBackupAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    ];
    vi.spyOn(backupService, 'getCloudSnapshot').mockResolvedValue(snapshot);

    await component.restoreFromCloud();
    await component.confirmRestore();
    fixture.detectChanges();

    const lastBackup = fixture.nativeElement.querySelector('.last-backup') as HTMLElement;
    expect(lastBackup.textContent?.trim()).toBe('Google Drive · Last backup: 5 minutes ago');
  });

  it('cancelled restore leaves the displayed last-backup status untouched', async () => {
    await accountService.create('Old Cash', 'EUR', 100);
    const previous = new Date(Date.now() - 5 * 60 * 1000);
    backupService.lastBackupAt.set(previous);
    fixture.detectChanges();

    const file = new File([JSON.stringify(sampleSnapshot())], 'open-expenses-backup.json', {
      type: 'application/json',
    });
    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();

    component.cancelRestore();
    fixture.detectChanges();

    const lastBackup = fixture.nativeElement.querySelector('.last-backup') as HTMLElement;
    expect(lastBackup.textContent?.trim()).toBe('Google Drive · Last backup: 5 minutes ago');
    expect(backupService.lastBackupAt()).toBe(previous);
    const accounts = await db.accounts.toArray();
    expect(accounts[0].name).toBe('Old Cash');
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

  it('dismisses the failure note and brings it back on the next failure', async () => {
    const file = new File(['not json'], 'backup.json', { type: 'application/json' });
    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Invalid backup file');

    (alert.querySelector('.alert-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();

    await component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeTruthy();
  });

  it('dismisses the success note', async () => {
    await accountService.create('Cash', 'EUR', 100);

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await component.downloadBackup();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('downloaded');

    (alert.querySelector('.alert-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();
  });
});
